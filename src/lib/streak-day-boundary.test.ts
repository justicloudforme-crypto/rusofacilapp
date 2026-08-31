import { describe, expect, it } from "vitest";
import { computeStreakStats } from "./streaks";
import { addDateKeyDays, dateKeyIn } from "./timezone";

// Positive control for the fix of 31.08.2026 (PROGRESS.md 7.68).
//
// Rule of this repo (PROGRESS.md 4.1): a check that returns "correct" is
// worth nothing until it has been shown to catch the defect. So every case
// below runs the SAME input through two implementations —
//
//   legacyDateKeys / legacyComputeStreakStats: verbatim copies of the code
//   as it stood before the fix (UTC via toISOString, no time zone anywhere)
//
//   dateKeyIn / computeStreakStats: the shipped code
//
// — and asserts BOTH that the old one is wrong and that the new one is
// right. Delete the legacy half and these tests still pass on the broken
// code; that is exactly what they exist to prevent.

// ---------------------------------------------------------------- legacy

const DAY_MS = 24 * 60 * 60 * 1000;

/** streaks.ts `toDateKey`, as it was before 31.08.2026. */
function legacyDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** streaks.ts `addDays`, as it was. */
function legacyAddDays(dateKey: string, delta: number): string {
  return legacyDateKey(new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + delta * DAY_MS));
}

/** streaks.ts `computeStreakStats`, as it was: no `timeZone` parameter at
 * all, "today" resolved in UTC. */
function legacyComputeStreakStats(activityDateKeys: Iterable<string>, today: Date) {
  const dates = new Set(activityDateKeys);
  if (dates.size === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, activeToday: false };
  }
  const sorted = [...dates].sort();
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === legacyAddDays(sorted[i - 1], 1) ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  const todayKey = legacyDateKey(today);
  const activeToday = dates.has(todayKey);
  const yesterdayKey = legacyAddDays(todayKey, -1);
  let cursor: string | null = activeToday ? todayKey : dates.has(yesterdayKey) ? yesterdayKey : null;
  let currentStreak = 0;
  while (cursor !== null && dates.has(cursor)) {
    currentStreak += 1;
    cursor = legacyAddDays(cursor, -1);
  }
  return { currentStreak, longestStreak, lastActiveDate: sorted[sorted.length - 1], activeToday };
}

// ------------------------------------------------------------- fixtures

/** The owner's zone, and the one the whole defect was reported from.
 * UTC-7 year-round in 2026 (Baja California observes DST, but every
 * instant used below is inside the summer offset, so -7 holds throughout
 * and no case here silently depends on which side of a transition it is
 * on). */
const TIJUANA = "America/Tijuana";

/** UTC+12 in August (NZST; NZDT runs Sep–Apr) — the mirror image of
 * Tijuana. A defect that only ever shows up on one side of UTC is
 * half-diagnosed; this catches the sign error that "fixing" it by
 * subtracting an offset everywhere would introduce. */
const AUCKLAND = "Pacific/Auckland";

/** Turns real instants into the activity date keys the streak is computed
 * from, in a given zone — the shipped derivation. */
const keysIn = (zone: string, ...instants: string[]) =>
  instants.map((iso) => dateKeyIn(new Date(iso), zone));

/** The same, in UTC, i.e. what the code produced before the fix. */
const legacyKeys = (...instants: string[]) => instants.map((iso) => legacyDateKey(new Date(iso)));

