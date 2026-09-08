import "server-only";
import { getCurrentUser } from "./auth";
import { isStaff } from "./roles";
import {
  getSubscriptionsForUser,
  getSubscriptionRowsForUsers,
  higherTier,
  tierOfSubscriptions,
} from "./subscription";
import { LITERARY_IDIOM_LIMITS } from "./free-trial-limits";
import { PLAN_TIER, type PlanId } from "./plans";
import type { EntitlementTierValue, StoredEntitlementRow } from "./subscription";

/**
 * Three-tier content model (replaces the old binary entitled/not-entitled
 * check for C1-level vocabulary/stories and ★ word games — everything else
 * still only cares about "free" vs "not free", see {@link hasAnyAccess}):
 *
 * - "free": no active subscription (or staff-free anonymous visitor) — gets
 *   the free-trial sample only.
 * - "standard": an active monthly or annual subscription — full access
 *   EXCEPT the Premium-exclusive content below.
 * - "premium": an active lifetime subscription ("Premium" plan) — full
 *   access, no restrictions.
 *
 * Staff always resolve to "premium".
 */
export type EntitlementTier = EntitlementTierValue;

/**
 * THE decision. One function, and the only one in this app that answers
 * "what may this person open" — everything else either feeds it rows or
 * reads its answer.
 *
 * Until 08.09.2026 this was not true, and the audit of window C measured
 * how untrue: seven call sites outside this module assembled the answer
 * themselves (four routes repeating `!isStaff(role) && !(await
 * userHasActiveSubscription(id))` verbatim, `/profile` calling
 * `tierOfSubscriptions` on its own history read, `groups.ts` and
 * `public-profile.ts` going straight to the batched/per-user readers), and
 * three exported functions in this very file each carried their own copy of
 * the session lookup and the staff bypass. Ten places, one question.
 * Nothing had drifted yet; nothing was stopping it either.
 *
 * Two rules, in this order, and they are the whole rule:
 *
 *   1. Staff — owner or admin — are "premium" without any stored row.
 *      A staff account that never went through checkout must not be shown
 *      the same upsells as an unsubscribed student.
 *   2. Otherwise the tier is the BEST live ground for access the person
 *      holds, over every row, not the newest one. See tierOfSubscriptions
 *      in subscription.ts for why that is a maximum and not a lookup.
 *
 * Synchronous and pure on purpose: the rows come from the caller, so the
 * batched form below applies exactly the same rule as the session form
 * without either of them re-deriving it.
 *
 * Held to this by `npm run check:entitlement-point`, which fails on any
 * file outside this module that reaches for the internals instead.
 */
export function tierOfAccount(
  user: { role: string } | null | undefined,
  rows: readonly StoredEntitlementRow[]
): EntitlementTier {
  if (!user) return "free";
  if (isStaff(user.role)) return "premium";
  return tierOfSubscriptions(rows);
}

/** The visitor of the current request. Front door #1 — fetches, then asks
 * {@link tierOfAccount}. */
export async function getEntitlementTier(): Promise<EntitlementTier> {
  return getEntitlementTierFor(await getCurrentUser());
}

/** One named person, when the caller already holds their row (a page that
 * loaded the user itself, a public profile). Front door #2. */
export async function getEntitlementTierFor(
  user: { id: string; role: string } | null | undefined
): Promise<EntitlementTier> {
  if (!user) return "free";
  // Staff never need a database read to be "premium", and asking for one
  // would be the only difference between the two front doors.
  if (isStaff(user.role)) return tierOfAccount(user, []);
  return tierOfAccount(user, await getSubscriptionsForUser(user.id));
}

/**
 * A list of people at once — the group leaderboard's gold rings. Front
 * door #3: ONE query for every member's rows instead of one round trip per
 * member, and then the same {@link tierOfAccount} per person.
 *
 * It takes the roles as well as the ids since 08.09.2026: reading rows
 * alone made this the one place in the app where a staff account was NOT
 * premium, purely because the batched reader had no role to look at.
 */
export async function getEntitlementTiersFor(
  users: ReadonlyArray<{ id: string; role: string }>
): Promise<Map<string, EntitlementTier>> {
  const rowsByUser = await getSubscriptionRowsForUsers(users.map((u) => u.id));
  const result = new Map<string, EntitlementTier>();
  for (const user of users) {
    result.set(user.id, tierOfAccount(user, rowsByUser.get(user.id) ?? []));
  }
  return result;
}

/**
 * "Any live ground for access at all" — the free-vs-paid question, as
 * opposed to which tier. A reading of {@link tierOfAccount}'s answer, not a
 * second decision: `tierOfStoredSubscription` returns "free" for exactly
 * the rows `isSubscriptionActive` rejects, so `tier !== "free"` and "some
 * row is live" are the same predicate.
 *
 * Replaces `hasContentAccess()` and `isEntitled()`, which were two
 * identical copies of the session lookup plus the staff bypass plus the
 * binary read, and which had zero callers between them by 08.09.2026.
 */
export function hasAnyAccess(tier: EntitlementTier): boolean {
  return tier !== "free";
}

/**
 * Would buying `planId` give this person anything they do not already have?
 *
 * DEBT 33, and it cost real money to leave open: `/pricing` did not know
 * the visitor's tier and `/api/checkout` did not look at what they already
 * held, so the owner of a Premium purchase — a plan with a hundred-year
 * period that can never lapse — could press "buy" and be charged the full
 * 2 299 MXN a second time, with no refund path behind it (debt 29). The
 * same held one tier down: a live monthly subscriber pressing "buy" on the
 * annual plan opened a SECOND concurrent subscription rather than changing
 * the first.
 *
 * The rule is the tier ladder and nothing else: a purchase is refused when
 * the buyer already stands at or above the tier the plan grants. So
 * standard → Premium is allowed (it is a real upgrade), Premium → anything
 * is refused (nothing outranks Premium), and standard → monthly/annual is
 * refused (a second concurrent subscription at the same tier is two charges
 * for one thing; this app offers no plan-switch flow, only cancel).
 *
 * Deliberately reads {@link tierOfAccount}'s answer rather than the stored
 * rows, which means a STAFF account is refused every checkout — staff are
 * premium by rule, so a purchase would add nothing to them either. Live
 * payment testing therefore has to happen on a non-staff account, which is
 * how it already happens (PROGRESS.md 7.106).
 */
export function planAddsNothing(tier: EntitlementTier, planId: PlanId): boolean {
  return higherTier(tier, PLAN_TIER[planId]) === tier;
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
 * `standard` doesn't pass this even though it passes canAccessLevel and
 * hasAnyAccess. Backs Story.premiumOnly, WordGamePuzzle.premiumOnly,
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
