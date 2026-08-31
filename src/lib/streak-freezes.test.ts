import { describe, expect, it } from "vitest";
import {
  DAYS_PER_EARNED_FREEZE,
  INITIAL_STREAK_FREEZES,
  MAX_STREAK_FREEZES,
  nextFreezeRecord,
  resolveStreakWithFreezes,
  type FreezeState,
} from "./streak-freezes";
import { addDateKeyDays, dateKeyIn } from "./timezone";

// Positive control for the streak freezes (PROGRESS.md 7.69).
//
// Repo rule 4.1: a check that answers "correct" proves nothing until it has
// been shown to catch the defect. Here the "defect" is the absence of the
// feature, so every case runs the same input through two implementations:
//
//   noFreezes(...) — the streak exactly as it behaved before freezes
//   existed: one missed day and the chain is over. It is not a copy of
//   anything; it is the shipped resolver called with a null epoch, which
//   makes freezes start today and so forgives nothing in the past. That is
//   the same code path an account with no freeze state takes in
//   production, which is why the "old row with nulls" case below is a
//   one-liner rather than a mock.
//
//   withFreezes(...) — the same resolver with a real epoch.
//
// Each case asserts BOTH answers. Delete the withFreezes half and the
// assertions on noFreezes still hold; delete the noFreezes half and the
// tests stop being able to tell a working freeze from a no-op.

const TODAY = "2026-09-30";

/** Builds a set of activity keys from an offsets-from-today list, so the
 * fixtures read as "5 days ago, 4 days ago, …" instead of as dates. */
const daysAgo = (...offsets: number[]) => offsets.map((n) => addDateKeyDays(TODAY, -n));

/** A run of consecutive days ending `endOffset` days before today. */
const run = (length: number, endOffset: number) =>
  Array.from({ length }, (_, i) => addDateKeyDays(TODAY, -(endOffset + length - 1 - i)));

/** An epoch far enough back that every fixture below sits inside the freeze
 * era. Real accounts get today's key stamped on their first read. */
const LONG_AGO: FreezeState = { freezesLeft: null, freezesSince: "2026-01-01" };
const NEVER_READ: FreezeState = { freezesLeft: null, freezesSince: null };

const withFreezes = (keys: string[], state: FreezeState = LONG_AGO) =>
  resolveStreakWithFreezes(keys, TODAY, state);

/** The pre-feature behaviour: epoch = today, so no past gap is forgiven. */
const noFreezes = (keys: string[]) => resolveStreakWithFreezes(keys, TODAY, NEVER_READ);

