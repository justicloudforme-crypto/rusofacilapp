import "server-only";
import type { LessonContent } from "./types";
import rawLessonContent from "./content.json";
import { db } from "@/lib/db";
import { levelSlugs, lessonSlugsFor } from "@/lib/courses";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "@/lib/ttl-cache";

/**
 * Lesson content (grammar explanations and exercises) is always authored in
 * Spanish (es-MX), regardless of the site's interface language — the whole
 * pedagogy of this course is comparing Russian directly against Spanish.
 * Only the surrounding UI chrome (tab labels, buttons, feedback messages)
 * is translated, via the es/ru/en dictionaries.
 *
 * Two sources, in priority order:
 *  1. The `Lesson` table — content created/edited by admins through
 *     /admin/lessons. This is what actually persists on serverless hosting.
 *  2. ./content.json — the static seed content shipped with the app, kept
 *     as a fallback so lessons still work before any admin touches them.
 */
export const staticLessonContent = rawLessonContent as unknown as Record<string, LessonContent>;

export function staticContentFor(level: string, lessonSlug: string): LessonContent | null {
  return staticLessonContent[`${level}-${lessonSlug}`] ?? null;
}

// 60s: this table is read on every single lesson page view and every PDF
// export (see getLessonContent below), but only ever written through the
// admin lesson editor — a save is rare and the editor itself explicitly
// invalidates the entry it just wrote (see invalidateLessonContentCache),
// so the TTL only matters as a fallback in case a write path is ever added
// that forgets to invalidate.
const lessonContentCache = getOrCreateGlobalSingleton(
  "lessonContentCache",
  () => new TtlCache<LessonContent | null>(60_000)
);

function lessonContentCacheKey(level: string, lessonSlug: string): string {
  return `${level}-${lessonSlug}`;
}

export async function getLessonContent(
  level: string,
  lessonSlug: string
): Promise<LessonContent | null> {
  return cached(lessonContentCache, lessonContentCacheKey(level, lessonSlug), async () => {
    const row = await db.lesson.findUnique({ where: { level_lessonSlug: { level, lessonSlug } } });
    if (row) {
      try {
        return JSON.parse(row.contentJson) as LessonContent;
      } catch {
        // Fall through to the static version if a stored row is somehow
        // malformed, rather than breaking the lesson page entirely.
      }
    }
    return staticContentFor(level, lessonSlug);
  });
}

/** Call after any write to a lesson's Lesson row (admin save, delete, or a
 * reseed) so the next read reflects it immediately instead of waiting out
 * the TTL. */
export function invalidateLessonContentCache(level: string, lessonSlug: string) {
  lessonContentCache.del(lessonContentCacheKey(level, lessonSlug));
}

export type LessonStatus = "custom" | "example" | "empty";

/** Used by /admin/lessons to show, for every (level, lesson) slot, whether
 * it has an admin-authored override, only the bundled example, or nothing. */
export async function getAllLessonStatuses(): Promise<Record<string, LessonStatus>> {
  const customRows = await db.lesson.findMany({ select: { level: true, lessonSlug: true } });
  const customKeys = new Set(customRows.map((row) => `${row.level}-${row.lessonSlug}`));

  const statuses: Record<string, LessonStatus> = {};
  for (const level of levelSlugs) {
    for (const lessonSlug of lessonSlugsFor(level)) {
      const key = `${level}-${lessonSlug}`;
      if (customKeys.has(key)) statuses[key] = "custom";
      else statuses[key] = staticContentFor(level, lessonSlug) ? "example" : "empty";
    }
  }
  return statuses;
}
