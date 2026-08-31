import "server-only";
import { getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";

// The cache of a learner's activity date keys, in its own file so that both
// the reader (streaks.ts) and the writer (study-day.ts) can reach it
// without importing each other. streaks.ts already imports study-day.ts;
// putting the invalidation on streaks.ts would close that into a cycle.
//
// The 60s TTL absorbs repeated reads within one page load and one
// badge-evaluation pass — this is read on every /profile render AND on
// every progress-affecting write (via awardBadgesSafely), and computing it
// costs six full-table scans of a learner's whole history.
//
// The key carries the ZONE as well as the user: the same learner's keys are
// different strings in two zones, and a shared entry would hand one zone's
// calendar to the other for up to a minute.
export const activityDateKeysCache = getOrCreateGlobalSingleton(
  "activityDateKeysCache",
  () => new TtlCache<string[]>(60_000, "activity-date-keys", Array.isArray),
);

export function activityCacheKey(userId: string, timeZone: string): string {
  return `${userId}|${timeZone}`;
}

/** Drops the cached day list so the very next read sees a day that was just
 * marked.
 *
 * Without this the streak would be up to 60 seconds behind the learner:
 * they open their first lesson of the day, the flame does not light, and
 * the obvious conclusion is that opening a lesson still does not count —
 * which is the exact complaint this whole change set exists to answer. A
 * day mark happens at most once a day per learner, so invalidating on it
 * costs nothing.
 *
 * Zone-scoped because the key is. That is correct rather than partial: the
 * zone passed here is the one the mark was written in, i.e. the learner's
 * own, and it is the entry their own pages read. */
export async function invalidateActivityDateKeys(userId: string, timeZone: string): Promise<void> {
  await activityDateKeysCache.del(activityCacheKey(userId, timeZone));
}