describe("streak freezes — spending", () => {
  it("одна дыра при остатке > 0: серия продолжается, остаток минус один", () => {
    // Studied 5, 4, 2, 1 and 0 days ago. The hole is 3 days ago.
    const keys = daysAgo(5, 4, 2, 1, 0);

    const before = noFreezes(keys);
    expect(before.currentStreak).toBe(3); // ← the chain died at the hole
    expect(before.frozenDateKeys).toEqual([]);

    const after = withFreezes(keys);
    expect(after.currentStreak).toBe(5); // all five studied days, chain intact
    expect(after.freezesLeft).toBe(INITIAL_STREAK_FREEZES - 1);
    expect(after.frozenDateKeys).toEqual(daysAgo(3));
  });

  it("одна дыра при остатке 0: серия рвётся", () => {
    // Three holes, spread out. The first two eat both freezes, the third
    // finds an empty pocket.
    const keys = daysAgo(9, 8, 6, 5, 3, 1, 0);
    //                        ^7      ^4      ^2   ← the three holes

    const after = withFreezes(keys);
    expect(after.freezesLeft).toBe(0);
    expect(after.frozenDateKeys).toEqual(daysAgo(7, 4));
    // The hole 2 days ago is NOT in the frozen list and did break the chain:
    // only "yesterday" and "today" survive it.
    expect(after.frozenDateKeys).not.toContain(addDateKeyDays(TODAY, -2));
    expect(after.currentStreak).toBe(2);

    // And the control: with no freezes at all the same input stops at the
    // same place, which is precisely why this case has to be checked —
    // "streak 2" alone would not tell the two implementations apart.
    expect(noFreezes(keys).currentStreak).toBe(2);
    expect(noFreezes(keys).freezesLeft).toBe(INITIAL_STREAK_FREEZES); // never spent
    expect(after.freezesLeft).not.toBe(noFreezes(keys).freezesLeft);
  });

  it("две дыры подряд рвут серию при любом остатке", () => {
    // A full balance, and a two-day hole 4 and 3 days ago.
    const keys = daysAgo(8, 7, 6, 5, 2, 1, 0);

    const after = withFreezes(keys);
    expect(after.currentStreak).toBe(3); // only the days after the hole
    // The first of the two days still cost a freeze — it was spent before
    // the second day existed, and a balance that refunds itself is worse
    // than one spent for nothing.
    expect(after.freezesLeft).toBe(INITIAL_STREAK_FREEZES - 1);
    expect(after.frozenDateKeys).toEqual(daysAgo(4));

    // Same streak as with no freezes at all — the rule holds.
    expect(noFreezes(keys).currentStreak).toBe(3);

    // The control that this case is not vacuous: ONE hole in the same
    // position would have been survived.
    const oneHole = daysAgo(8, 7, 6, 5, 3, 2, 1, 0);
    expect(withFreezes(oneHole).currentStreak).toBe(8);
    expect(noFreezes(oneHole).currentStreak).toBe(4);
  });

  it("14 дней подряд — остаток плюс один, но не выше 3", () => {
    // The interval was 7 until 31.08.2026 and is 14 now. Pinned here as a
    // number as well as read from the constant, so that changing the rule
    // has to come here and say so.
    expect(DAYS_PER_EARNED_FREEZE).toBe(14);

    const fourteen = run(DAYS_PER_EARNED_FREEZE, 0);
    expect(withFreezes(fourteen).currentStreak).toBe(14);
    expect(withFreezes(fourteen).freezesLeft).toBe(INITIAL_STREAK_FREEZES + 1);

    // Thirteen is not enough — and seven, which used to be, is not either.
    expect(withFreezes(run(13, 0)).freezesLeft).toBe(INITIAL_STREAK_FREEZES);
    expect(withFreezes(run(7, 0)).freezesLeft).toBe(INITIAL_STREAK_FREEZES);

    // Twenty-eight would be +2, but the cap holds.
    const twentyEight = run(28, 0);
    expect(withFreezes(twentyEight).currentStreak).toBe(28);
    expect(withFreezes(twentyEight).freezesLeft).toBe(MAX_STREAK_FREEZES);
    expect(INITIAL_STREAK_FREEZES + 2).toBeGreaterThan(MAX_STREAK_FREEZES); // the cap is doing work

    // Fifty-six days: four grants, still capped.
    expect(withFreezes(run(56, 0)).freezesLeft).toBe(MAX_STREAK_FREEZES);

    // Control: without the era, none of this is earned.
    expect(noFreezes(twentyEight).freezesLeft).toBe(INITIAL_STREAK_FREEZES);
  });

  it("три дыры вразбивку при остатке 2 — третья рвёт", () => {
    // Studied 8, 6, 4 days ago and the last three days; holes at 7, 5 and 3.
    // The runs between the holes are one day each on purpose: the chain
    // never reaches seven, so no grant refills the balance and the third
    // hole really does meet an empty pocket.
    const keys = daysAgo(8, 6, 4, 2, 1, 0);

    const after = withFreezes(keys);
    expect(after.frozenDateKeys).toEqual(daysAgo(7, 5));
    expect(after.freezesLeft).toBe(0);
    // The third hole (3 days ago) broke it: only the three days since.
    expect(after.currentStreak).toBe(3);
    // ...and it really was the third, not an off-by-one: the chain it ended
    // had run from the first day through both frozen days.
    expect(after.longestStreak).toBe(3);

    const before = noFreezes(keys);
    expect(before.currentStreak).toBe(3);
    expect(before.frozenDateKeys).toEqual([]);
    // Deliberately spelled out: the two implementations agree on the streak
    // NUMBER here and differ only on the ledger. That is the whole point of
    // the case — by the third hole the freezes have run out, so a working
    // implementation and a missing one converge, and the only evidence the
    // feature ran at all is which days it paid for.
    expect(before.currentStreak).toBe(after.currentStreak);
    expect(before.freezesLeft).not.toBe(after.freezesLeft);
    expect(before.frozenDateKeys).not.toEqual(after.frozenDateKeys);
  });

  it("три дыры за МЕСЯЦ третья не рвёт, но запас уходит в ноль — и четвёртая рвёт", () => {
    // Recomputed 31.08.2026 for the new interval. Under the old rule (one
    // grant per SEVEN days) a month of near-daily study earned three
    // freezes while three holes spent three: earning outran spending, the
    // learner finished the month with the same two in hand they started
    // with, and the chain had become effectively unbreakable. That is the
    // reason the owner moved the interval to fourteen.
    //
    // Under the new rule the same month earns ONE. Three holes are still
    // survived — the budget for the month is 2 + 1 = 3 — but the balance
    // ends at zero instead of two, which is the whole point: the next miss
    // costs the streak. The case below and the four-hole case after it are
    // the two halves of that statement.
    //
    // 25 days of history, single-day holes 20, 12 and 4 days ago.
    const holes = [20, 12, 4];
    const keys = Array.from({ length: 25 }, (_, i) => 24 - i)
      .filter((offset) => !holes.includes(offset))
      .map((offset) => addDateKeyDays(TODAY, -offset));

    const after = withFreezes(keys);
    expect(after.frozenDateKeys).toEqual(daysAgo(20, 12, 4)); // all three survived
    expect(after.currentStreak).toBe(22); // unbroken across the whole month
    // 2 to start, ONE grant earned at day 14 of the chain, three spent on
    // the holes. Under the old rule this line read `toBe(2)`.
    expect(after.freezesLeft).toBe(0);

    // The control that the grant is what did it: with the grant rule
    // switched off there would be nothing left after the second hole. The
    // no-freeze run shows the same history torn into short pieces.
    const before = noFreezes(keys);
    expect(before.currentStreak).toBe(4);
    expect(before.longestStreak).toBe(7);
  });

  it("четвёртая дыра за тот же месяц рвёт серию — новое правило кусается", () => {
    // The same month with a fourth single-day hole. Three are covered, the
    // fourth meets an empty balance and ends the chain.
    //
    // Under the OLD rule (one per seven) this same history earned four
    // grants and all four holes survived with a streak of 21 — which is
    // exactly the complaint: at some point the counter stopped being able
    // to go wrong.
    const holes = [20, 12, 8, 4];
    const keys = Array.from({ length: 25 }, (_, i) => 24 - i)
      .filter((offset) => !holes.includes(offset))
      .map((offset) => addDateKeyDays(TODAY, -offset));

    const after = withFreezes(keys);
    expect(after.frozenDateKeys).toEqual(daysAgo(20, 12, 8)); // the first three
    expect(after.frozenDateKeys).not.toContain(addDateKeyDays(TODAY, -4));
    expect(after.freezesLeft).toBe(0);
    expect(after.currentStreak).toBe(4); // only the days since the fourth hole

    // Control: the same four holes with freezes switched off leave the
    // chain even shorter, so "4" is not simply what a broken feature
    // returns.
    expect(noFreezes(keys).currentStreak).toBe(4);
    expect(noFreezes(keys).longestStreak).toBe(7);
    expect(noFreezes(keys).frozenDateKeys).toEqual([]);
    expect(after.frozenDateKeys).not.toEqual(noFreezes(keys).frozenDateKeys);
  });

  it("пользователь без заморозок вообще (старая строка с null) ведёт себя как раньше", () => {
    // Every row that existed before this shipped reads back
    // { streakFreezesLeft: null, streakFreezesSince: null }, because
    // ensure-schema-sync adds columns without a DEFAULT.
    const keys = daysAgo(5, 4, 2, 1, 0);
    const old = resolveStreakWithFreezes(keys, TODAY, NEVER_READ);

    expect(old.currentStreak).toBe(3); // the hole broke it, exactly as before
    expect(old.frozenDateKeys).toEqual([]);
    // The starting grant is shown, not spent: freezes begin today.
    expect(old.freezesLeft).toBe(INITIAL_STREAK_FREEZES);
    expect(old.freezesSince).toBe(TODAY);

    // A stored balance is never fed back in — an old row claiming three
    // freezes gets the same answer as one claiming none.
    const lying: FreezeState = { freezesLeft: 3, freezesSince: null };
    expect(resolveStreakWithFreezes(keys, TODAY, lying)).toEqual(old);
  });

  it("не восстанавливает прошлое: гэпы до эпохи не прощаются", () => {
    // The learner missed a day 5 days ago; freezes only started 3 days ago.
    const keys = daysAgo(6, 5 - 1, 3, 2, 1, 0).filter((k) => k !== addDateKeyDays(TODAY, -5));
    const state: FreezeState = { freezesLeft: null, freezesSince: addDateKeyDays(TODAY, -3) };
    const r = resolveStreakWithFreezes(keys, TODAY, state);
    expect(r.frozenDateKeys).toEqual([]);
    expect(r.freezesLeft).toBe(INITIAL_STREAK_FREEZES); // nothing was spent on the past
  });
});

