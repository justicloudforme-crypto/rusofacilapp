import "server-only";
import { db } from "../db";
import { getUserStreakStats } from "../streaks";
import { DEFAULT_TIME_ZONE } from "../timezone";
import { getExamAttempts, type ExamAttemptSummary } from "../exams/progress";
import { BADGE_CATALOG, getBadgeDef, type BadgeDef } from "./catalog";

// Maps a "case master" badge id to the substring its exam skill-area ids
// must contain (see src/lib/exams/content.json) — e.g. "genitive-block",
// "genitive-adjectives-pronouns", "adjective-case-declension" all contain
// neither keyword directly for the last one, so this deliberately checks
// the common, unambiguous stems used across the exam content rather than
// trying to enumerate every skill-area id by hand.
const CASE_BADGE_KEYWORDS: Record<string, string> = {
  "genitive-master": "genitive",
  "dative-master": "dative",
  "accusative-master": "accusative",
  "instrumental-master": "instrumental",
  "prepositional-master": "prepositional",
  "motion-verbs-master": "motion",
  "aspect-master": "aspect",
  "participle-master": "participle",
};

// Fixed exam roster per level — src/lib/exams/content.json defines exactly
// 3 exams per level (a1-exam-1..3, a2-exam-1..3, etc.), and courses.ts has
// no exam-count concept of its own to derive this from.
const EXAM_SLUGS_PER_LEVEL: Record<string, string[]> = {
  a1: ["a1-exam-1", "a1-exam-2", "a1-exam-3"],
  a2: ["a2-exam-1", "a2-exam-2", "a2-exam-3"],
  b1: ["b1-exam-1", "b1-exam-2", "b1-exam-3"],
  b2: ["b2-exam-1", "b2-exam-2", "b2-exam-3"],
};

interface BadgeContext {
  // longestStreak, not currentStreak: a streak badge, once earned, must
  // never be revoked just because the user later breaks their streak.
  longestStreak: number;
  examAttempts: ExamAttemptSummary[];
  vocabKnownCount: number;
}

/** Pure function over already-fetched stats, kept separate from the DB
 * reads below so the unlock rules are unit-testable without a database —
 * same split as computeStreakStats in streaks.ts. */
export function computeEarnedBadgeIds(ctx: BadgeContext): Set<string> {
  const earned = new Set<string>();

  if (ctx.longestStreak >= 3) earned.add("streak-3");
  if (ctx.longestStreak >= 7) earned.add("streak-7");
  if (ctx.longestStreak >= 30) earned.add("streak-30");
  if (ctx.longestStreak >= 100) earned.add("streak-100");

  const passedAttempts = ctx.examAttempts.filter((a) => a.passed);
  if (passedAttempts.length > 0) earned.add("first-exam");
  if (ctx.examAttempts.some((a) => a.percentage === 100)) earned.add("perfect-score");

  for (const [level, slugs] of Object.entries(EXAM_SLUGS_PER_LEVEL)) {
    const passedSlugs = new Set(
      passedAttempts.filter((a) => a.level === level).map((a) => a.examSlug),
    );
    if (slugs.every((slug) => passedSlugs.has(slug))) earned.add(`graduate-${level}`);
  }

  for (const [badgeId, keyword] of Object.entries(CASE_BADGE_KEYWORDS)) {
    const hasMastery = ctx.examAttempts.some((attempt) =>
      Object.entries(attempt.breakdown).some(
        ([areaId, score]) => areaId.includes(keyword) && score.percentage === 100,
      ),
    );
    if (hasMastery) earned.add(badgeId);
  }

  if (ctx.vocabKnownCount >= 50) earned.add("vocab-50");
  if (ctx.vocabKnownCount >= 200) earned.add("vocab-200");
  if (ctx.vocabKnownCount >= 500) earned.add("vocab-500");

  return earned;
}

/** Evaluates every badge rule for a user and persists any newly-earned
 * ones. Idempotent (UserBadge is unique on [userId, badgeId]) and cheap to
 * call after every progress-affecting write — it only ever adds rows,
 * never removes them, so an already-earned badge is never revoked even if
 * the underlying stat (e.g. a broken streak) later drops. Returns just the
 * badges newly earned by THIS call, for an optional "you unlocked X" toast. */
export async function evaluateAndAwardBadges(userId: string): Promise<BadgeDef[]> {
  // The user's own zone, read from the account row rather than a request
  // cookie: this runs inside after(), where there is no request to read.
  // Unknown zone falls back to UTC — the same value every reader used
  // before 31.08.2026, so a null here can only ever under-count a streak
  // badge, never award one that wasn't earned.
  const owner = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });

  const [streak, examAttempts, vocabKnownCount, existing] = await Promise.all([
    getUserStreakStats(userId, owner?.timezone ?? DEFAULT_TIME_ZONE),
    getExamAttempts(userId),
    db.flashcardProgress.count({ where: { userId, known: true } }),
    db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
  ]);

  const earnedIds = computeEarnedBadgeIds({
    longestStreak: streak.longestStreak,
    examAttempts,
    vocabKnownCount,
  });

  const existingIds = new Set(existing.map((b) => b.badgeId));
  const newIds = [...earnedIds].filter((id) => !existingIds.has(id));
  if (newIds.length === 0) return [];

  // SQLite's createMany has no skipDuplicates support in Prisma; newIds is
  // already filtered against existingIds above, so a collision here would
  // only happen under a concurrent duplicate call — left to the [userId,
  // badgeId] unique constraint to reject, caught by awardBadgesSafely's
  // fail-soft wrapper (this function's only real caller).
  await db.userBadge.createMany({
    data: newIds.map((badgeId) => ({ userId, badgeId })),
  });

  return newIds.map(getBadgeDef).filter((b): b is BadgeDef => b !== undefined);
}

/** Fire-and-forget wrapper for call sites in write-path API routes: badge
 * evaluation is a secondary effect and must never fail the primary write
 * (saving a lesson attempt, recording an exam, syncing flashcard
 * progress) if it throws for any reason. */
export async function awardBadgesSafely(userId: string): Promise<void> {
  try {
    await evaluateAndAwardBadges(userId);
  } catch (error) {
    console.error("[badges] evaluateAndAwardBadges failed", error);
  }
}

export interface DisplayBadge {
  def: BadgeDef;
  earnedAt: Date | null;
}

/** Every catalog badge, in catalog order, paired with when the user earned
 * it (or null if still locked) — powers the /profile "badges" tab, which
 * shows the full catalog rather than only what's been unlocked. Called
 * unconditionally on every /profile render (not just the badges tab), so
 * unlike awardBadgesSafely's callers it can't rely on a wrapper at the call
 * site — a DB error here (e.g. between deploying this code and the
 * UserBadge table existing on every environment) must fail soft to "show
 * everything locked" rather than 500 the whole profile page. */
export async function getUserBadgesForDisplay(userId: string): Promise<DisplayBadge[]> {
  try {
    const earned = await db.userBadge.findMany({ where: { userId } });
    const earnedMap = new Map(earned.map((b) => [b.badgeId, b.earnedAt]));
    return BADGE_CATALOG.map((def) => ({ def, earnedAt: earnedMap.get(def.id) ?? null }));
  } catch (error) {
    console.error("[badges] getUserBadgesForDisplay failed", error);
    return BADGE_CATALOG.map((def) => ({ def, earnedAt: null }));
  }
}
