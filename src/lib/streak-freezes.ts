import { addDateKeyDays } from "./timezone";

// Streak freezes: a missed day does not have to end a streak.
//
// The rule, as agreed (PROGRESS.md 7.68 → 7.69):
//   - 2 in hand to start, +1 for every 14 studied days in the current
//     chain, never more than 3;
//   - one missed day costs one freeze and the chain survives;
//   - TWO missed days in a row end the chain no matter what is in hand —
//     otherwise the number stops meaning anything;
//   - nothing is ever granted for paying, and nothing is applied to gaps
//     that happened before freezes existed for that learner.
//
// ── Why there is no `balance -= 1` anywhere in this file ──────────────
//
// "Spend retroactively, at read time" is the requirement, and the obvious
// way to write it — load the stored balance, walk the missed days, subtract
// — double-spends the moment the page is rendered twice, or the write
// fails, or two requests race. So the balance is not stored state that gets
// mutated: it is DERIVED, every time, by replaying the activity history
// from a fixed starting point. The same history and the same "today"
// always produce the same balance, so reading N times costs exactly what
// reading once costs. `User.streakFreezesLeft` is written back afterwards
// as a mirror for surfaces that must not run the replay — it is never read
// back into this computation. See streak-freezes.test.ts, which proves both
// halves of that.
//
// The one piece of real stored state is the epoch (`User.streakFreezesSince`).
// Without it the very first read would replay months of pre-feature history
// and hand out freezes for gaps nobody knew were forgivable — rebuilding
// the past, which the owner ruled out. With it, the first read simply
// stamps "freezes start today" and every earlier gap breaks the chain the
// way it always did.

export const INITIAL_STREAK_FREEZES = 2;
export const MAX_STREAK_FREEZES = 3;
/** Studied days in the current chain that earn one more freeze.
 *
 * Was 7 until 31.08.2026, changed to 14 by the owner after the arithmetic
 * was written down: at one grant per seven days, a month of near-daily
 * study earns THREE freezes while three missed days spend three, so earning
 * outran spending and the streak effectively stopped being breakable. At
 * one per fourteen the same month earns one, the budget for the month is
 * three instead of five, and a fourth missed day ends the chain. The test
 * "три дыры за МЕСЯЦ" carries those numbers so that changing this constant
 * has to change a failing assertion. */
export const DAYS_PER_EARNED_FREEZE = 14;

/** How far back the replay is willing to walk from today.
 *
 * The walk is one iteration per calendar day, so a single corrupted key
 * ("0001-01-01" from a bad import, a clock set to 1970) would otherwise
 * spin through 700 000 iterations inside a page render. Ten years is far
 * beyond any real history here — the project itself is weeks old — so this
 * can only ever bound damage, never a legitimate streak. */
export const MAX_REPLAY_DAYS = 3650;

/** What is actually stored on the User row. Both may be null: every row
 * that existed before this shipped reads back null, because
 * ensure-schema-sync adds columns without a DEFAULT. */
export interface FreezeState {
  /** Mirror of the last derived balance. NOT an input to the derivation —
   * see the note at the top of this file. */
  freezesLeft: number | null;
  /** "YYYY-MM-DD" in the learner's zone: the day freezes started applying
   * to this account. Null means "never read yet". */
  freezesSince: string | null;
}

export interface StreakResolution {
  /** Studied days in the live chain. A frozen day keeps the chain alive but
   * does NOT count here — the learner did not study that day, and a counter
   * that says otherwise is lying to them. */
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  activeToday: boolean;
  /** Freezes in hand right now, derived. */
  freezesLeft: number;
  /** Every day a freeze was spent on, oldest first. Shown on the activity
   * heatmap as its own third state, so the learner can see WHICH day was
   * covered rather than just noticing the streak failed to reset. */
  frozenDateKeys: string[];
  /** The epoch this resolution used. Equals `state.freezesSince` when that
   * was set, and today's key when it was null (first ever read). */
  freezesSince: string;
  /** The first studied day of the live chain, or null when there is no live
   * chain. Read-only output of the same single replay — nothing about the
   * freeze rule, the epoch or any stored value depends on it.
   *
   * It exists because "nine flames on the calendar, racha actual: 2 días"
   * is correct and reads as a defect. The page can only explain the gap
   * between those two numbers if it knows WHERE the count starts, and the
   * one place that knows is this walk. Deriving it a second time from the
   * same keys would be a second implementation of the chain rule, which is
   * exactly the duplication this file refuses to have. */
  chainStartedOn: string | null;
  /** The missed day immediately before `chainStartedOn` — the day that ended
   * the previous chain. Null when the chain has never been broken (it runs
   * from the learner's first recorded day) or when there is no live chain.
   *
   * Always a genuinely missed day, never a frozen one: had the day before
   * the chain's start been frozen, the chain would have continued through it
   * and started earlier. */
  brokenOn: string | null;
}

