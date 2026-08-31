import "server-only";
import { db } from "./db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";
import { DEFAULT_TIME_ZONE, dateKeyIn } from "./timezone";
import {
  INITIAL_STREAK_FREEZES,
  nextFreezeRecord,
  resolveStreakWithFreezes,
  type FreezeState,
} from "./streak-freezes";

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
  /** Streak freezes in hand, derived (src/lib/streak-freezes.ts). */
  freezesLeft: number;
  /** Days a freeze was spent on — what the activity heatmap paints as its
   * own third state so a saved day is visible, not silent. */
  frozenDateKeys: string[];
}

/** The streak with no freezes at all — the behaviour every account had
 * before 31.08.2026, kept as a named entry point because it is exactly what
 * an account with no freeze state must still do.
 *
 * Not a second implementation: it calls the one replay in
 * streak-freezes.ts with a null epoch, which means freezes start today and
 * therefore no past gap is ever forgiven. Its own test file
 * (streaks.test.ts) is thereby also a regression guard on the freeze
 * machinery — if the replay ever started forgiving history, those cases
 * would fail. */
export function computeStreakStats(
  activityDateKeys: Iterable<string>,
  today: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): StreakStats {
  return statsFrom(activityDateKeys, dateKeyIn(today, timeZone), {
    freezesLeft: null,
    freezesSince: null,
  });
}

function statsFrom(
  activityDateKeys: Iterable<string>,
  todayKey: string,
  freezeState: FreezeState,
): StreakStats {
  const resolution = resolveStreakWithFreezes(activityDateKeys, todayKey, freezeState);
  return {
    currentStreak: resolution.currentStreak,
    longestStreak: resolution.longestStreak,
    lastActiveDate: resolution.lastActiveDate,
    activeToday: resolution.activeToday,
    freezesLeft: resolution.freezesLeft,
    frozenDateKeys: resolution.frozenDateKeys,
  };
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

/** Freeze state as it sits on the User row. Every caller already has the
 * row (getCurrentUser returns it whole), so this is a shape, not a fetch. */
export interface UserFreezeColumns {
  streakFreezesLeft?: number | null;
  streakFreezesSince?: string | null;
}

function freezeStateOf(user: UserFreezeColumns | null | undefined): FreezeState {
  return {
    freezesLeft: user?.streakFreezesLeft ?? null,
    freezesSince: user?.streakFreezesSince ?? null,
  };
}

export async function getUserStreakStats(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  user?: UserFreezeColumns | null,
): Promise<StreakStats> {
  const activityDateKeys = await fetchActivityDateKeys(userId, timeZone);
  return statsFrom(activityDateKeys, dateKeyIn(new Date(), timeZone), freezeStateOf(user));
}

/** Writes the freeze mirror and the epoch back, and ONLY when one of them
 * actually moved — see nextFreezeRecord.
 *
 * Reading the streak must not cost a write. In practice this fires once per
 * account ever (stamping the epoch) and then at most once on any day the
 * balance changes; rendering the same page twice writes nothing, which is
 * the property streak-freezes.test.ts proves directly.
 *
 * Fail-soft on purpose: this is bookkeeping behind a display number, and it
 * runs inside after(). A failed write means the next read derives the same
 * answer again and tries again — never a broken page. */
export async function persistFreezeState(
  userId: string,
  user: UserFreezeColumns | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<void> {
  try {
    const activityDateKeys = await fetchActivityDateKeys(userId, timeZone);
    const state = freezeStateOf(user);
    const resolution = resolveStreakWithFreezes(
      activityDateKeys,
      dateKeyIn(new Date(), timeZone),
      state,
    );
    const record = nextFreezeRecord(state, resolution);
    if (!record) return;
    await db.user.update({ where: { id: userId }, data: record });
  } catch (error) {
    console.error("persistFreezeState failed", error);
  }
}

/** The starting grant, re-exported so a surface that has no streak in hand
 * (a brand-new account) can still show the right number. */
export { INITIAL_STREAK_FREEZES };

/** Raw "YYYY-MM-DD" activity date keys, for the /profile activity heatmap.
 * Not a new metric — the same signal getUserStreakStats already derives
 * currentStreak/longestStreak from, just returned before aggregation. */
export async function getUserActivityDateKeys(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<string[]> {
  return fetchActivityDateKeys(userId, timeZone);
}
