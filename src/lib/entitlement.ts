import "server-only";
import { getCurrentUser } from "./auth";
import { isStaff } from "./roles";
import { getEntitlementTierForUser, userHasActiveSubscription } from "./subscription";
import { LITERARY_IDIOM_LIMITS } from "./free-trial-limits";
import type { EntitlementTierValue } from "./subscription";

/**
 * Three-tier content model (replaces the old binary entitled/not-entitled
 * check for C1-level vocabulary/stories and ★ word games — everything else
 * still only cares about "free" vs "not free", see {@link isEntitled}):
 *
 * - "free": no active subscription (or staff-free anonymous visitor) — gets
 *   the free-trial sample only.
 * - "standard": an active monthly or annual subscription — full access
 *   EXCEPT the Premium-exclusive content below.
 * - "premium": an active lifetime subscription ("Premium" plan) — full
 *   access, no restrictions.
 *
 * Staff always resolve to "premium" (same bypass-everything rule as
 * isEntitled/hasContentAccess elsewhere in this file).
 */
export type EntitlementTier = EntitlementTierValue;

export async function getEntitlementTier(): Promise<EntitlementTier> {
  const user = await getCurrentUser();
  if (!user) return "free";
  if (isStaff(user.role)) return "premium";

  // The maximum over every live row, not the newest row's plan: a person
  // can hold a Premium purchase and a monthly subscription at the same
  // time, and those are two independent grounds for access with two
  // independent lifecycles. See tierOfSubscriptions in subscription.ts.
  return getEntitlementTierForUser(user.id);
}

/**
 * C1 is the one CEFR level reserved for Premium — every other level
 * (including the free-trial sample, capped separately by FREE_TRIAL_LIMITS)
 * is available to any active subscriber. Reused identically for
 * flashcards, idioms, and stories so "Premium-only content" means one
 * consistent thing across the app rather than three separate rules.
 */
export function canAccessLevel(tier: EntitlementTier, level: string): boolean {
  if (level !== "C1") return true;
  return tier === "premium";
}

/**
 * Full access decision for one Story row, shared by the reader page (gates
 * the actual text/audio) and the catalog page (sorts + locks list items) —
 * one place so the two can never drift. `reason` is what a lock UI should
 * pass to usePaywall().openPaywall(): "free" when the visitor isn't
 * subscribed at all yet, "premium" when they're already a "standard"
 * subscriber but this specific story needs the Premium (lifetime) plan.
 * `null` means the story is fully accessible.
 */
export function getStoryAccess(
  tier: EntitlementTier,
  story: { level: string; isPremium: boolean; premiumOnly: boolean }
): { entitled: boolean; reason: "free" | "premium" | null } {
  const hasSubscriptionAccess = !story.isPremium || tier !== "free";
  if (!hasSubscriptionAccess) return { entitled: false, reason: "free" };

  const requiresPremiumTier = story.premiumOnly || story.level === "C1";
  if (requiresPremiumTier && !isPremiumTier(tier)) return { entitled: false, reason: "premium" };

  return { entitled: true, reason: null };
}

/**
 * Media has no Premium-exclusive slice (unlike stories/word games) — just
 * a curated free-trial sample (MediaItem.free, see mediaData.json) vs.
 * everything else needing any active subscription. Shared by the catalog
 * page (sorts + locks list items) and the detail page (gates the actual
 * player/subtitles/exercises).
 */
export function canAccessMediaItem(tier: EntitlementTier, item: { free?: boolean }): boolean {
  return Boolean(item.free) || tier !== "free";
}

/** Generic "requires the Premium (lifetime) plan specifically" check —
 * `standard` doesn't pass this even though it passes canAccessLevel/
 * hasContentAccess. Backs Story.premiumOnly, WordGamePuzzle.premiumOnly,
 * and curved word games below. */
export function isPremiumTier(tier: EntitlementTier): boolean {
  return tier === "premium";
}

/** ★ (curved) word-search puzzles are Premium-exclusive — a "harder game"
 * per the pricing grid, gated the same way as C1 content above. Every
 * curved puzzle is also flagged `premiumOnly` (see schema.prisma), so
 * callers should check both — this one stays as a defense-in-depth
 * fallback in case a future puzzle-generation script sets `curved`
 * without also setting `premiumOnly`. */
export function canAccessCurvedPuzzle(tier: EntitlementTier): boolean {
  return isPremiumTier(tier);
}

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
 * The two free-trial constants live in src/lib/free-trial-limits.ts and are
 * re-exported here, unchanged, for the same reason isFreeWordGamePuzzle is
 * re-exported at the bottom of this file: the numbers are needed by callers
 * that cannot import a `server-only` module — src/lib/intro/stats.ts, which
 * is the introduction deck's only source of numbers, and the guard that
 * reads it under tsx. One definition, every existing import untouched.
 */
export { FREE_TRIAL_LIMITS, LITERARY_IDIOM_LIMITS } from "./free-trial-limits";

export function getLiteraryIdiomLimit(tier: EntitlementTier): number | null {
  if (tier === "premium") return null;
  return LITERARY_IDIOM_LIMITS[tier];
}

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
 * {@link FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel} rungs of the A1 ladder,
 * for both WORD_SEARCH and CROSSWORD — a real device/content report found
 * CROSSWORD was never included here, so every crossword redirected a
 * non-subscriber straight to /pricing with no free sample at all (looked
 * like "crosswords don't exist" from the outside). Checked against the
 * puzzle itself (not just a page-level gate) in every route that serves
 * puzzle data or grades an answer — a puzzleId is a plain string a client
 * could otherwise pass directly to /api/word-games/check|hint|complete to
 * solve a locked puzzle without ever fetching it through the gated GET route.
 */
export { isFreeWordGamePuzzle } from "./word-games/free-tier";