describe("streak freezes — the day boundary comes from timezone.ts only", () => {
  it("дыра на границе часовых поясов: одна метка времени, разный исход", () => {
    // One single instant of study, and two learners looking at it. There is
    // no second day-boundary implementation in streak-freezes.ts on
    // purpose — the keys are built by dateKeyIn, which is the fix from
    // 31.08.2026. Feeding the same instant through two zones therefore has
    // to move the day, and moving the day has to move the streak.
    const studied = new Date("2026-09-28T05:00:00.000Z");
    const now = new Date("2026-09-30T05:00:00.000Z");

    const AUCKLAND = "Pacific/Auckland"; // UTC+12 in September
    const TIJUANA = "America/Tijuana"; // UTC-7

    // In Auckland that instant is the 28th at 17:00 and "now" is the 30th
    // at 17:00 — a one-day hole, bridgeable.
    expect(dateKeyIn(studied, AUCKLAND)).toBe("2026-09-28");
    expect(dateKeyIn(now, AUCKLAND)).toBe("2026-09-30");

    // In Tijuana the same instant is the 27th at 22:00 and "now" is the
    // 29th at 22:00 — also one day apart, so add a second, earlier study
    // instant to make the two learners diverge on the SAME data.
    expect(dateKeyIn(studied, TIJUANA)).toBe("2026-09-27");
    expect(dateKeyIn(now, TIJUANA)).toBe("2026-09-29");

    // The shared history: two instants, three hours apart across midnight.
    const instants = [new Date("2026-09-28T05:00:00.000Z"), new Date("2026-09-28T08:00:00.000Z")];

    const nz = instants.map((d) => dateKeyIn(d, AUCKLAND));
    const mx = instants.map((d) => dateKeyIn(d, TIJUANA));
    // 17:00 and 20:00 on the 28th — one day.
    expect(nz).toEqual(["2026-09-28", "2026-09-28"]);
    // 22:00 on the 27th and 01:00 on the 28th — two days.
    expect(mx).toEqual(["2026-09-27", "2026-09-28"]);

    const nzResult = resolveStreakWithFreezes(nz, dateKeyIn(now, AUCKLAND), LONG_AGO);
    const mxResult = resolveStreakWithFreezes(mx, dateKeyIn(now, TIJUANA), LONG_AGO);

    // Auckland: one studied day, then a hole (the 29th), then today with
    // nothing yet. The freeze bridges the hole, so the chain is 1 and a
    // freeze is gone.
    expect(nzResult.currentStreak).toBe(1);
    expect(nzResult.frozenDateKeys).toEqual(["2026-09-29"]);
    expect(nzResult.freezesLeft).toBe(INITIAL_STREAK_FREEZES - 1);

    // Tijuana: two studied days ending yesterday, no hole at all — nothing
    // to freeze, and the chain is 2.
    expect(mxResult.currentStreak).toBe(2);
    expect(mxResult.frozenDateKeys).toEqual([]);
    expect(mxResult.freezesLeft).toBe(INITIAL_STREAK_FREEZES);

    // The point of the case, in one line: same instants, different answer.
    expect(nzResult.currentStreak).not.toBe(mxResult.currentStreak);
    expect(nzResult.freezesLeft).not.toBe(mxResult.freezesLeft);
  });
});

