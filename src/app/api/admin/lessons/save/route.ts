import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { validateLessonContent } from "@/lib/lessons/validate";
import { invalidateLessonContentCache } from "@/lib/lessons/content";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level : "";
  const lessonSlug = typeof body?.lesson === "string" ? body.lesson : "";
  const contentJsonRaw = typeof body?.contentJson === "string" ? body.contentJson : "";

  if (!isLevelSlug(level) || !isLessonSlug(level, lessonSlug)) {
    return NextResponse.json({ error: "Invalid level or lesson" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contentJsonRaw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = validateLessonContent(parsed);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await db.lesson.upsert({
    where: { level_lessonSlug: { level, lessonSlug } },
    update: { contentJson: JSON.stringify(result.content), updatedBy: user.id },
    create: {
      level,
      lessonSlug,
      contentJson: JSON.stringify(result.content),
      updatedBy: user.id,
    },
  });
  await invalidateLessonContentCache(level, lessonSlug);

  return NextResponse.json({ ok: true });
}
