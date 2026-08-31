import { describe, expect, it } from "vitest";
import { computeStreakStats } from "./streaks";

const TODAY = new Date("2026-08-17T12:00:00.000Z");

describe("computeStreakStats", () => {
  it("returns all zeros with no activity", () => {
    expect(computeStreakStats([], TODAY)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      activeToday: false,
      // An account with nothing in it still gets shown its starting grant —
      // the two freeze fields are part of the shape now (PROGRESS.md 7.69).
      freezesLeft: 2,
      frozenDateKeys: [],
      // And since 7.71, where the chain starts and what ended the one
      // before it. Both null here, which is the case that matters: an empty
      // account must not hand /profile half a sentence to print.
      chainStartedOn: null,
      brokenOn: null,
    });
  });

  it("counts a single active day as a streak of 1", () => {
    const stats = computeStreakStats(["2026-08-17"], TODAY);
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.activeToday).toBe(true);
  });

  it("counts consecutive days ending today", () => {
    const stats = computeStreakStats(
      ["2026-08-15", "2026-08-16", "2026-08-17"],
      TODAY,
    );
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it("keeps the streak alive if yesterday was active but today isn't yet", () => {
    const stats = computeStreakStats(
      ["2026-08-14", "2026-08-15", "2026-08-16"],
      TODAY,
    );
    expect(stats.currentStreak).toBe(3);
    expect(stats.activeToday).toBe(false);
    expect(stats.lastActiveDate).toBe("2026-08-16");
  });

  it("resets current streak to 0 once a full day is skipped", () => {
    const stats = computeStreakStats(["2026-08-10", "2026-08-11"], TODAY);
    expect(stats.currentStreak).toBe(0);
    expect(stats.lastActiveDate).toBe("2026-08-11");
  });

  it("stops the current streak at the first gap when walking backward", () => {
    const stats = computeStreakStats(
      ["2026-08-10", "2026-08-16", "2026-08-17"],
      TODAY,
    );
    expect(stats.currentStreak).toBe(2);
  });

  it("tracks the longest streak separately from the current one", () => {
    const stats = computeStreakStats(
      ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-17"],
      TODAY,
    );
    expect(stats.longestStreak).toBe(4);
    expect(stats.currentStreak).toBe(1);
  });

  it("ignores duplicate/unsorted input", () => {
    const stats = computeStreakStats(
      ["2026-08-17", "2026-08-15", "2026-08-16", "2026-08-16"],
      TODAY,
    );
    expect(stats.currentStreak).toBe(3);
  });
});
