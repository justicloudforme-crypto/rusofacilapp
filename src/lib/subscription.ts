import "server-only";
import { db } from "./db";
import type { Subscription } from "@/generated/prisma/client";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";

const INACTIVE_STATUSES = new Set(["canceled", "past_due", "incomplete_expired"]);

/**
 * Access is derived from `currentPeriodEnd`, not just from `status`. This
 * means a subscription is automatically treated as expired the moment its
 * period ends, even if the Stripe webhook that flips `status` hasn't
 * arrived yet — the deciding check always happens at read time.
 */
export function isSubscriptionActive(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined
): boolean {
  if (!subscription) return false;
  if (INACTIVE_STATUSES.has(subscription.status)) return false;
  if (subscription.currentPeriodEnd.getTime() <= Date.now()) return false;
  return subscription.status === "active" || subscription.status === "trialing";
}

export const MANUAL_GRANT_DAYS = 30;

// 30s is short enough that a just-purchased or just-canceled subscription
// is never stale for long, but long enough to absorb the duplicate lookups
// that happen on every lesson view (once in the proxy gate, once in the
// page itself — see src/proxy.ts and the lesson page's own access check).
// Caches the raw DB row, not the derived active/expired boolean, so the
// time-based expiry check in isSubscriptionActive() still runs fresh on
// every call — only the read is cached, not the answer.
const subscriptionCache = getOrCreateGlobalSingleton(
  "subscriptionCache",
  () => new TtlCache<Subscription[]>(30_000, "subscription", Array.isArray)
);

// The Redis path stores/reads T through JSON (see ttl-cache.ts), which
// turns Date fields into plain strings on the way back — a cache hit for a
// Subscription row would otherwise silently hand callers a `currentPeriodEnd`
// that isn't actually a Date, breaking isSubscriptionActive's `.getTime()`
// call (and anything else that treats it as one) on every warm read, not
// just a cold DB one. Revives the three Date columns after every read
// through the cache so a Subscription row is always a real Subscription
// regardless of whether it came from Redis or Prisma.
function reviveSubscriptionDates(row: Subscription): Subscription {
  return {
    ...row,
    currentPeriodEnd: new Date(row.currentPeriodEnd),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * Every Subscription row this user has, newest first.
 *
 * Plural, and that is the whole point. A person can hold more than one
 * standing reason to have access at the same time, and those reasons have
 * independent lifecycles: a monthly Stripe subscription that renews and
 * cancels on Stripe's schedule, a one-time Premium purchase that is not a
 * subscription at all and can never expire, a referral bonus, an admin
 * grant, a native store purchase relayed by RevenueCat. Reading only the
 * newest row (which is what this function used to do) makes whichever
 * reason happens to be newest the only one that counts, so a later monthly
 * subscription hides an earlier Premium purchase, and a Stripe cancellation
 * takes a bought-forever access down with it. The tier is a maximum over
 * all live reasons — see tierOfSubscriptions.
 *
 * Cheap to fetch as a list: a user has a handful of rows over their whole
 * lifetime (three across the entire production table on 30.08.2026), and
 * the @@index([userId, createdAt]) this walks is the same one the old
 * single-row findFirst used.
 */
export async function getSubscriptionsForUser(userId: string): Promise<Subscription[]> {
  const rows = await cached(subscriptionCache, userId, () =>
    db.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  );
  return rows.map(reviveSubscriptionDates);
}

/** The newest row, for the places that legitimately mean "the most recent
 * thing that happened to this account" (payment-history header, the
 * Stripe id to cancel). NOT the place to decide access — that is
 * getEntitlementTierForUser, which looks at every row. */
export async function getLatestSubscription(userId: string) {
  const rows = await getSubscriptionsForUser(userId);
  return rows[0] ?? null;
}

/** Batched counterpart to getEntitlementTierForUser for a whole list of
 * users at once — same "one query instead of N sequential round trips"
 * pattern as getLevelProgressForUsers, used by the group leaderboard (up
 * to MAX_GROUP_MEMBERS rows) to know which members' avatars get the
 * Premium gold ring without one query per member. Not cached (unlike
 * getSubscriptionsForUser) since a leaderboard render is infrequent
 * compared to the per-lesson access checks that cache exists for.
 *
 * Returns a tier rather than a row for the same reason getEntitlementTier
 * stopped reading one row: a member holding a Premium purchase AND a
 * monthly subscription has two rows, and whichever is newer is not the
 * answer to "does this person get the gold ring". */
export async function getEntitlementTiersForUsers(
  userIds: string[]
): Promise<Map<string, EntitlementTierValue>> {
  const result = new Map<string, EntitlementTierValue>();
  if (userIds.length === 0) return result;
  for (const id of userIds) result.set(id, "free");

  const rows = await db.subscription.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
  });
  const byUser = new Map<string, Subscription[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId);
    if (list) list.push(row);
    else byUser.set(row.userId, [row]);
  }
  for (const [userId, userRows] of byUser) {
    result.set(userId, tierOfSubscriptions(userRows));
  }
  return result;
}

