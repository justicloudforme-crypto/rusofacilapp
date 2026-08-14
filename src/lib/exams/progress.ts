import "server-only";
import { db } from "../db";
import type { MistakeDetail } from "../lessons/scoring";

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

/** Every exam attempt a student has made, newest first — for the /profile
 * "resultados de exámenes" section. */
export async function getExamAttempts(userId: string): Promise<ExamAttemptSummary[]> {
  const rows = await db.examAttempt.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
  });

  return rows.map((row) => {
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
}
