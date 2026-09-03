import { describe, expect, it } from "vitest";
import { computeStreakStats } from "./streaks";
import { resolveStreakWithFreezes } from "./streak-freezes";
import { addDateKeyDays, dateKeyIn } from "./timezone";

// The owner's complaint, turned into an arithmetic question: "the streak
// resets after a couple of days" for a learner who studies EVERY evening.
//
// Modelled exactly as reported — Mexico City, UTC-6 all year round (the
// country dropped DST in 2022, so unlike Tijuana there is no transition to
// hide inside), one session a day at 19:00 local, thirty days in a row.
//
// The rule this file follows is PROGRESS.md 4.1: a check that answers
// "nothing is broken" is worth nothing until it has been shown to catch a
// break. So the first thing every case here does is plant one — a missed
// day — and assert the count drops. Only then is the unbroken run measured.

/** UTC-6 all year. The whole point of choosing it over Tijuana. */
const MEXICO = "America/Mexico_City";

/** 19:00 in Mexico City is 01:00 the NEXT day in UTC. That single line is
 * the entire defect that was fixed on 31.08.2026, and it is why this
 * fixture is written as an explicit UTC instant rather than as a local
 * wall-clock string: the test must not use the same conversion the code
 * under test uses, or it proves nothing. */
function eveningOf(dayOfMonth: number, month = 9, year = 2026): Date {
  // 19:00 on <year>-<month>-<dayOfMonth> local == 01:00 the following UTC day.
  const utc = Date.UTC(year, month - 1, dayOfMonth, 19 + 6, 0, 0);
  return new Date(utc);
}

/** The instant → date key step the product actually performs. */
const eveningKey = (dayOfMonth: number, month = 9, year = 2026) =>
  dateKeyIn(eveningOf(dayOfMonth, month, year), MEXICO);

/** N consecutive evenings starting at day 1 of the month. */
function eveningRun(days: number): string[] {
  return Array.from({ length: days }, (_, i) => eveningKey(i + 1));
}

/** The freeze state of an account whose freezes have applied since its
 * first day — i.e. no pre-epoch stretch to muddy the arithmetic. */
const freezesSince = (firstKey: string) => ({ freezesLeft: null, freezesSince: firstKey });

describe("the fixture itself: 19:00 in Mexico City is the next UTC day", () => {
  it("moves the UTC date forward, which is what used to eat a day", () => {
    const instant = eveningOf(10);
    expect(instant.toISOString()).toBe("2026-09-11T01:00:00.000Z");
    expect(dateKeyIn(instant, "UTC")).toBe("2026-09-11");
    expect(dateKeyIn(instant, MEXICO)).toBe("2026-09-10");
  });

  it("is UTC-6 in September AND in January — no DST anywhere in the fixture", () => {
    expect(dateKeyIn(new Date("2026-09-11T01:00:00.000Z"), MEXICO)).toBe("2026-09-10");
    expect(dateKeyIn(new Date("2027-01-11T01:00:00.000Z"), MEXICO)).toBe("2027-01-10");
  });
});