describe("streak freezes — spending is idempotent", () => {
  // The main risk of "spend retroactively at read time": rendering the page
  // twice charges twice. It cannot happen here because nothing is
  // subtracted from stored state — the balance is re-derived from the
  // history every time, and the stored number is a mirror that is never an
  // input. These four cases prove exactly that, in the order the failure
  // would actually appear.

  const keys = daysAgo(6, 5, 3, 2, 1, 0); // one hole, 4 days ago

  it("два чтения подряд дают один и тот же ответ", () => {
    const first = withFreezes(keys);
    const second = withFreezes(keys);
    expect(second).toEqual(first);
    expect(first.freezesLeft).toBe(INITIAL_STREAK_FREEZES - 1);
  });

  it("десять чтений подряд не съедают десять заморозок", () => {
    const results = Array.from({ length: 10 }, () => withFreezes(keys));
    expect(new Set(results.map((r) => r.freezesLeft))).toEqual(new Set([INITIAL_STREAK_FREEZES - 1]));
  });

  it("чтение ПОСЛЕ записи не тратит второй раз — запись возвращает null", () => {
    // Read 1: nothing stored yet for this account beyond the epoch.
    const stored: FreezeState = { freezesLeft: null, freezesSince: "2026-01-01" };
    const first = withFreezes(keys, stored);
    const write = nextFreezeRecord(stored, first);
    expect(write).toEqual({ streakFreezesLeft: 1, streakFreezesSince: "2026-01-01" });

    // The row now holds what was written.
    const afterWrite: FreezeState = {
      freezesLeft: write!.streakFreezesLeft,
      freezesSince: write!.streakFreezesSince,
    };

    // Read 2, same day, same history: same answer, and NOTHING to write.
    const second = withFreezes(keys, afterWrite);
    expect(second.freezesLeft).toBe(first.freezesLeft);
    expect(second.frozenDateKeys).toEqual(first.frozenDateKeys);
    expect(nextFreezeRecord(afterWrite, second)).toBeNull();

    // Read 3, for good measure.
    expect(nextFreezeRecord(afterWrite, withFreezes(keys, afterWrite))).toBeNull();
  });

  it("контроль: если бы остаток был ВХОДОМ, второе чтение списало бы ещё раз", () => {
    // The bug this design avoids, written out so the test can show it. This
    // is what "load the balance, subtract the misses, save" does on the
    // second render.
    const naiveSpend = (balance: number, holes: number) => Math.max(0, balance - holes);
    let balance: number = INITIAL_STREAK_FREEZES;
    balance = naiveSpend(balance, 1); // render 1
    balance = naiveSpend(balance, 1); // render 2 — charged again
    expect(balance).toBe(0);

    // The shipped resolver, given the same two renders, does not.
    expect(withFreezes(keys).freezesLeft).toBe(1);
    expect(withFreezes(keys).freezesLeft).toBe(1);
    expect(balance).not.toBe(withFreezes(keys).freezesLeft);
  });

  it("первое чтение штампует эпоху сегодняшним днём, второе ничего не пишет", () => {
    const fresh: FreezeState = { freezesLeft: null, freezesSince: null };
    const first = resolveStreakWithFreezes(keys, TODAY, fresh);
    expect(first.freezesSince).toBe(TODAY);

    const write = nextFreezeRecord(fresh, first);
    expect(write).toEqual({ streakFreezesLeft: INITIAL_STREAK_FREEZES, streakFreezesSince: TODAY });

    const afterWrite: FreezeState = {
      freezesLeft: write!.streakFreezesLeft,
      freezesSince: write!.streakFreezesSince,
    };
    expect(nextFreezeRecord(afterWrite, resolveStreakWithFreezes(keys, TODAY, afterWrite))).toBeNull();
  });
});

