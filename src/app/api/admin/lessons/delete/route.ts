import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { invalidateLessonContentCache } from "@/lib/lessons/content";
import { invalidateSearchIndex } from "@/lib/search/index-server";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const level = typeof body?.level === "string" ? body.level : "";
  const lessonSlug = typeof body?.lesson === "string" ? body.lesson : "";

  if (!isLevelSlug(level) || !isLessonSlug(level, lessonSlug)) {
    return NextResponse.json({ error: "Invalid level or lesson" }, { status: 400 });
  }

  await db.lesson.deleteMany({ where: { level, lessonSlug } });
  await invalidateLessonContentCache(level, lessonSlug);
  // Индекс поиска печатает название этого объекта — правка названия
  // без сброса означала бы, что поиск до пяти минут находит старое.
  await invalidateSearchIndex();

  return NextResponse.json({ ok: true });
}
