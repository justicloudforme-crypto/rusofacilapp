import "server-only";
import { getCurrentUser } from "./auth";
import { isStaff } from "./roles";
import { userHasActiveSubscription } from "./subscription";

/**
 * Gate for the API routes backing Vocabulary/Word games (Stories and
 * Media need no separate check here — their content is embedded directly
 * into the server-rendered page, which proxy.ts's protectContentRoute
 * already blocks before it ever renders for a non-entitled visitor).
 * Vocabulary and word-game puzzle data, by contrast, load through a
 * client-side fetch AFTER the page has rendered — proxy.ts's matcher
 * explicitly excludes `/api/*`, so without this check a page-level
 * redirect alone would still leave the raw content one direct request
 * away for anyone who knew (or guessed) the endpoint. Mirrors
 * protectLessonRoute in proxy.ts: staff bypass, everyone else needs an
 * active, non-expired subscription.
 */
export async function hasContentAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return userHasActiveSubscription(user.id);
}

/**
 * Free-trial sample sizes — how much of each section a non-entitled
 * visitor (logged out, or logged in without an active subscription) gets
 * to try before hitting a paywall. Deliberately small, fixed numbers
 * rather than a percentage: the point is a taste of the product, not a
 * meaningfully usable free tier. See FREEMIUM.md for the full policy
 * (which sections/items are free and why).
 */
export const FREE_TRIAL_LIMITS = {
  flashcards: 10,
  idioms: 5,
  wordGamePuzzlesPerLevel: 5,
} as const;

/** Same staff/subscription check as {@link hasContentAccess}, but without
 * requiring a logged-in user — a free-trial visitor is typically
 * anonymous, and the trial must work for them too. */
export async function isEntitled(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return userHasActiveSubscription(user.id);
}

/**
 * The free-trial word-game sample: the first
 * {@link FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel} WORD_SEARCH rungs of
 * the A1 ladder. Checked against the puzzle itself (not just a page-level
 * gate) in every route that serves puzzle data or grades an answer — a
 * puzzleId is a plain string a client could otherwise pass directly to
 * /api/word-games/check|hint|complete to solve a locked puzzle without
 * ever fetching it through the gated GET route.
 */
export function isFreeWordGamePuzzle(puzzle: { type: string; level: string; sequence: number }): boolean {
  return (
    puzzle.type === "WORD_SEARCH" &&
    puzzle.level === "A1" &&
    puzzle.sequence <= FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel
  );
}
