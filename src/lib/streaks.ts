import "server-only";
import { db } from "./db";

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

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, delta: number): string {
  return toDateKey(new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + delta * DAY_MS));
}

/** Pure function over a set of "YYYY-MM-DD" activity date keys, kept
 * separate from the DB fetch below so streak math is unit-testable without
 * a database. `today` is injectable for the same reason. */
export function computeStreakStats(
  activityDateKeys: Iterable<string>,
  today: Date = new Date(),
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
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  const todayKey = toDateKey(today);
  const activeToday = dates.has(todayKey);
  const yesterdayKey = addDays(todayKey, -1);

  // A streak that hasn't been extended today is still "alive" through the
  // end of today as long as yesterday was active; it only resets to 0 once
  // a full day passes with no activity at all.
  let cursor: string | null = activeToday ? todayKey : dates.has(yesterdayKey) ? yesterdayKey : null;

  let currentStreak = 0;
  while (cursor !== null && dates.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, longestStreak, lastActiveDate: sorted[sorted.length - 1], activeToday };
}

/** Derives the user's activity streak from the progress tables the app
 * already writes to (LessonProgress, FlashcardProgress, StoryReadingProgress)
 * — no dedicated activity-log table exists yet, so this is a best-effort
 * proxy, not a full history.
 *
 * Caveat: LessonProgress/FlashcardProgress/StoryReadingProgress are all
 * upserted (one row per lesson/card/story, not one row per attempt), so
 * only the MOST RECENT touch of each item is kept. A day where the user
 * revisits only items they'd already touched on a later day leaves no
 * trace here — its timestamp gets overwritten. In practice this
 * undercounts only the (rare) case where every single item touched on a
 * given day is later re-touched again before the streak is read; normal
 * daily use (any new lesson, new card review, or story progress) keeps
 * that day's date key alive. A proper fix needs a dedicated
 * daily-activity table — out of scope until schema changes are allowed. */
export async function getUserStreakStats(userId: string): Promise<StreakStats> {
  const [lessonRows, flashcardRows, storyRows] = await Promise.all([
    db.lessonProgress.findMany({ where: { userId }, select: { completedAt: true } }),
    db.flashcardProgress.findMany({ where: { userId }, select: { lastSeenAt: true, updatedAt: true } }),
    db.storyReadingProgress.findMany({ where: { userId }, select: { updatedAt: true } }),
  ]);

  const activityDateKeys = new Set<string>();
  for (const row of lessonRows) activityDateKeys.add(toDateKey(row.completedAt));
  for (const row of flashcardRows) activityDateKeys.add(toDateKey(row.lastSeenAt ?? row.updatedAt));
  for (const row of storyRows) activityDateKeys.add(toDateKey(row.updatedAt));

  return computeStreakStats(activityDateKeys);
}
