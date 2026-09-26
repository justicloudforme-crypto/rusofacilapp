import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * Учёт прогресса ВОШЕДШЕГО — только для e2e (заход 7.236, очередь без
 * сети). Живой пробе нужно знать, сколько раз сервер ПРИНЯЛ ответ урока
 * и сколько дней занятия поставил, а открывать базу прогона ей нельзя
 * (правило «базу e2e трогает только сервер», `check:e2e-single-writer`).
 *
 * Только чтение, только своё (кука сессии), только при `E2E_TEST_SEED=1`
 * — на настоящем развёртывании маршрута нет (404).
 */
export async function GET(request: NextRequest) {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const level = params.get("level") ?? "a1";
  const lesson = params.get("lesson") ?? "1";
  const [attempt, studyDays, receipts] = await Promise.all([
    db.lessonProgress.findUnique({
      where: { userId_level_lessonSlug: { userId: user.id, level, lessonSlug: lesson } },
      select: { score: true, passed: true, completedAt: true },
    }),
    db.studyDay.findMany({ where: { userId: user.id }, select: { dateKey: true, source: true }, orderBy: { dateKey: "asc" } }),
    db.offlineReceipt.count({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({ attempt, studyDays, receipts });
}
