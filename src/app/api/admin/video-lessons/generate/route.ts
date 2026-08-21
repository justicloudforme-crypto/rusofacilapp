import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { fetchRussianCaptions } from "@/lib/video-lesson/youtubeCaptions";
import { generateLessonWithClaude } from "@/lib/video-lesson/generateLessonWithClaude";
import { validateVideoLessonData } from "@/lib/video-lesson/validateLesson";
import { saveVideoLesson } from "@/lib/video-lesson/lessonStore";
import { isMediaLevel } from "@/lib/media/types";

const YOUTUBE_ID_PATTERN = /^[\w-]{10,15}$/;

// Downloading yt-dlp's standalone binary on a cold start plus the actual
// caption fetch plus the Claude generation call can comfortably exceed the
// platform's 10s default — see youtubeCaptions.ts for why the download
// happens at all.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const level = typeof body?.level === "string" ? body.level : "A2";

  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    return NextResponse.json({ error: "invalid_video_id" }, { status: 400 });
  }
  if (!isMediaLevel(level)) {
    return NextResponse.json({ error: "invalid_level" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 503 });
  }

  let captions;
  try {
    captions = await fetchRussianCaptions(videoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "captions_fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (!captions || captions.length === 0) {
    return NextResponse.json({ error: "no_russian_captions" }, { status: 404 });
  }

  let lesson;
  try {
    lesson = await generateLessonWithClaude({ videoId, title, level, captions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const result = validateVideoLessonData(lesson);
  if (!result.valid) {
    return NextResponse.json({ error: `invalid_generated_lesson: ${result.error}` }, { status: 502 });
  }

  await saveVideoLesson(result.lesson);
  return NextResponse.json({ lesson: result.lesson, saved: true });
}