describe("streak freezes — guards", () => {
  it("пустая история: остаток стартовый, серия ноль", () => {
    const r = withFreezes([]);
    expect(r).toMatchObject({ currentStreak: 0, longestStreak: 0, freezesLeft: INITIAL_STREAK_FREEZES });
  });

  it("эпоха из будущего не отключает заморозки навсегда", () => {
    const keys = daysAgo(5, 4, 2, 1, 0);
    const broken: FreezeState = { freezesLeft: null, freezesSince: "2099-01-01" };
    const r = resolveStreakWithFreezes(keys, TODAY, broken);
    expect(r.freezesSince).toBe(TODAY); // clamped, not trusted
    expect(r.freezesLeft).toBe(INITIAL_STREAK_FREEZES);
  });

  it("сегодняшний день без активности не считается пропуском", () => {
    const keys = daysAgo(2, 1);
    const r = withFreezes(keys);
    expect(r.currentStreak).toBe(2);
    expect(r.activeToday).toBe(false);
    expect(r.frozenDateKeys).toEqual([]); // today is not a hole yet
    expect(r.freezesLeft).toBe(INITIAL_STREAK_FREEZES);
  });

  it("одна испорченная древняя дата не заставляет проход идти вечно", () => {
    const r = withFreezes(["0001-01-01", ...daysAgo(1, 0)]);
    expect(r.currentStreak).toBe(2);
    expect(r.lastActiveDate).toBe(TODAY);
  });
});