/** Replays the learner's calendar and returns the streak together with the
 * freeze ledger. Pure: same arguments in, same object out, every time.
 *
 * `todayKey` and every key in `activityDateKeys` must already be date keys
 * in the SAME zone — the learner's. Producing them is `dateKeyIn`'s job
 * (src/lib/timezone.ts) and there is deliberately no second implementation
 * of a day boundary in this file; that duplication is the exact defect
 * fixed on 31.08.2026. */
export function resolveStreakWithFreezes(
  activityDateKeys: Iterable<string>,
  todayKey: string,
  state: FreezeState,
): StreakResolution {
  // Clamped so a stored epoch from the future (a wrong clock, a hand-edited
  // row) cannot make the era start after the walk has ended, which would
  // silently disable freezes forever.
  const since = state.freezesSince !== null && state.freezesSince <= todayKey ? state.freezesSince : todayKey;

  const dates = new Set(activityDateKeys);
  const sorted = [...dates].sort();
  const empty: StreakResolution = {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    activeToday: false,
    freezesLeft: INITIAL_STREAK_FREEZES,
    frozenDateKeys: [],
    freezesSince: since,
    chainStartedOn: null,
    brokenOn: null,
  };
  if (sorted.length === 0) return empty;

  const horizon = addDateKeyDays(todayKey, -MAX_REPLAY_DAYS);
  const first = sorted[0] > horizon ? sorted[0] : horizon;
  if (first > todayKey) return empty; // only future-dated rows: nothing to replay

  let balance = 0; // no freezes exist before the epoch
  let eraStarted = false;
  let chain = 0;
  // Studied days of the current chain that fall INSIDE the freeze era, kept
  // apart from `chain` so a grant is never handed out for a run that was
  // finished before freezes existed. Caught by the test "не восстанавливает
  // прошлое": counting grants off `chain` gave a fourteen-day pre-feature
  // run an extra freeze on the very first read, which is rebuilding the
  // past by another route.
  let eraChain = 0;
  let longest = 0;
  let gapRun = 0;
  const frozenDateKeys: string[] = [];
  // The first studied day of whatever chain is currently running. Set when a
  // chain goes from nothing to one day, cleared whenever a chain ends. Purely
  // an observation of the walk: no branch below reads it.
  let chainStartedOn: string | null = null;

  for (let cursor = first; cursor <= todayKey; cursor = addDateKeyDays(cursor, 1)) {
    if (!eraStarted && cursor >= since) {
      eraStarted = true;
      balance = INITIAL_STREAK_FREEZES;
    }

    if (dates.has(cursor)) {
      if (chain === 0) chainStartedOn = cursor;
      chain += 1;
      gapRun = 0;
      if (eraStarted) {
        eraChain += 1;
        if (eraChain % DAYS_PER_EARNED_FREEZE === 0) {
          balance = Math.min(MAX_STREAK_FREEZES, balance + 1);
        }
      }
      if (chain > longest) longest = chain;
      continue;
    }

    // Today is not a missed day: it has not finished yet. This is the same
    // grace the counter has always had — a streak is not broken until a
    // whole day has gone by with nothing done.
    if (cursor === todayKey) continue;

    gapRun += 1;
    if (gapRun >= 2) {
      // Two holes back to back. The chain ends regardless of what is in
      // hand, and the freeze already spent on the first hole is NOT
      // refunded: the learner was shown that balance yesterday, and a
      // number that goes back up on its own is worse than one that was
      // spent for nothing.
      chain = 0;
      eraChain = 0;
      chainStartedOn = null;
    } else if (balance > 0) {
      balance -= 1;
      frozenDateKeys.push(cursor);
    } else {
      chain = 0;
      eraChain = 0;
      chainStartedOn = null;
    }
  }

  return {
    currentStreak: chain,
    longestStreak: longest,
    lastActiveDate: sorted[sorted.length - 1],
    activeToday: dates.has(todayKey),
    freezesLeft: eraStarted ? balance : INITIAL_STREAK_FREEZES,
    frozenDateKeys,
    freezesSince: since,
    chainStartedOn,
    // A chain that starts on the learner's first recorded day was never
    // broken — there is nothing behind it to have broken it. Otherwise the
    // day before it is the one they missed, by construction.
    brokenOn:
      chainStartedOn === null || chainStartedOn === sorted[0] ? null : addDateKeyDays(chainStartedOn, -1),
  };
}

/** What to write back to the User row, or null when nothing changed.
 *
 * The whole persistence story is this function: a write happens on the
 * first read ever (stamping the epoch) and afterwards only when the derived
 * balance actually moved — at most once a day in practice, and never as a
 * side effect of simply looking at the page twice. */
export function nextFreezeRecord(
  state: FreezeState,
  resolution: StreakResolution,
): { streakFreezesLeft: number; streakFreezesSince: string } | null {
  if (state.freezesSince === resolution.freezesSince && state.freezesLeft === resolution.freezesLeft) {
    return null;
  }
  return {
    streakFreezesLeft: resolution.freezesLeft,
    streakFreezesSince: resolution.freezesSince,
  };
}
