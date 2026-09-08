import "server-only";
import { db } from "./db";

/**
 * The record of a checkout somebody started and has not finished paying for.
 *
 * One payment method needs this and only one: OXXO. A card charge settles
 * while the buyer is still looking at Stripe's page; an OXXO voucher is a
 * barcode they carry to a shop, and Stripe gives them up to three days
 * (`expires_after_days` in /api/checkout). DEBT 30 is the gap in between:
 * nothing was stored, so the only trace of a taken voucher was
 * `?checkout=oxxo_pending` in the URL Stripe bounced them to. Close the tab,
 * come back to /profile, and the page said "no subscription" with a buy
 * button under it — the most likely next thing a person does is pay again.
 *
 * A row here is NOT access, carries no period and no tier, and the access
 * rule (tierOfAccount, src/lib/entitlement.ts) never reads this table.
 */

/** Vouchers a person still has outstanding: opened, not settled, not past
 * their expiry. Newest first. */
export async function getOpenPendingCheckouts(userId: string) {
  return db.pendingCheckout.findMany({
    where: { userId, settledAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/** The one voucher /profile should talk about, or null. */
export async function getOpenPendingCheckout(userId: string) {
  const rows = await getOpenPendingCheckouts(userId);
  return rows[0] ?? null;
}

/**
 * Opens the record when the voucher is created.
 *
 * Idempotent on the session id: Stripe can deliver an event twice and a
 * person can double-submit a form, and a second voucher record for one
 * session would make the count of outstanding vouchers a lie.
 */
export async function openPendingCheckout(input: {
  userId: string;
  plan: string;
  method?: string;
  stripeSessionId: string;
  expiresAt: Date;
}) {
  return db.pendingCheckout.upsert({
    where: { stripeSessionId: input.stripeSessionId },
    update: {},
    create: {
      userId: input.userId,
      plan: input.plan,
      method: input.method ?? "oxxo",
      stripeSessionId: input.stripeSessionId,
      expiresAt: input.expiresAt,
    },
  });
}

/**
 * Closes the record — paid at the shop, expired unpaid, or failed.
 *
 * `updateMany` rather than `update` so an event about a session this app has
 * no record of is a no-op instead of a throw: a webhook that throws is a
 * webhook Stripe retries forever.
 *
 * Only an OPEN row is settled. Re-delivering `async_payment_succeeded` after
 * `expired` must not rewrite an outcome that has already been decided.
 */
export async function settlePendingCheckout(
  stripeSessionId: string,
  outcome: "paid" | "expired" | "failed"
): Promise<number> {
  const { count } = await db.pendingCheckout.updateMany({
    where: { stripeSessionId, settledAt: null },
    data: { settledAt: new Date(), outcome },
  });
  return count;
}