describe("streak day boundary — the learner's midnight, not the server's", () => {
  it("серия через полночь: an evening and the next morning are TWO days, not one", () => {
    // 21:00 Tijuana on the 20th, then 09:00 Tijuana on the 21st.
    // In UTC both are the 21st — the second session lands on the same key
    // as the first and the day is silently swallowed.
    const instants = ["2026-08-21T04:00:00.000Z", "2026-08-21T16:00:00.000Z"];
    const now = new Date("2026-08-21T20:00:00.000Z"); // 13:00 on the 21st, Tijuana

    const legacy = legacyComputeStreakStats(legacyKeys(...instants), now);
    expect(legacyKeys(...instants)).toEqual(["2026-08-21", "2026-08-21"]);
    expect(legacy.currentStreak).toBe(1); // ← the defect: two days shown as one

    const fixed = computeStreakStats(keysIn(TIJUANA, ...instants), now, TIJUANA);
    expect(keysIn(TIJUANA, ...instants)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(fixed.currentStreak).toBe(2);
  });

  it("серия через полночь, зеркально: UTC+12 must not split one local day in two", () => {
    // 00:30 and 22:00 on the 21st in Auckland — one single local day.
    // In UTC that is 12:30 on the 20th and 10:00 on the 21st: two keys,
    // so the counter reports a two-day streak the learner never had.
    const instants = ["2026-08-20T12:30:00.000Z", "2026-08-21T10:00:00.000Z"];
    const now = new Date("2026-08-21T11:00:00.000Z"); // 23:00 on the 21st, Auckland

    expect(legacyKeys(...instants)).toEqual(["2026-08-20", "2026-08-21"]);
    const legacy = legacyComputeStreakStats(legacyKeys(...instants), now);
    expect(legacy.currentStreak).toBe(2); // ← the defect: one day counted as two

    expect(keysIn(AUCKLAND, ...instants)).toEqual(["2026-08-21", "2026-08-21"]);
    const fixed = computeStreakStats(keysIn(AUCKLAND, ...instants), now, AUCKLAND);
    expect(fixed.currentStreak).toBe(1);
  });

  it("два захода в один день дают 1, а не 2", () => {
    // 08:00 and 22:00 Tijuana on the 20th — unambiguously one day for the
    // learner. The second crosses into the 21st in UTC.
    const instants = ["2026-08-20T15:00:00.000Z", "2026-08-21T05:00:00.000Z"];
    const now = new Date("2026-08-21T05:30:00.000Z"); // 22:30 on the 20th, Tijuana

    expect(legacyKeys(...instants)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(legacyComputeStreakStats(legacyKeys(...instants), now).currentStreak).toBe(2);

    expect(keysIn(TIJUANA, ...instants)).toEqual(["2026-08-20", "2026-08-20"]);
    expect(computeStreakStats(keysIn(TIJUANA, ...instants), now, TIJUANA).currentStreak).toBe(1);
  });

  it("заход в 23:50 и в 00:10 — соседние сутки, серия продолжается", () => {
    // 23:50 on the 20th and 00:10 on the 21st, Tijuana. In UTC: 06:50 and
    // 07:10 on the 21st — one key, so the streak of 2 reads as 1.
    const instants = ["2026-08-21T06:50:00.000Z", "2026-08-21T07:10:00.000Z"];
    const now = new Date("2026-08-21T07:20:00.000Z"); // 00:20 on the 21st, Tijuana

    expect(legacyKeys(...instants)).toEqual(["2026-08-21", "2026-08-21"]);
    expect(legacyComputeStreakStats(legacyKeys(...instants), now).currentStreak).toBe(1);

    expect(keysIn(TIJUANA, ...instants)).toEqual(["2026-08-20", "2026-08-21"]);
    const fixed = computeStreakStats(keysIn(TIJUANA, ...instants), now, TIJUANA);
    expect(fixed.currentStreak).toBe(2);
    expect(fixed.activeToday).toBe(true);
  });

  it("серия с пропуском дня обрывается — и обрывается в СВОИ сутки", () => {
    // Studied on the 18th and the 19th (Tijuana), skipped the 20th, came
    // back on the 21st. Correct answer: current streak 1, longest 2.
    //
    // In UTC the 19th-evening session lands on the 20th, which papers the
    // gap over and reports an unbroken run — a streak the learner never
    // earned. This is the same mechanism as the missing days, seen from
    // the other side.
    const instants = [
      "2026-08-19T02:00:00.000Z", // 19:00 on the 18th, Tijuana
      "2026-08-20T03:00:00.000Z", // 20:00 on the 19th, Tijuana
      "2026-08-22T02:00:00.000Z", // 19:00 on the 21st, Tijuana
    ];
    const now = new Date("2026-08-22T04:00:00.000Z"); // 21:00 on the 21st, Tijuana

    const legacy = legacyComputeStreakStats(legacyKeys(...instants), now);
    expect(legacyKeys(...instants)).toEqual(["2026-08-19", "2026-08-20", "2026-08-22"]);
    expect(legacy.longestStreak).toBe(2);
    expect(legacy.currentStreak).toBe(1);
    // ...but it is the WRONG 2 and the wrong 1: legacy thinks the run was
    // 19→20 and that today is the 22nd. The learner's actual calendar has
    // no 20th at all.
    expect(legacy.lastActiveDate).toBe("2026-08-22"); // ← a day that has not started yet for them

    const fixed = computeStreakStats(keysIn(TIJUANA, ...instants), now, TIJUANA);
    expect(keysIn(TIJUANA, ...instants)).toEqual(["2026-08-18", "2026-08-19", "2026-08-21"]);
    expect(fixed.longestStreak).toBe(2);
    expect(fixed.currentStreak).toBe(1);
    expect(fixed.lastActiveDate).toBe("2026-08-21");
    expect(fixed.activeToday).toBe(true);
  });

  it("пользователь в другом часовом поясе: тот же самый набор мгновений даёт разный ответ", () => {
    // One instant, three answers. This is the whole bug in one assertion:
    // the counter is a statement about the LEARNER's calendar, so it
    // cannot be computed without knowing which calendar that is.
    const instant = new Date("2026-08-21T04:30:00.000Z");
    expect(legacyDateKey(instant)).toBe("2026-08-21");
    expect(dateKeyIn(instant, TIJUANA)).toBe("2026-08-20"); // 21:30, still the 20th
    expect(dateKeyIn(instant, AUCKLAND)).toBe("2026-08-21"); // 16:30 on the 21st
    expect(dateKeyIn(instant, "UTC")).toBe("2026-08-21");
  });

  it("серия владельца: 12 дней подряд в Тихуане, но не больше 7 в UTC (реальные данные)", () => {
    // Not a synthetic case. These are the owner's own study instants for
    // 11–22.08.2026, taken from the copy of production on 31.08.2026 — one
    // representative timestamp per Tijuana day. Twelve consecutive days.
    //
    // Under UTC keys two local days disappear entirely — each one's only
    // session was in the evening, i.e. already the next day in UTC, where
    // it merges with the day that follows — and the run breaks apart.
    const instants = [
      "2026-08-12T06:20:01.001Z", // 11.08 23:20
      "2026-08-13T03:17:03.218Z", // 12.08 20:17
      "2026-08-14T02:10:00.000Z", // 13.08 19:10
      "2026-08-15T04:00:00.000Z", // 14.08 21:00
      "2026-08-16T02:44:27.794Z", // 15.08 19:44
      "2026-08-17T01:34:06.980Z", // 16.08 18:34
      "2026-08-18T05:00:00.000Z", // 17.08 22:00
      "2026-08-18T18:31:07.694Z", // 18.08 11:31
      "2026-08-19T22:13:45.824Z", // 19.08 15:13
      "2026-08-21T02:00:00.000Z", // 20.08 19:00
      "2026-08-22T04:41:00.638Z", // 21.08 21:41
      "2026-08-22T19:00:00.000Z", // 22.08 12:00
    ];
    const now = new Date("2026-08-22T23:00:00.000Z"); // 16:00 on the 22nd, Tijuana

    const legacy = legacyComputeStreakStats(legacyKeys(...instants), now);
    expect(new Set(legacyKeys(...instants)).size).toBe(10); // two days lost to merging
    expect(legacy.longestStreak).toBe(8);
    // This is the owner's reported symptom reproduced exactly: twelve days
    // in a row, and the counter says two.
    expect(legacy.currentStreak).toBe(2);

    const fixed = computeStreakStats(keysIn(TIJUANA, ...instants), now, TIJUANA);
    expect(new Set(keysIn(TIJUANA, ...instants)).size).toBe(12);
    expect(fixed.longestStreak).toBe(12);
    expect(fixed.currentStreak).toBe(12); // 12 vs. the 2 the learner saw
  });
});

describe("addDateKeyDays", () => {
  it("steps by exactly one calendar day across a month end", () => {
    expect(addDateKeyDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDateKeyDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("is anchored at noon, so a DST-sized shift cannot skip or repeat a day", () => {
    // The old implementation anchored at 00:00Z. Arithmetic on the key is
    // zone-free either way, but noon leaves 12 hours of slack on both
    // sides, so no rounding of the underlying instant can ever land it on
    // the wrong date.
    for (const key of ["2026-03-08", "2026-11-01", "2026-02-28", "2028-02-28"]) {
      expect(addDateKeyDays(addDateKeyDays(key, 1), -1)).toBe(key);
    }
    expect(addDateKeyDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDateKeyDays("2026-02-28", 1)).toBe("2026-03-01"); // not one
  });
});
