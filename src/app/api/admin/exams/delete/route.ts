import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isLevelSlug } from "@/lib/courses";
import { isExamSlugFormat, invalidateExamContentCache } from "@/lib/exams/content";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level : "";
  const examSlug = typeof body?.examSlug === "string" ? body.examSlug : "";

  if (!isLevelSlug(level) || !isExamSlugFormat(level, examSlug)) {
    return NextResponse.json({ error: "Invalid level or exam identifier" }, { status: 400 });
  }

  await db.exam.deleteMany({ where: { level, examSlug } });
  invalidateExamContentCache(level, examSlug);

  return NextResponse.json({ ok: true });
}