/** Call after any write to a user's Subscription rows (checkout, cancel,
 * webhook, admin grant/revoke) so the next read reflects it immediately
 * instead of waiting out the TTL. */
export async function invalidateSubscriptionCache(userId: string) {
  await subscriptionCache.del(userId);
}

/** The single plan id that means the Premium tier. Lives here, next to the
 * only writer of `Subscription.plan`, so the write side and the read side
 * (src/lib/entitlement.ts) cannot drift into two different opinions about
 * what "Premium" is stored as. */
export const PREMIUM_PLAN_ID = "lifetime";

export function isPremiumPlan(plan: string): boolean {
  return plan === PREMIUM_PLAN_ID;
}

/** Same three values as EntitlementTier in src/lib/entitlement.ts, spelled
 * out here because that module imports this one and not the other way
 * round. Kept in sync by src/lib/entitlement.ts assigning one to the
 * other — a mismatch is a type error, not a runtime surprise. */
export type EntitlementTierValue = "free" | "standard" | "premium";

const TIER_RANK: Record<EntitlementTierValue, number> = { free: 0, standard: 1, premium: 2 };

export function higherTier(a: EntitlementTierValue, b: EntitlementTierValue): EntitlementTierValue {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

/**
 * The tier a set of rows grants: the HIGHEST tier any single live row
 * grants, not the tier of the newest row.
 *
 * This is the read half of "a Premium purchase lives on its own record".
 * Access has several independent grounds — a card or OXXO subscription, a
 * one-time Premium purchase, an admin grant, a referral bonus, a native
 * store purchase — and each is stored as its own row with its own status
 * and its own period. Any one of them still being live is enough, and the
 * best of them is what the person gets. Reading a single row instead made
 * the grounds compete: buying a monthly plan after owning Premium would
 * have demoted the buyer, and cancelling that monthly plan would have
 * taken Premium away.
 */
export function tierOfSubscriptions(
  rows: readonly Pick<Subscription, "plan" | "status" | "currentPeriodEnd">[]
): EntitlementTierValue {
  let tier: EntitlementTierValue = "free";
  for (const row of rows) {
    tier = higherTier(tier, tierOfStoredSubscription(row));
    if (tier === "premium") return tier; // nothing outranks it
  }
  return tier;
}

/** The one place the app asks "what may this user open". */
export async function getEntitlementTierForUser(userId: string): Promise<EntitlementTierValue> {
  return tierOfSubscriptions(await getSubscriptionsForUser(userId));
}

/**
 * The single row the UI should describe when it has room for exactly one —
 * the plan name, the renewal date, the status badge on /profile.
 *
 * Ranked by what the reader actually wants to know: the best live tier
 * first, then the one that lasts longest, and only if nothing is live at
 * all, the newest expired/cancelled row (so the page can say *why* there
 * is no access instead of saying nothing). Deliberately NOT the same
 * choice as getLatestSubscription: after buying Premium on top of a
 * monthly plan, the newest row and the row worth showing are the same, but
 * after the monthly plan renews they no longer are.
 */
export function pickEffectiveSubscription<T extends Pick<Subscription, "plan" | "status" | "currentPeriodEnd">>(
  rows: readonly T[]
): T | null {
  if (rows.length === 0) return null;
  const live = rows.filter((row) => isSubscriptionActive(row));
  if (live.length === 0) return rows[0];
  return live.reduce((best, row) => {
    const bestRank = TIER_RANK[tierOfStoredSubscription(best)];
    const rowRank = TIER_RANK[tierOfStoredSubscription(row)];
    if (rowRank !== bestRank) return rowRank > bestRank ? row : best;
    return row.currentPeriodEnd.getTime() > best.currentPeriodEnd.getTime() ? row : best;
  });
}

/**
 * Adds `days` of access on the `plan` ground, extending the row that
 * already stands for that same ground if there is one, and opening a new
 * row if there is not — shared by every "add N days" path (the Stripe
 * webhook's Premium and OXXO branches, admin manual grant, referral
 * rewards, the e2e grant route) so they cannot drift into two different
 * extend-vs-create rules.
 *
 * Which row a grant may be written onto is the entire subject of this
 * function, and two rules decide it.
 *
 * **1. Never a row that Stripe owns.** A row with `stripeSubscriptionId`
 * set is rewritten wholesale by upsertFromStripeSubscription on every
 * `customer.subscription.updated`, and marked `canceled` outright by
 * `customer.subscription.deleted` — by subscription id, without ever
 * looking at what else has been added to that row. So anything granted
 * onto it is not stored, it is merely borrowed until Stripe's next event:
 * a renewal collapses the added days back to one billing period, and a
 * cancellation voids them entirely. That is true of Premium (a hundred
 * years of paid-for access disappearing when a seven-dollar monthly plan
 * is cancelled — PROGRESS.md debt 28), and it is equally true of referral
 * days and admin grants. Grants therefore live on rows this app owns and
 * Stripe does not touch.
 *
 * **2. Never mix tiers on one row.** A Premium grant extends only an
 * existing Premium row, and a non-Premium grant extends only a
 * non-Premium one. This replaces the older "keep the stored plan, unless
 * the new one raises the tier" special case, and it replaces it in the
 * direction that has no edge cases: a referral bonus or an admin grant
 * ("referral"/"manual", neither of them Premium) cannot demote a paying
 * Premium customer because it is not written to their Premium row at all,
 * and a Premium purchase does not have to overwrite somebody's monthly
 * plan to take effect because it no longer shares a row with it. What
 * makes that safe is the read side: getEntitlementTierForUser takes the
 * best tier across every live row, so two rows mean two live grounds for
 * access, not a contest between them.
 */
export async function extendOrGrantSubscription(userId: string, days: number, plan: string) {
  const extraMs = days * 24 * 60 * 60 * 1000;
  const rows = await getSubscriptionsForUser(userId);
  const premiumGrant = isPremiumPlan(plan);

  const target = rows.find(
    (row) =>
      row.stripeSubscriptionId === null &&
      row.rcOriginalTransactionId === null &&
      isSubscriptionActive(row) &&
      isPremiumPlan(row.plan) === premiumGrant
  );

  if (target) {
    await db.subscription.update({
      where: { id: target.id },
      data: {
        status: "active",
        currentPeriodEnd: new Date(target.currentPeriodEnd.getTime() + extraMs),
      },
    });
  } else {
    await db.subscription.create({
      data: {
        userId,
        plan,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + extraMs),
      },
    });
  }
  await invalidateSubscriptionCache(userId);
}

