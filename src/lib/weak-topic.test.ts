import { describe, expect, it } from "vitest";
import { pickWeakestSkillArea } from "./weak-topic";
import type { ExamAttemptSummary } from "./exams/progress";

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

describe("pickWeakestSkillArea", () => {
  it("returns null with no attempts", () => {
    expect(pickWeakestSkillArea([])).toBeNull();
  });

  it("returns null when every skill area is at 100%", () => {
    const result = pickWeakestSkillArea([
      attempt({
        breakdown: {
          alphabet: { earned: 6, total: 6, percentage: 100, mistakes: [] },
          greetings: { earned: 6, total: 6, percentage: 100, mistakes: [] },
        },
      }),
    ]);
    expect(result).toBeNull();
  });

  it("picks the lowest-percentage skill area across all attempts", () => {
    const result = pickWeakestSkillArea([
      attempt({
        examSlug: "a1-exam-1",
        breakdown: {
          alphabet: { earned: 6, total: 6, percentage: 100, mistakes: [] },
          "cases-intro": { earned: 2, total: 6, percentage: 33, mistakes: [] },
        },
      }),
      attempt({
        examSlug: "a1-exam-2",
        breakdown: {
          "past-tense": { earned: 5, total: 7, percentage: 71, mistakes: [] },
        },
      }),
    ]);
    expect(result).toEqual({ areaId: "cases-intro", percentage: 33, level: "a1", examSlug: "a1-exam-1" });
  });

  it("only counts the newest attempt of a retaken exam", () => {
    const result = pickWeakestSkillArea([
      // newest first, as getExamAttempts returns
      attempt({
        examSlug: "a1-exam-1",
        completedAt: new Date("2026-08-18T00:00:00.000Z"),
        breakdown: { alphabet: { earned: 6, total: 6, percentage: 100, mistakes: [] } },
      }),
      attempt({
        examSlug: "a1-exam-1",
        completedAt: new Date("2026-08-01T00:00:00.000Z"),
        breakdown: { alphabet: { earned: 1, total: 6, percentage: 17, mistakes: [] } },
      }),
    ]);
    expect(result).toBeNull();
  });
});
