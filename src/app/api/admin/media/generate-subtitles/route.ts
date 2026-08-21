import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getMediaById, saveMediaSubtitles } from "@/lib/media/data";
import { fetchRussianCaptions } from "@/lib/video-lesson/youtubeCaptions";
import { generateSubtitlesWithClaude } from "@/lib/media/generateSubtitlesWithClaude";

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
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const item = await getMediaById(id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Write Once, Lock Forever: once subtitles exist for an item, no code
  // path is allowed to silently overwrite them — including this button.
  // A deliberate re-generation (a confirmed error found in already-saved
  // subtitles) is a CLI action with an explicit --force=<id>, never a web
  // click. See prisma/generate-media-subtitles.ts.
  if (item.subtitles && item.subtitles.length > 0) {
    return NextResponse.json({ error: "already_has_subtitles" }, { status: 409 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 503 });
  }

  let captions;
  try {
    captions = await fetchRussianCaptions(item.youtubeVideoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "captions_fetch_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (!captions || captions.length === 0) {
    return NextResponse.json({ error: "no_russian_captions" }, { status: 404 });
  }

  try {
    const subtitles = await generateSubtitlesWithClaude({ title: item.title, captions });
    await saveMediaSubtitles(id, subtitles);
    return NextResponse.json({ subtitles, saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
