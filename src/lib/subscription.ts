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
  () => new TtlCache<Subscription | null>(30_000, "subscription")
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

export async function getLatestSubscription(userId: string) {
  const row = await cached(subscriptionCache, userId, () =>
    db.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  );
  return row ? reviveSubscriptionDates(row) : row;
}

/** Batched counterpart to getLatestSubscription for a whole list of users
 * at once — same "one query instead of N sequential round trips" pattern
 * as getLevelProgressForUsers, used by the group leaderboard (up to
 * MAX_GROUP_MEMBERS rows) to know which members' avatars get the Premium
 * gold ring without one query per member. Not cached (unlike
 * getLatestSubscription) since a leaderboard render is infrequent compared
 * to the per-lesson access checks that cache exists for. */
export async function getLatestSubscriptionsForUsers(
  userIds: string[]
): Promise<Map<string, Subscription | null>> {
  const result = new Map<string, Subscription | null>();
  if (userIds.length === 0) return result;
  for (const id of userIds) result.set(id, null);

  const rows = await db.subscription.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    if (result.get(row.userId) === null) result.set(row.userId, row);
  }
  return result;
}

/** All of a user's Subscription rows, newest first — the profile page's
 * "payment history" tab, since this demo-auth setup has no separate
 * invoice/payment model and each Subscription row already stands for one
 * billing cycle (plan, status, period). Not cached like getLatestSubscription
 * since it's only read on the profile page, not on every access check. */
export async function getSubscriptionHistory(userId: string) {
  return db.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
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

/** Extends the user's current subscription period if it's still active, or
 * grants a fresh one if not — shared by every "add N days" path (the Stripe
 * webhook's lifetime and OXXO branches, admin manual grant, referral
 * rewards) so they can't drift into two different extend-vs-create rules.
 *
 * The extend branch deliberately keeps the stored `plan` rather than
 * overwriting it with the caller's, with ONE exception: a grant that raises
 * the entitlement tier. Both halves of that matter.
 *
 * Keeping it is why a referral bonus or a manual admin grant — both of
 * which pass their own plan id ("referral", "manual", neither of them
 * Premium) — cannot quietly demote a paying Premium customer to standard.
 *
 * Raising it is a production bug fix, not tidying (PROGRESS.md 7.55). This
 * function is what the Stripe webhook calls when a Lifetime/Premium
 * purchase is paid, by card and by OXXO alike. Before this, a customer who
 * already had ANY active subscription row — a monthly plan, referral days,
 * an admin grant — had only their period extended: the row still said
 * "monthly", getEntitlementTier still answered "standard", and the person
 * who had just paid for Premium got none of the Premium content. Nothing in
 * the system reported a failure; the money arrived and the entitlement did
 * not.
 */
export async function extendOrGrantSubscription(userId: string, days: number, plan: string) {
  const extraMs = days * 24 * 60 * 60 * 1000;
  const existing = await getLatestSubscription(userId);

  if (existing && isSubscriptionActive(existing)) {
    const raisesTier = isPremiumPlan(plan) && !isPremiumPlan(existing.plan);
    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        currentPeriodEnd: new Date(existing.currentPeriodEnd.getTime() + extraMs),
        ...(raisesTier ? { plan } : {}),
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

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getLatestSubscription(userId);
  return isSubscriptionActive(subscription);
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
