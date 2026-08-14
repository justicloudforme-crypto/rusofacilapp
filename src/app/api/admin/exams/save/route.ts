import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isLevelSlug } from "@/lib/courses";
import { isExamSlugFormat, invalidateExamContentCache } from "@/lib/exams/content";
import { validateExamContent } from "@/lib/exams/validate";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level : "";
  const examSlug = typeof body?.examSlug === "string" ? body.examSlug : "";
  const contentJsonRaw = typeof body?.contentJson === "string" ? body.contentJson : "";

  if (!isLevelSlug(level) || !isExamSlugFormat(level, examSlug)) {
    return NextResponse.json({ error: "Invalid level or exam identifier" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contentJsonRaw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = validateExamContent(parsed, level, examSlug);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await db.exam.upsert({
    where: { level_examSlug: { level, examSlug } },
    update: { contentJson: JSON.stringify(result.content), updatedBy: user.id },
    create: {
      level,
      examSlug,
      contentJson: JSON.stringify(result.content),
      updatedBy: user.id,
    },
  });
  invalidateExamContentCache(level, examSlug);

  return NextResponse.json({ ok: true });
}
