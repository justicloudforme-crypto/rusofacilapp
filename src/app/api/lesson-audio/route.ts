import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";

// Public and unauthenticated on purpose: the mapping only exposes
// itemKey -> audioUrl for a lesson whose Russian text is already visible in
// the lesson page's own HTML once a subscriber has access, and the .mp3
// files under public/audio/lessons/ are themselves plain static assets —
// gating this endpoint wouldn't protect anything the lesson page doesn't
// already reveal. No rate limiter either: it's a cacheable read with no
// side effect, unlike the POST routes for progress/voice uploads.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? "";
  const lesson = searchParams.get("lesson") ?? "";

  if (!isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return NextResponse.json({ error: "Invalid level or lesson" }, { status: 400 });
  }

  const rows = await db.audioAsset.findMany({
    where: { contentType: "lesson", contentId: `${level}-${lesson}` },
    select: { itemKey: true, audioUrl: true },
  });

  // Keyed by the item's fixed position (see src/lib/lessons/audioKeys.ts),
  // not its text — a real, confirmed incident: keying by literal text
  // meant an admin's later typo/grammar fix in the Lesson-override editor
  // silently broke the link to already-paid-for narration for 14 items
  // across the course, since the generation script only ever saw the
  // original static content.json text.
  const audio: Record<string, string> = {};
  for (const row of rows) audio[row.itemKey] = row.audioUrl;

  return NextResponse.json({ audio });
}
