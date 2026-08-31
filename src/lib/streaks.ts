import "server-only";
import { db } from "./db";
import { cached } from "./ttl-cache";
import { activityCacheKey, activityDateKeysCache } from "./activity-cache";
import { DEFAULT_TIME_ZONE, dateKeyIn } from "./timezone";
import { getStudyDayKeys } from "./study-day";
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

/** Every calendar day this learner has been active on, in their own zone.
 *
 * SIX sources, and they are not equivalent. The first is the day mark
 * (StudyDay): one row per learner per day, written when they OPEN a lesson,
 * a story, a game, the cards or an exam. The other five are the progress
 * tables, which record a RESULT — an exercise checked, a card answered, a
 * page turned, a puzzle finished, an exam submitted.
 *
 * Until 31.08.2026 there were only the five, and that was the owner's
 * complaint: a day spent studying without finishing anything did not exist
 * for the counter. The day mark is the fix; the five stay because they hold
 * every day from before it existed, and they are the only record of those.
 *
 * The old caveat still applies to the five and NOT to the mark. Each of
 * those tables is upserted — one row per lesson/card/story/puzzle, not per
 * attempt — so only the most recent touch of an item survives, and a day
 * spent revisiting items later touched again leaves no trace. Measured on
 * the owner's account: 47 of 410 flashcard rows were created on one day and
 * last touched on another. StudyDay does not have this problem: its row is
 * the day itself, and nothing overwrites it. Days from before the mark
 * shipped keep the caveat forever — they cannot be rebuilt. */


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
  return cached(activityDateKeysCache, activityCacheKey(userId, timeZone), async () => {
    const [studyDayKeys, lessonRows, flashcardRows, storyRows, wordGameRows, examRows] = await Promise.all([
      // The explicit day mark (src/lib/study-day.ts) — the only source here
      // that records the learner having STUDIED rather than having finished
      // something. It is a first-class source, not a replacement: the five
      // below still carry every day from before the mark existed, and
      // deleting them would erase that history.
      //
      // These keys are already date keys, built in the learner's zone at
      // the moment they were marked, so they are NOT re-derived here. The
      // consequence, stated rather than hidden: a learner who moves zone
      // keeps their old days on the old calendar. Re-deriving them is not
      // possible — the instant is deliberately not stored — and guessing
      // would be worse than a day that sits where the learner was standing.
      getStudyDayKeys(userId),
      db.lessonProgress.findMany({ where: { userId }, select: { completedAt: true } }),
      db.flashcardProgress.findMany({ where: { userId }, select: { lastSeenAt: true, updatedAt: true } }),
      db.storyReadingProgress.findMany({ where: { userId }, select: { updatedAt: true } }),
      db.wordGameProgress.findMany({ where: { userId }, select: { completedAt: true } }),
      db.examAttempt.findMany({ where: { userId }, select: { completedAt: true } }),
    ]);

    const activityDateKeys = new Set<string>(studyDayKeys);
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
