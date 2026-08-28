export const levelSlugs = ["a1", "a2", "b1", "b2"] as const;

export type LevelSlug = (typeof levelSlugs)[number];

export function isLevelSlug(value: string): value is LevelSlug {
  return (levelSlugs as readonly string[]).includes(value);
}

interface LevelMeta {
  slug: LevelSlug;
  weeks: number;
  hoursPerWeek: number;
}

export const levelMeta: Record<LevelSlug, LevelMeta> = {
  a1: { slug: "a1", weeks: 8, hoursPerWeek: 3 },
  a2: { slug: "a2", weeks: 10, hoursPerWeek: 3 },
  b1: { slug: "b1", weeks: 12, hoursPerWeek: 4 },
  b2: { slug: "b2", weeks: 14, hoursPerWeek: 4 },
};

// Lesson count differs per level (see the `lessons` arrays in
// src/dictionaries/*.json, which are the source of truth for titles).
// All four levels have been expanded to full 30-lesson TORFL courses.
export const lessonsPerLevel: Record<LevelSlug, number> = {
  a1: 30,
  a2: 30,
  b1: 30,
  b2: 30,
};

export function lessonSlugsFor(level: LevelSlug): string[] {
  return Array.from({ length: lessonsPerLevel[level] }, (_, i) => String(i + 1));
}

export function isLessonSlug(level: string, value: string): boolean {
  if (!isLevelSlug(level)) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= lessonsPerLevel[level];
}

/** The first lesson of every level — fully open, without an active
 * subscription, without even an account. Every other lesson still shows
 * its grammar explanation for free (see [lesson]/page.tsx) but locks
 * vocabulary/exercises/slides behind a subscription; this is the one
 * lesson per level where nothing is locked at all, so a visitor can try
 * the actual exercise/audio mechanic before subscribing. Checked in the
 * lesson page itself and POST /api/progress (saving an attempt), which
 * otherwise enforce the same subscription gate. Kept here rather than in
 * src/lib/entitlement.ts so callers that must stay lean (this used to
 * include src/proxy.ts, before the lesson route's gate moved from a
 * middleware redirect to page-level content locking) don't need that
 * file's auth/subscription import graph just for this one pure check. */
export function isFreeTrialLesson(level: string, lesson: string): boolean {
  return lesson === "1";
}
