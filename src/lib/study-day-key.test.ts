import { describe, expect, it } from "vitest";
import { studyDayKeyIn } from "./study-day-key";
import { computeStreakStats } from "./streaks";
import { dateKeyIn } from "./timezone";

// The defect this rule closes, measured rather than argued.
//
// A learner in Mexico City (UTC-6) opens a lesson at 19:00. The response
// that renders that lesson is the FIRST one their new browser has ever
// asked for, so `rusofacil-tz` has not been written yet and `User.timezone`
// is still null: src/lib/timezone-server.ts falls back to UTC, and the day
// mark is stamped with the UTC key — which is TOMORROW.
//
// Every case below is written as a pair: first the stamp that was written,
// then the day the learner actually studied.

const MEXICO = "America/Mexico_City";

/** 19:00 in Mexico City on 2026-09-10. */
const EVENING = new Date("2026-09-11T01:00:00.000Z");

describe("a mark stamped in the wrong zone is still placed on the right day", () => {
  it("POSITIVE CONTROL: the stored key really is a day off", () => {
    // Nothing below means anything unless this is true first.
    const storedUnderUtc = dateKeyIn(EVENING, "UTC");
    expect(storedUnderUtc).toBe("2026-09-11");
    expect(dateKeyIn(EVENING, MEXICO)).toBe("2026-09-10");
    expect(storedUnderUtc).not.toBe(dateKeyIn(EVENING, MEXICO));
  });

  it("reads the day back from the instant, not from the stamp", () => {
    const row = { dateKey: "2026-09-11", markedAt: EVENING }; // stamped in UTC
    expect(studyDayKeyIn(row, MEXICO)).toBe("2026-09-10");
  });

  it("leaves a correctly stamped row exactly where it is", () => {
    const row = { dateKey: "2026-09-10", markedAt: EVENING };
    expect(studyDayKeyIn(row, MEXICO)).toBe("2026-09-10");
  });

  it("falls back to the stored key when the instant is missing or unusable", () => {
    expect(studyDayKeyIn({ dateKey: "2026-09-10", markedAt: null }, MEXICO)).toBe("2026-09-10");
    expect(studyDayKeyIn({ dateKey: "2026-09-10" }, MEXICO)).toBe("2026-09-10");
    expect(studyDayKeyIn({ dateKey: "2026-09-10", markedAt: "not a date" }, MEXICO)).toBe("2026-09-10");
  });

  it("accepts the string form a raw driver hands back", () => {
    expect(studyDayKeyIn({ dateKey: "2026-09-11", markedAt: "2026-09-11T01:00:00.000Z" }, MEXICO)).toBe(
      "2026-09-10",
    );
  });
});

describe("what the wrong stamp costs a real chain", () => {
  // Three evenings in a row, 8th to 10th of September, 19:00 local. The
  // first one is the learner's first ever page load, so it was stamped in
  // UTC and landed on the 9th; the other two were stamped correctly.
  const rows = [
    { dateKey: "2026-09-09", markedAt: new Date("2026-09-09T01:00:00.000Z"), source: "lesson" }, // really the 8th
    { dateKey: "2026-09-09", markedAt: new Date("2026-09-10T01:00:00.000Z"), source: "lesson" },
    { dateKey: "2026-09-10", markedAt: new Date("2026-09-11T01:00:00.000Z"), source: "lesson" },
  ];
  const today = new Date("2026-09-11T02:00:00.000Z"); // 20:00 on the 10th, local

  it("POSITIVE CONTROL: reading the stored keys loses a day of a three-day run", () => {
    const stored = rows.map((row) => row.dateKey);
    const stats = computeStreakStats(stored, today, MEXICO);
    expect(new Set(stored).size).toBe(2);
    expect(stats.currentStreak).toBe(2);
  });

  it("reading the instants gives the learner all three days back", () => {
    const derived = rows.map((row) => studyDayKeyIn(row, MEXICO));
    expect(new Set(derived)).toEqual(new Set(["2026-09-08", "2026-09-09", "2026-09-10"]));
    expect(computeStreakStats(derived, today, MEXICO).currentStreak).toBe(3);
  });
});

describe("all six sources end up on one calendar", () => {
  it("the mark and a progress row from the same evening are the same day", () => {
    // The other five sources have always been converted in the reader's
    // zone; the mark was the one frozen at write time. A learner whose mark
    // was stamped in UTC therefore had a lesson row on the 10th and a mark
    // on the 11th — one evening, two squares.
    const lessonCompletedAt = new Date("2026-09-11T01:30:00.000Z"); // 19:30 local, same evening
    const markStoredUnderUtc = { dateKey: "2026-09-11", markedAt: EVENING };

    const beforeFix = new Set([markStoredUnderUtc.dateKey, dateKeyIn(lessonCompletedAt, MEXICO)]);
    expect(beforeFix.size).toBe(2); // POSITIVE CONTROL: two squares for one evening

    const afterFix = new Set([studyDayKeyIn(markStoredUnderUtc, MEXICO), dateKeyIn(lessonCompletedAt, MEXICO)]);
    expect(afterFix.size).toBe(1);
    expect([...afterFix]).toEqual(["2026-09-10"]);
  });
});