/** The tier a stored row grants, decided by exactly the two rules the read
 * side uses (isSubscriptionActive, then isPremiumPlan — see
 * getEntitlementTier in src/lib/entitlement.ts), minus the session lookup
 * and the staff bypass, because a webhook has neither a request nor a
 * reason to let a staff role hide a failed purchase. */
export function tierOfStoredSubscription(
  subscription: Pick<Subscription, "plan" | "status" | "currentPeriodEnd"> | null | undefined
): EntitlementTierValue {
  if (!isSubscriptionActive(subscription)) return "free";
  return isPremiumPlan(subscription!.plan) ? "premium" : "standard";
}

/**
 * Reads back what a paid Premium grant actually stored, and reports the
 * mismatch to Sentry when the money arrived and the tier did not.
 *
 * This exists because of a defect that ran in production from 24.08.2026
 * to 30.08.2026 (PROGRESS.md 7.55): a Premium purchase on top of an
 * already-active row extended the period and left `plan` alone, so the
 * buyer stayed on "standard". Nothing failed anywhere — Stripe reported a
 * successful payment, the webhook returned 200, no exception was thrown,
 * and the only trace was a person who could not open the content they had
 * just bought. The fix stops it happening; this stops it happening
 * *silently*, which is the part that let it live six days.
 *
 * Deliberately a read-back rather than an assertion inside the writer: the
 * question is what the database ends up holding, and a writer that checks
 * its own intent would have agreed with itself in the broken version too.
 *
 * Never throws. A webhook that throws is a webhook Stripe retries, and
 * retrying a grant that already succeeded is worse than losing one report.
 */
