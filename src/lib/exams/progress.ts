import "server-only";
import { db } from "../db";
import type { MistakeDetail } from "../lessons/scoring";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "../ttl-cache";

export interface ExamSkillBreakdown {
  earned: number;
  total: number;
  percentage: number;
  /** Per-question review for whatever the student got wrong in this skill
   * area — prompt, their answer, the correct answer, and (when the exam
   * content provides it) the grammar rule explanation. Shown in /profile. */
  mistakes: MistakeDetail[];
}

export async function recordExamAttempt(
  userId: string,
  level: string,
  examSlug: string,
  earned: number,
  total: number,
  breakdown: Record<string, ExamSkillBreakdown>,
) {
  const percentage = total > 0 ? Math.round((earned / total) * 100) : 100;
  const passed = percentage >= 70;
  await db.examAttempt.create({
    data: {
      userId,
      level,
      examSlug,
      earned,
      total,
      percentage,
      passed,
      breakdown: JSON.stringify(breakdown),
    },
  });
  await invalidateExamAttemptsCache(userId);
  return { percentage, passed };
}

export interface ExamAttemptSummary {
  id: string;
  level: string;
  examSlug: string;
  earned: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: Record<string, ExamSkillBreakdown>;
  completedAt: Date;
}

// Read on every /profile render AND on every progress-affecting write (via
// awardBadgesSafely's badge evaluation) — cached like getUserStreakStats,
// but with an explicit invalidation on write instead of relying purely on
// TTL: a student finishing an exam and immediately checking /profile must
// see that attempt right away, not wait out a stale window.
const examAttemptsCache = getOrCreateGlobalSingleton(
  "examAttemptsCache",
  () => new TtlCache<ExamAttemptSummary[]>(60_000, "exam-attempts")
);

function reviveExamAttemptDates(rows: ExamAttemptSummary[]): ExamAttemptSummary[] {
  return rows.map((row) => ({ ...row, completedAt: new Date(row.completedAt) }));
}

export async function invalidateExamAttemptsCache(userId: string): Promise<void> {
  await examAttemptsCache.del(userId);
}

/** Every exam attempt a student has made, newest first — for the /profile
 * "resultados de exámenes" section. */
export async function getExamAttempts(userId: string): Promise<ExamAttemptSummary[]> {
  const rows = await cached(examAttemptsCache, userId, async () => {
    const dbRows = await db.examAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
    });

    return dbRows.map((row) => {
      let breakdown: Record<string, ExamSkillBreakdown> = {};
      try {
        const parsed = JSON.parse(row.breakdown);
        if (parsed && typeof parsed === "object") breakdown = parsed;
      } catch {
        breakdown = {};
      }
      return {
        id: row.id,
        level: row.level,
        examSlug: row.examSlug,
        earned: row.earned,
        total: row.total,
        percentage: row.percentage,
        passed: row.passed,
        breakdown,
        completedAt: row.completedAt,
      };
    });
  });

  return reviveExamAttemptDates(rows);
}