describe("thirty evenings in a row, Mexico City", () => {
  // ---------------------------------------------------------------------
  // The planted break comes FIRST. Without it, "currentStreak === 30" below
  // is a number this file cannot distinguish from a stub that returns 30.
  // ---------------------------------------------------------------------

  it("POSITIVE CONTROL: two missed days in a row cut the count to the tail", () => {
    const withHole = eveningRun(30).filter((key) => key !== eveningKey(15) && key !== eveningKey(16));
    const today = eveningKey(30);
    const stats = resolveStreakWithFreezes(withHole, today, freezesSince(eveningKey(1)));
    // 17..30 inclusive.
    expect(stats.currentStreak).toBe(14);
    expect(stats.currentStreak).toBeLessThan(30);
    expect(stats.chainStartedOn).toBe(eveningKey(17));
    expect(stats.brokenOn).toBe(eveningKey(16));
  });

  it("POSITIVE CONTROL: a single missed day shows up in the freeze ledger", () => {
    const withHole = eveningRun(30).filter((key) => key !== eveningKey(15));
    const stats = resolveStreakWithFreezes(withHole, eveningKey(30), freezesSince(eveningKey(1)));
    // The chain survives — that is what a freeze is for — but the day is
    // named, not swallowed: 29 studied days, one covered.
    expect(stats.currentStreak).toBe(29);
    expect(stats.frozenDateKeys).toEqual([eveningKey(15)]);
  });

  it("POSITIVE CONTROL: without freezes a single missed day cuts the count", () => {
    const withHole = eveningRun(30).filter((key) => key !== eveningKey(15));
    // 16..30 inclusive.
    expect(computeStreakStats(withHole, eveningOf(30), MEXICO).currentStreak).toBe(15);
  });

  it("THE COMPLAINT: an unbroken run of thirty evenings does NOT reset", () => {
    const keys = eveningRun(30);
    const stats = resolveStreakWithFreezes(keys, eveningKey(30), freezesSince(eveningKey(1)));
    expect(stats.currentStreak).toBe(30);
    expect(stats.longestStreak).toBe(30);
    expect(stats.frozenDateKeys).toEqual([]);
    expect(stats.brokenOn).toBeNull();
    expect(stats.chainStartedOn).toBe(eveningKey(1));
    // And with the freeze machinery out of the picture entirely.
    expect(computeStreakStats(keys, eveningOf(30), MEXICO).currentStreak).toBe(30);
  });

  it("counts the same run in UTC too — the uniform 19:00 learner was NEVER the victim", () => {
    // Measured, not assumed, and it is the reason the reported symptom
    // cannot be reproduced from "every evening at 19:00" alone: shifting
    // every single day by the same +1 leaves the run unbroken. The old
    // code lost days only when the learner's times STRADDLED the boundary
    // (the case below), which is why the defect looked intermittent.
    const utcKeys = Array.from({ length: 30 }, (_, i) => dateKeyIn(eveningOf(i + 1), "UTC"));
    expect(computeStreakStats(utcKeys, eveningOf(30), "UTC").currentStreak).toBe(30);
  });

  it("but a mixed evening/morning pattern IS what UTC used to break", () => {
    // 19:00 on the 10th, then 10:00 on the 11th — two calendar days for the
    // learner, one single UTC day (both land on the 11th in UTC), so the
    // 10th vanishes and the run is cut.
    const evening = eveningOf(10); // 01:00 UTC on the 11th
    const morning = new Date(Date.UTC(2026, 8, 11, 10 + 6, 0, 0)); // 16:00 UTC on the 11th
    const local = [dateKeyIn(evening, MEXICO), dateKeyIn(morning, MEXICO)];
    const utc = [dateKeyIn(evening, "UTC"), dateKeyIn(morning, "UTC")];

    expect(new Set(local).size).toBe(2);
    expect(new Set(utc).size).toBe(1); // the 10th is gone

    expect(computeStreakStats(local, morning, MEXICO).currentStreak).toBe(2);
    expect(computeStreakStats(utc, morning, "UTC").currentStreak).toBe(1);
  });
});

describe("day boundary, zone change, month and year rollover", () => {
  it("23:59:59 and 00:00:00 local are two different days, one second apart", () => {
    const lastSecond = new Date(Date.UTC(2026, 8, 11, 5, 59, 59)); // 23:59:59 on the 10th
    const firstSecond = new Date(Date.UTC(2026, 8, 11, 6, 0, 0)); //  00:00:00 on the 11th
    expect(dateKeyIn(lastSecond, MEXICO)).toBe("2026-09-10");
    expect(dateKeyIn(firstSecond, MEXICO)).toBe("2026-09-11");
    expect(computeStreakStats([dateKeyIn(lastSecond, MEXICO), dateKeyIn(firstSecond, MEXICO)], firstSecond, MEXICO).currentStreak).toBe(2);
  });

  it("a learner who moves zone keeps a live chain rather than losing a day to the move", () => {
    // Studies at 19:00 Mexico City on the 10th, flies to Madrid, studies at
    // 19:00 Madrid on the 11th. Read in the NEW zone, which is what the
    // product does once the browser reports it.
    const inMexico = eveningOf(10); // 01:00 UTC on the 11th
    const inMadrid = new Date(Date.UTC(2026, 8, 11, 17, 0, 0)); // 19:00 CEST on the 11th
    const keys = [dateKeyIn(inMexico, "Europe/Madrid"), dateKeyIn(inMadrid, "Europe/Madrid")];
    // The Mexican evening is already the 11th in Madrid, so the two
    // sessions collapse into one day — a real consequence of moving, and
    // the chain still stands rather than breaking.
    expect(new Set(keys).size).toBe(1);
    expect(computeStreakStats(keys, inMadrid, "Europe/Madrid").currentStreak).toBe(1);
    // Read in the OLD zone they are still two days.
    const asMexico = [dateKeyIn(inMexico, MEXICO), dateKeyIn(inMadrid, MEXICO)];
    expect(computeStreakStats(asMexico, inMadrid, MEXICO).currentStreak).toBe(2);
  });

  it("counts straight through the end of a month", () => {
    const keys = [eveningKey(29, 9), eveningKey(30, 9), eveningKey(1, 10), eveningKey(2, 10)];
    expect(keys).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(computeStreakStats(keys, eveningOf(2, 10), MEXICO).currentStreak).toBe(4);
    expect(addDateKeyDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDateKeyDays("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("counts straight through the end of a year", () => {
    const keys = [
      eveningKey(30, 12, 2026),
      eveningKey(31, 12, 2026),
      eveningKey(1, 1, 2027),
      eveningKey(2, 1, 2027),
    ];
    expect(keys).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(computeStreakStats(keys, eveningOf(2, 1, 2027), MEXICO).currentStreak).toBe(4);
    expect(addDateKeyDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDateKeyDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});
