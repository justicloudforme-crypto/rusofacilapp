import "server-only";
import { db } from "./db";
import { levelSlugs, lessonsPerLevel, type LevelSlug } from "./courses";
import type { AnswerMap, MistakeDetail } from "./lessons/scoring";

export interface LevelProgress {
  level: LevelSlug;
  completed: number;
  total: number;
  percent: number;
}

export async function getLevelProgress(
  userId: string,
): Promise<Record<LevelSlug, LevelProgress>> {
  // Only passed attempts count toward "completed" — LessonProgress now also
  // stores failing attempts (see schema comment), so this filter is what
  // keeps the course-progress bars meaning what they always meant.
  const rows = await db.lessonProgress.findMany({
    where: { userId, passed: true },
    select: { level: true, lessonSlug: true },
  });

  const completedByLevel = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = completedByLevel.get(row.level) ?? new Set<string>();
    set.add(row.lessonSlug);
    completedByLevel.set(row.level, set);
  }

  const result = {} as Record<LevelSlug, LevelProgress>;
  for (const level of levelSlugs) {
    const completed = completedByLevel.get(level)?.size ?? 0;
    const total = lessonsPerLevel[level];
    result[level] = {
      level,
      completed,
      total,
      percent: Math.round((completed / total) * 100),
    };
  }
  return result;
}

/** Saves an exercise attempt — called on every "Comprobar" check, pass or
 * fail, so a student who leaves mid-lesson (or fails) can pick up exactly
 * where they left off instead of losing the attempt. Upserted: only the
 * most recent attempt per lesson is kept. */
export async function saveLessonAttempt(
  userId: string,
  level: string,
  lessonSlug: string,
  score: number,
  passed: boolean,
  mistakes: MistakeDetail[],
  answers: AnswerMap,
) {
  const mistakesJson = JSON.stringify(mistakes.slice(0, 20));
  const answersJson = JSON.stringify(answers);
  await db.lessonProgress.upsert({
    where: { userId_level_lessonSlug: { userId, level, lessonSlug } },
    update: { score, passed, mistakes: mistakesJson, answers: answersJson, completedAt: new Date() },
    create: { userId, level, lessonSlug, score, passed, mistakes: mistakesJson, answers: answersJson },
  });
}

export interface LessonProgressDetail {
  lessonSlug: string;
  score: number;
  mistakes: MistakeDetail[];
  completedAt: Date;
}

/** Per-lesson results (score + what was missed) for the /profile "resultados
 * por lección" cards — a superset of getLevelProgress's completion counts.
 * Filtered to passed attempts only, same reasoning as getLevelProgress
 * above: /profile has always shown passes here, and a failed attempt now
 * being persisted too (for ExercisesTab's "restore where I left off") isn't
 * reason to suddenly list it as a completed lesson. */
export async function getLessonProgressDetails(
  userId: string,
): Promise<Record<LevelSlug, LessonProgressDetail[]>> {
  const rows = await db.lessonProgress.findMany({
    where: { userId, passed: true },
    orderBy: { completedAt: "desc" },
  });

  const result = {} as Record<LevelSlug, LessonProgressDetail[]>;
  for (const level of levelSlugs) result[level] = [];

  for (const row of rows) {
    if (!levelSlugs.includes(row.level as LevelSlug)) continue;
    let mistakes: MistakeDetail[] = [];
    try {
      const parsed = JSON.parse(row.mistakes);
      if (Array.isArray(parsed)) {
        mistakes = parsed.filter(
          (m): m is MistakeDetail =>
            typeof m === "object" &&
            m !== null &&
            typeof m.exerciseId === "string",
        );
      }
    } catch {
      mistakes = [];
    }
    result[row.level as LevelSlug].push({
      lessonSlug: row.lessonSlug,
      score: row.score,
      mistakes,
      completedAt: row.completedAt,
    });
  }
  return result;
}

export interface LessonAttempt {
  score: number;
  passed: boolean;
  answers: AnswerMap;
  completedAt: Date;
}

/** The most recent attempt (pass OR fail) at a specific lesson, regardless
 * of outcome — what GET /api/progress?level=&lesson= returns so
 * ExercisesTab can restore a student's exact previous answers on a repeat
 * visit, not just whether they'd passed. */
export async function getLessonAttempt(
  userId: string,
  level: string,
  lessonSlug: string,
): Promise<LessonAttempt | null> {
  const row = await db.lessonProgress.findUnique({
    where: { userId_level_lessonSlug: { userId, level, lessonSlug } },
  });
  if (!row) return null;

  let answers: AnswerMap = {};
  try {
    const parsed = JSON.parse(row.answers);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      answers = parsed as AnswerMap;
    }
  } catch {
    answers = {};
  }

  return { score: row.score, passed: row.passed, answers, completedAt: row.completedAt };
}

export type LessonStatus = "passed" | "attempted" | "none";

/** Per-lesson pass/attempted status for one level — powers the checkmark /
 * dot indicators on /courses/[level]'s lesson list, so a student sees their
 * path through the level at a glance instead of having to open each lesson
 * to find out. Unfiltered by `passed` (unlike getLevelProgress /
 * getLessonProgressDetails above) since "attempted but not yet passed" is
 * itself a status worth showing, not just "passed" vs "nothing yet". */
export async function getLevelLessonStatuses(
  userId: string,
  level: LevelSlug,
): Promise<Record<string, LessonStatus>> {
  const rows = await db.lessonProgress.findMany({
    where: { userId, level },
    select: { lessonSlug: true, passed: true },
  });
  const statuses: Record<string, LessonStatus> = {};
  for (const row of rows) {
    statuses[row.lessonSlug] = row.passed ? "passed" : "attempted";
  }
  return statuses;
}
