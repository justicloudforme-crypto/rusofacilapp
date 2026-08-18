import { describe, expect, it } from "vitest";
import { computeEarnedBadgeIds } from "./index";
import type { ExamAttemptSummary } from "../exams/progress";

function attempt(overrides: Partial<ExamAttemptSummary>): ExamAttemptSummary {
  return {
    id: "id",
    level: "a1",
    examSlug: "a1-exam-1",
    earned: 10,
    total: 10,
    percentage: 100,
    passed: true,
    breakdown: {},
    completedAt: new Date("2026-08-17T00:00:00.000Z"),
    ...overrides,
  };
}

describe("computeEarnedBadgeIds", () => {
  it("awards nothing for a brand-new user", () => {
    const earned = computeEarnedBadgeIds({ longestStreak: 0, examAttempts: [], vocabKnownCount: 0 });
    expect(earned.size).toBe(0);
  });

  it("awards streak badges by longest streak, not current streak", () => {
    const earned = computeEarnedBadgeIds({ longestStreak: 7, examAttempts: [], vocabKnownCount: 0 });
    expect(earned.has("streak-3")).toBe(true);
    expect(earned.has("streak-7")).toBe(true);
    expect(earned.has("streak-30")).toBe(false);
  });

  it("awards first-exam and perfect-score from a single passed 100% attempt", () => {
    const earned = computeEarnedBadgeIds({
      longestStreak: 0,
      examAttempts: [attempt({})],
      vocabKnownCount: 0,
    });
    expect(earned.has("first-exam")).toBe(true);
    expect(earned.has("perfect-score")).toBe(true);
  });

  it("does not award first-exam for a failed attempt", () => {
    const earned = computeEarnedBadgeIds({
      longestStreak: 0,
      examAttempts: [attempt({ passed: false, percentage: 40 })],
      vocabKnownCount: 0,
    });
    expect(earned.has("first-exam")).toBe(false);
    expect(earned.has("perfect-score")).toBe(false);
  });

  it("awards a level-graduate badge only once all 3 exams of that level are passed", () => {
    const twoOfThree = computeEarnedBadgeIds({
      longestStreak: 0,
      examAttempts: [
        attempt({ examSlug: "a1-exam-1" }),
        attempt({ examSlug: "a1-exam-2" }),
      ],
      vocabKnownCount: 0,
    });
    expect(twoOfThree.has("graduate-a1")).toBe(false);

    const allThree = computeEarnedBadgeIds({
      longestStreak: 0,
      examAttempts: [
        attempt({ examSlug: "a1-exam-1" }),
        attempt({ examSlug: "a1-exam-2" }),
        attempt({ examSlug: "a1-exam-3" }),
      ],
      vocabKnownCount: 0,
    });
    expect(allThree.has("graduate-a1")).toBe(true);
    expect(allThree.has("graduate-a2")).toBe(false);
  });

  it("awards a case-mastery badge from a 100% skill area, regardless of overall exam score", () => {
    const earned = computeEarnedBadgeIds({
      longestStreak: 0,
      examAttempts: [
        attempt({
          percentage: 60,
          breakdown: {
            "genitive-block": { earned: 7, total: 7, percentage: 100, mistakes: [] },
            "dative-block": { earned: 2, total: 6, percentage: 33, mistakes: [] },
          },
        }),
      ],
      vocabKnownCount: 0,
    });
    expect(earned.has("genitive-master")).toBe(true);
    expect(earned.has("dative-master")).toBe(false);
  });

  it("awards vocab badges by threshold", () => {
    const earned = computeEarnedBadgeIds({ longestStreak: 0, examAttempts: [], vocabKnownCount: 200 });
    expect(earned.has("vocab-50")).toBe(true);
    expect(earned.has("vocab-200")).toBe(true);
    expect(earned.has("vocab-500")).toBe(false);
  });
});
