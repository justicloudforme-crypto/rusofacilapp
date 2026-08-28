import { levelSlugs, type LevelSlug } from "@/lib/courses";

/**
 * Story.level and MediaItem.level are stored uppercase ("A1"-"C1"), while
 * course levels (src/lib/courses.ts) are lowercase ("a1"-"b2") and stop at
 * B2 (no C1 course exists). Every cross-link between stories/media and
 * lessons has to cross this casing boundary, and courses.ts's own
 * `levelSlugs` is the one place that already enumerates which levels have
 * a course at all — so this is the single place that does both the case
 * fold and the "does a course exist for this" check, instead of each call
 * site repeating `.toLowerCase()` and hoping it remembers C1 has no course.
 */
export function normalizeLevel(level: string): LevelSlug | null {
  const lower = level.toLowerCase();
  return (levelSlugs as readonly string[]).includes(lower) ? (lower as LevelSlug) : null;
}
