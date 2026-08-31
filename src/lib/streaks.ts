import "server-only";
import { db } from "./db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";
import { DEFAULT_TIME_ZONE, addDateKeyDays, dateKeyIn } from "./timezone";

export interface StreakStats {
  /** Consecutive days up to and including today (or yesterday, if today
   * has no activity yet — a streak isn't "broken" until a full day passes
   * with nothing done). */
  currentStreak: number;
  /** Longest run of consecutive active days ever seen, independent of
   * whether the current streak is still alive. */
  longestStreak: number;
  /** Most recent active date, "YYYY-MM-DD", or null if the user has never
   * been active. */
  lastActiveDate: string | null;
  /** Whether today already counts as an active day. */
  activeToday: boolean;
}

/** Pure function over a set of "YYYY-MM-DD" activity date keys, kept
 * separate from the DB fetch below so streak math is unit-testable without
 * a database. `today` is injectable for the same reason.
 *
 * `timeZone` decides where "today" and "yesterday" fall, and it must be the
 * SAME zone the keys themselves were derived in — mixing them (keys in the
 * learner's zone, "today" in UTC) is the bug this parameter exists to
 * prevent, not a knob to tune. */
export function computeStreakStats(
  activityDateKeys: Iterable<string>,
  today: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): StreakStats {
  const dates = new Set(activityDateKeys);
  if (dates.size === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, activeToday: false };
  }

  // ISO "YYYY-MM-DD" keys sort chronologically as plain strings.
  const sorted = [...dates].sort();

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDateKeyDays(sorted[i - 1], 1) ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const todayKey = dateKeyIn(today, timeZone);
  const activeToday = dates.has(todayKey);
  const yesterdayKey = addDateKeyDays(todayKey, -1);

  // A streak that hasn't been extended today is still "alive" through the
  // end of today as long as yesterday was active; it only resets to 0 once
  // a full day passes with no activity at all.
  let cursor: string | null = activeToday ? todayKey : dates.has(yesterdayKey) ? yesterdayKey : null;

  let currentStreak = 0;
  while (cursor !== null && dates.has(cursor)) {
    currentStreak += 1;
    cursor = addDateKeyDays(cursor, -1);
  }

  return { currentStreak, longestStreak, lastActiveDate: sorted[sorted.length - 1], activeToday };
}

/** Derives the user's activity streak from the progress tables the app
 * already writes to — no dedicated activity-log table exists yet, so this
 * is a best-effort proxy, not a full history.
 *
 * Five sources, and the last two were added 31.08.2026: a finished word
 * game and a submitted exam are study, and leaving them out meant a day
 * spent entirely on either left no trace in the counter at all. (Measured
 * on the owner's own rows: an exam on 11.08 and word games on 19–20.08 sat
 * in the database while the streak ignored them.)
 *
 * Caveat that remains: every one of these tables is upserted (one row per
 * lesson/card/story/puzzle, not one row per attempt), so only the MOST
 * RECENT touch of each item is kept. A day where the user revisits only
 * items they'd already touched on a later day leaves no trace here — its
 * timestamp gets overwritten. Measured on the owner's account: 47 of 410
 * flashcard rows were created on one day and last touched on another, and
 * five days survive on a single row each; no day was lost outright, but
 * nothing guarantees that. A proper fix needs a dedicated daily-activity
 * table — out of scope until schema changes for it are agreed. */
// This does 5 full-table scans over every progress row a user has ever
// touched — genuinely expensive for a long-tenured, active user, and
// called on *every* progress-affecting write (via awardBadgesSafely) as
// well as every /profile render. A 60s TTL absorbs repeated reads within
// that window (e.g. several exercise checks in one lesson, or a
// badge-eval-then-profile-view sequence) without ever letting the streak
// be more than ~60s stale — harmless for a display stat that isn't used
// for anything security-sensitive, and streak-crossing badges (see
// badges/index.ts) only ever need to fire once, not instantly.
// Cached as raw date keys, not the derived StreakStats, so the /profile
// activity heatmap can reuse the exact activity signal the streak is
// computed from, instead of inventing a second notion of "activity."
// The cache key carries the time zone: the same user's keys are DIFFERENT
// strings in two zones, and a shared entry would hand one zone's keys to
// the other for up to 60s.
const activityDateKeysCache = getOrCreateGlobalSingleton(
  "activityDateKeysCache",
  () => new TtlCache<string[]>(60_000, "activity-date-keys", Array.isArray)
);

/** The instant a flashcard row last represents.
 *
 * `lastSeenAt` is written only by the recall/typing trainer; the ordinary
 * flip-card buttons touch `updatedAt` alone. Reading `lastSeenAt ?? updatedAt`
 * therefore preferred a STALE timestamp on any card that had been through
 * the trainer once and been flipped since — 18 of 415 rows in the copy of
 * production measured on 31.08.2026 — hiding the newer activity. Whichever
 * is later is the honest answer. */
function flashcardTouchedAt(row: { lastSeenAt: Date | null; updatedAt: Date }): Date {
  if (!row.lastSeenAt) return row.updatedAt;
  return row.lastSeenAt > row.updatedAt ? row.lastSeenAt : row.updatedAt;
}

async function fetchActivityDateKeys(userId: string, timeZone: string): Promise<string[]> {
  return cached(activityDateKeysCache, `${userId}|${timeZone}`, async () => {
    const [lessonRows, flashcardRows, storyRows, wordGameRows, examRows] = await Promise.all([
      db.lessonProgress.findMany({ where: { userId }, select: { completedAt: true } }),
      db.flashcardProgress.findMany({ where: { userId }, select: { lastSeenAt: true, updatedAt: true } }),
      db.storyReadingProgress.findMany({ where: { userId }, select: { updatedAt: true } }),
      db.wordGameProgress.findMany({ where: { userId }, select: { completedAt: true } }),
      db.examAttempt.findMany({ where: { userId }, select: { completedAt: true } }),
    ]);

    const activityDateKeys = new Set<string>();
    for (const row of lessonRows) activityDateKeys.add(dateKeyIn(row.completedAt, timeZone));
    for (const row of flashcardRows) activityDateKeys.add(dateKeyIn(flashcardTouchedAt(row), timeZone));
    for (const row of storyRows) activityDateKeys.add(dateKeyIn(row.updatedAt, timeZone));
    for (const row of wordGameRows) activityDateKeys.add(dateKeyIn(row.completedAt, timeZone));
    for (const row of examRows) activityDateKeys.add(dateKeyIn(row.completedAt, timeZone));

    return [...activityDateKeys];
  });
}

export async function getUserStreakStats(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<StreakStats> {
  const activityDateKeys = await fetchActivityDateKeys(userId, timeZone);
  return computeStreakStats(activityDateKeys, new Date(), timeZone);
}

/** Raw "YYYY-MM-DD" activity date keys, for the /profile activity heatmap.
 * Not a new metric — the same signal getUserStreakStats already derives
 * currentStreak/longestStreak from, just returned before aggregation. */
export async function getUserActivityDateKeys(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<string[]> {
  return fetchActivityDateKeys(userId, timeZone);
}
