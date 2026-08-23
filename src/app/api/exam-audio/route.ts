import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLevelSlug } from "@/lib/courses";
import { isExamSlugFormat } from "@/lib/exams/content";

// Mirrors /api/lesson-audio (see that route for the "why public/why keyed
// by text" rationale — identical here: exam Russian text is already
// visible in the exam page's own HTML, and the .mp3 files are plain
// static assets).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? "";
  const examSlug = searchParams.get("examSlug") ?? "";

  if (!isLevelSlug(level) || !isExamSlugFormat(level, examSlug)) {
    return NextResponse.json({ error: "Invalid level or examSlug" }, { status: 400 });
  }

  const rows = await db.audioAsset.findMany({
    where: { contentType: "exam", contentId: `${level}-${examSlug}` },
    select: { text: true, audioUrl: true },
  });

  const audio: Record<string, string> = {};
  for (const row of rows) audio[row.text] = row.audioUrl;

  return NextResponse.json({ audio });
}
