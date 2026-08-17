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
    select: { text: true, audioUrl: true },
  });

  // Keyed by the Russian text itself (not the internal itemKey hash) — see
  // LessonView/VocabularyTab, which look up this map by `item.word`.
  const audio: Record<string, string> = {};
  for (const row of rows) audio[row.text] = row.audioUrl;

  return NextResponse.json({ audio });
}
