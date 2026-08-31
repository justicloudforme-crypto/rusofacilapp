import "server-only";
import { getExamAttempts, type ExamAttemptSummary } from "./exams/progress";
import { getExamContent } from "./exams/content";
import { isLevelSlug } from "./courses";
import { getOrCreateGlobalSingleton, TtlCache, isPlainObject, cached } from "./ttl-cache";

export interface WeakTopicResult {
  areaId: string;
  title: string;
  percentage: number;
  level: string;
  examSlug: string;
}

/** Picks the single weakest exam skill area across a student's most recent
 * attempt of each exam — pure function over already-fetched attempts so
 * the ranking rule is unit-testable without a database or exam content
 * lookup (title is filled in separately by the caller). Returns null when
 * there's no exam data yet, or every skill area the student has touched
 * sits at 100% (nothing to nudge them toward). */
export function pickWeakestSkillArea(
  attempts: ExamAttemptSummary[],
): { areaId: string; percentage: number; level: string; examSlug: string } | null {
  // attempts is newest-first (see getExamAttempts); a retake fully
  // supersedes an earlier attempt of the SAME exam for ranking purposes,
  // so only the first (newest) attempt per (level, examSlug) counts.
  const latestByExam = new Map<string, ExamAttemptSummary>();
  for (const attempt of attempts) {
    const key = `${attempt.level}:${attempt.examSlug}`;
    if (!latestByExam.has(key)) latestByExam.set(key, attempt);
  }

  let weakest: { areaId: string; percentage: number; level: string; examSlug: string } | null = null;
  for (const attempt of latestByExam.values()) {
    for (const [areaId, score] of Object.entries(attempt.breakdown)) {
      if (weakest === null || score.percentage < weakest.percentage) {
        weakest = { areaId, percentage: score.percentage, level: attempt.level, examSlug: attempt.examSlug };
      }
    }
  }

  return weakest === null || weakest.percentage === 100 ? null : weakest;
}

async function computeWeakTopic(userId: string): Promise<WeakTopicResult | null> {
  const attempts = await getExamAttempts(userId);
  const weakest = pickWeakestSkillArea(attempts);
  if (weakest === null || !isLevelSlug(weakest.level)) return null;

  const examContent = await getExamContent(weakest.level, weakest.examSlug);
  const area = examContent?.skillAreas.find((a) => a.id === weakest.areaId);
  if (!area) return null;

  return {
    areaId: weakest.areaId,
    title: area.title,
    percentage: weakest.percentage,
    level: weakest.level,
    examSlug: weakest.examSlug,
  };
}

// A week is long enough that this doesn't recompute (and re-lookup exam
// content) on every /profile visit, short enough that a newly-taken exam
// changes the nudge within a few days rather than going stale for a month.
const weakTopicCache = getOrCreateGlobalSingleton(
  "weakTopicCache",
  () => new TtlCache<WeakTopicResult | null>(7 * 24 * 60 * 60 * 1000, "weakTopic", isPlainObject),
);

/** The student's single weakest exam topic this week, cached per user for
 * 7 days — surfaced as a "focus on this" nudge on /profile. Fails soft to
 * null (nudge simply doesn't show) on any error, same reasoning as
 * getUserBadgesForDisplay: a secondary engagement feature must never break
 * the page it's displayed on. */
export async function getWeeklyWeakTopic(userId: string): Promise<WeakTopicResult | null> {
  try {
    return await cached(weakTopicCache, userId, () => computeWeakTopic(userId));
  } catch (error) {
    console.error("[weak-topic] getWeeklyWeakTopic failed", error);
    return null;
  }
}

/** Call after recording a new exam attempt so the nudge reflects it right
 * away instead of staying frozen on a stale (possibly now-fixed) weak spot
 * for up to the full 7-day TTL. */
export async function invalidateWeakTopicCache(userId: string): Promise<void> {
  await weakTopicCache.del(userId);
}
