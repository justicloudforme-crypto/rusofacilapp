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

export async function getLatestSubscription(userId: string) {
  return cached(subscriptionCache, userId, () =>
    db.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  );
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
