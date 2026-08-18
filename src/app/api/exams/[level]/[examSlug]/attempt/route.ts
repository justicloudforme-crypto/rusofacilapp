import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isLevelSlug } from "@/lib/courses";
import { getExamContent } from "@/lib/exams/content";
import { recordExamAttempt, type ExamSkillBreakdown } from "@/lib/exams/progress";
import { computeScore, describeMistakes, type AnswerMap } from "@/lib/lessons/scoring";
import { getRateLimiter } from "@/lib/rate-limit";

// Exam attempts are inherently rare (one exam every 10 lessons) — this
// limit exists only to stop a scripted client from spamming attempts.
const examAttemptLimiter = getRateLimiter("examAttempt", 60_000, 10);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ level: string; examSlug: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await examAttemptLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { level, examSlug } = await params;
  if (!isLevelSlug(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const exam = await getExamContent(level, examSlug);
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const answers = (body?.answers ?? {}) as AnswerMap;

  // Score is always recomputed server-side from the exam's own exercise
  // definitions — the client only supplies raw answers, never a score, so
  // an exam result can't be forged by editing the request body.
  let totalEarned = 0;
  let totalPoints = 0;
  const breakdown: Record<string, ExamSkillBreakdown> = {};

  for (const area of exam.skillAreas) {
    const areaAnswers: AnswerMap = {};
    for (const exercise of area.exercises) areaAnswers[exercise.id] = answers[exercise.id];
    const result = computeScore(area.exercises, areaAnswers);
    const mistakes = describeMistakes(area.exercises, areaAnswers, result.results);
    breakdown[area.id] = {
      earned: result.earned,
      total: result.total,
      percentage: result.percentage,
      mistakes,
    };
    totalEarned += result.earned;
    totalPoints += result.total;
  }

  const outcome = await recordExamAttempt(user.id, level, examSlug, totalEarned, totalPoints, breakdown);

  return NextResponse.json({
    earned: totalEarned,
    total: totalPoints,
    percentage: outcome.percentage,
    passed: outcome.passed,
    breakdown,
  });
}
