import "server-only";
import { db } from "../db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "../ttl-cache";
import type { LevelSlug } from "../courses";
import type { ExamContent } from "./types";
import raw from "./content.json";

/**
 * Two sources, in priority order — the same pattern as getLessonContent()
 * in src/lib/lessons/content.ts:
 *  1. The `Exam` table — exams created/edited by admins through
 *     /admin/exams. This is what actually persists on serverless hosting.
 *  2. ./content.json — the static seed content (currently just a1-exam-1),
 *     kept as a fallback so it keeps working even though it predates the
 *     admin editor.
 */
export const staticExamContent = raw as unknown as Record<string, ExamContent>;

function staticExamFor(level: LevelSlug, examSlug: string): ExamContent | null {
  const exam = staticExamContent[examSlug];
  return exam && exam.level === level ? exam : null;
}

// 60s, same rationale and same TTL as the lesson-content cache: read on
// every exam page view and every attempt submission, written only through
// the rare admin save/delete — see invalidateExamContentCache.
const examContentCache = getOrCreateGlobalSingleton(
  "examContentCache",
  () => new TtlCache<ExamContent | null>(60_000, "examContent")
);

function examContentCacheKey(level: string, examSlug: string): string {
  return `${level}-${examSlug}`;
}

export async function getExamContent(level: LevelSlug, examSlug: string): Promise<ExamContent | null> {
  return cached(examContentCache, examContentCacheKey(level, examSlug), async () => {
    const row = await db.exam.findUnique({ where: { level_examSlug: { level, examSlug } } });
    if (row) {
      try {
        return JSON.parse(row.contentJson) as ExamContent;
      } catch {
        // Fall through to the static version if a stored row is somehow
        // malformed, rather than breaking the exam page entirely.
      }
    }
    return staticExamFor(level, examSlug);
  });
}

/** Call after any write to an exam's Exam row (admin save or delete) so the
 * next read reflects it immediately instead of waiting out the TTL. */
export async function invalidateExamContentCache(level: string, examSlug: string) {
  await examContentCache.del(examContentCacheKey(level, examSlug));
}

/** Exam slugs follow "{level}-exam-{n}" (e.g. "a1-exam-2") — unlike lesson
 * slugs there's no fixed catalog to check against (new exams are created
 * on demand through /admin/exams, not pre-seeded), so this only checks the
 * shape, not that the exam actually exists yet. */
export function isExamSlugFormat(level: string, examSlug: string): boolean {
  return new RegExp(`^${level}-exam-[1-9][0-9]*$`).test(examSlug);
}

export type ExamStatus = "custom" | "example" | "empty";

/** Used by /admin/exams to show, for every known exam slug, whether it has
 * an admin-authored override, only the bundled example, or nothing yet. */
export async function getAllExamStatuses(): Promise<Record<string, ExamStatus>> {
  const customRows = await db.exam.findMany({ select: { level: true, examSlug: true } });
  const customKeys = new Set(customRows.map((row) => `${row.level}-${row.examSlug}`));

  const statuses: Record<string, ExamStatus> = {};
  for (const key of examSlugsAll()) {
    if (customKeys.has(key)) statuses[key] = "custom";
    else {
      const [level, ...rest] = key.split("-");
      statuses[key] = staticExamFor(level as LevelSlug, rest.join("-")) ? "example" : "empty";
    }
  }
  return statuses;
}

/** Every exam slug known from either source, deduplicated — the union of
 * whatever's in the static file and whatever admins have created. */
function examSlugsAll(): string[] {
  const fromStatic = Object.values(staticExamContent).map((exam) => `${exam.level}-${exam.slug}`);
  return Array.from(new Set(fromStatic));
}