export async function reportPremiumPaymentNotApplied(
  userId: string,
  paidPlan: string,
  context: { source: string; reference?: string | null }
): Promise<"free" | "standard" | "premium" | null> {
  if (!isPremiumPlan(paidPlan)) return null;

  // Fresh, not the 30s cache: extendOrGrantSubscription invalidates this
  // user's entry as its last step, so the read below sees the write. And
  // over every row, not the newest one, because that is the question the
  // product answers when it decides what to unlock — a read-back that
  // asked a narrower question than the gate does would report a mismatch
  // the buyer never experiences, and (worse) could miss one they do.
  const rows = await getSubscriptionsForUser(userId);
  const tier = tierOfSubscriptions(rows);
  if (tier === "premium") return tier;
  const stored = pickEffectiveSubscription(rows);

  try {
    const error = new Error(
      `Paid "${paidPlan}" did not grant Premium: user ${userId} is on tier "${tier}" ` +
        `after the payment was processed (stored plan: ${stored?.plan ?? "no row"})`
    );
    error.name = "PremiumEntitlementMismatch";
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "error",
      tags: { defect: "premium-entitlement-mismatch", source: context.source },
      extra: {
        userId,
        paidPlan,
        observedTier: tier,
        storedPlan: stored?.plan ?? null,
        storedStatus: stored?.status ?? null,
        storedPeriodEnd: stored?.currentPeriodEnd?.toISOString() ?? null,
        subscriptionRowId: stored?.id ?? null,
        reference: context.reference ?? null,
      },
    });
  } catch {
    // Reporting the problem must never become a second problem.
  }
  return tier;
}

/** Any live ground for access at all — the "free vs. not free" question,
 * as opposed to getEntitlementTierForUser's "which tier". Reads every row
 * for the same reason: an expired monthly row sitting in front of a live
 * admin grant must not answer for it. */
export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const rows = await getSubscriptionsForUser(userId);
  return rows.some((row) => isSubscriptionActive(row));
}

export type DisplayStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

/**
 * UI-facing status: unlike the raw `status` column, this folds in the
 * date-based auto-expiry from `isSubscriptionActive` — a subscription still
 * marked "active" in the database past its `currentPeriodEnd` is shown as
 * "expired", not "active".
 */
export function getDisplayStatus(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined
): DisplayStatus {
  if (!subscription) return "none";
  if (subscription.status === "canceled") return "canceled";
  if (subscription.status === "past_due") return "past_due";
  if (!isSubscriptionActive(subscription)) return "expired";
  return subscription.status === "trialing" ? "trialing" : "active";
}
