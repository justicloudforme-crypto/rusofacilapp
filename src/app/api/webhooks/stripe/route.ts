import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  extendOrGrantSubscription,
  invalidateSubscriptionCache,
  isPremiumPlan,
  reportPremiumPaymentNotApplied,
  revokeAccessForPayment,
} from "@/lib/subscription";
import { settlePendingCheckout } from "@/lib/pending-checkout";
import { LIFETIME_DURATION_DAYS } from "@/lib/plans";
import { awardReferralRewardSafely } from "@/lib/referral";
import { isPlanId, plans } from "@/lib/plans";

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "canceled":
    case "incomplete_expired":
      return status;
    // "past_due", "unpaid", "incomplete", "paused" are all non-paying states
    // as far as course access is concerned.
    default:
      return "past_due";
  }
}

function periodEndOf(subscription: Stripe.Subscription): Date {
  const item = subscription.items.data[0];
  const seconds = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  return new Date(seconds * 1000);
}

/**
 * Makes sure the row Stripe is about to rewrite is not also the row that
 * holds somebody's Premium purchase, and splits them apart if it is.
 *
 * Every handler below addresses a row by `stripeSubscriptionId` and then
 * overwrites its period wholesale, or marks it `canceled`, or marks it
 * `past_due` — correct for a subscription Stripe owns, and destructive for
 * a one-time purchase that merely happens to share the row. Between
 * 24.08.2026 and this fix, a Premium purchase made on top of an active
 * monthly plan did share it: the grant raised `plan` in place instead of
 * opening a row of its own (PROGRESS.md 7.55 and debt 28). Such a row can
 * no longer be created — extendOrGrantSubscription never writes a grant
 * onto a Stripe-owned row — but a row created before the fix would still
 * be out there, and it would lose a hundred years of paid-for access at
 * the next renewal or cancellation, quietly, exactly as before.
 *
 * So a legacy row is repaired the first time Stripe touches it: the
 * Premium half moves to its own record with the period it was granted, and
 * the original row goes back to being the subscription Stripe thinks it
 * is. After that the two lifecycles are independent, which is the whole
 * point of the fix.
 *
 * On production this has nothing to do: the affected-row count was
 * measured on the live database as zero (7.58). It is here so that
 * "measured zero on one day" does not have to be the only thing standing
 * between a buyer and their purchase.
 */
async function detachPremiumFromStripeRow(
  stripeSubscriptionId: string,
  stripePlan: string
): Promise<void> {
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (!existing || !isPremiumPlan(existing.plan)) return;

  await db.subscription.create({
    data: {
      userId: existing.userId,
      plan: existing.plan,
      status: "active",
      currentPeriodEnd: existing.currentPeriodEnd,
    },
  });
  await db.subscription.update({
    where: { id: existing.id },
    // Not isPremiumPlan-able by construction: the caller passes the plan
    // Stripe's own metadata says this subscription is, and a Premium
    // purchase is never a Stripe subscription in the first place (it is
    // mode: "payment", see src/lib/plans.ts).
    data: { plan: isPremiumPlan(stripePlan) ? "unknown" : stripePlan },
  });
  await invalidateSubscriptionCache(existing.userId);
}

async function upsertFromStripeSubscription(subscription: Stripe.Subscription) {
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  const userId = existing?.userId ?? subscription.metadata?.userId;
  if (!userId) return; // nothing we can link this event to

  const metadataPlan = subscription.metadata?.plan ?? "unknown";
  if (existing && isPremiumPlan(existing.plan)) {
    await detachPremiumFromStripeRow(subscription.id, metadataPlan);
  }
  const plan = existing && !isPremiumPlan(existing.plan) ? existing.plan : metadataPlan;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  await db.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: mapStripeStatus(subscription.status),
      currentPeriodEnd: periodEndOf(subscription),
    },
    create: {
      userId,
      plan,
      status: mapStripeStatus(subscription.status),
      currentPeriodEnd: periodEndOf(subscription),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
    },
  });
  await invalidateSubscriptionCache(userId);
}

/** The PaymentIntent id off a Charge or a Dispute, whichever shape arrived. */
function paymentIntentIdOf(object: { payment_intent?: string | { id: string } | null }): string | null {
  const ref = object.payment_intent;
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

/**
 * Money went back; take the access back with it.
 *
 * Resolution is by PAYMENT and by nothing else: the row whose
 * `stripePaymentIntentId` is the PaymentIntent being refunded. That column
 * exists for this (added 08.09.2026, debt 29) and it is written by the two
 * grants that take a one-time payment — the Premium card purchase and every
 * OXXO voucher. That is where the damage was worst: a refunded Premium row
 * carries a period running to 2126, and nothing else in this app would ever
 * close it.
 *
 * What this deliberately does NOT do is widen the search to the person. A
 * refund of one charge must not touch an admin grant, a referral reward, a
 * RevenueCat purchase, or a second subscription somebody is still paying
 * for — and "find this customer's live rows and cancel them" would do all
 * four. The narrow version is why the OTHER grounds for access survive a
 * refund, which is the property src/lib/subscription.test.ts pins down.
 *
 * A refund that matches no row is REPORTED, not swallowed: it means someone
 * has their money back and may still be reading, and the one thing worse
 * than that is nobody knowing. A REFUNDED RECURRING INVOICE lands here too
 * and matches nothing — a Stripe Charge carries no invoice reference in this
 * API version, so a monthly or annual refund cannot be traced to its
 * Subscription row from this event alone. It is a Sentry report today and a
 * written debt, not a silent gap (PROGRESS.md 7.145).
 */
async function revokeForRefundedCharge(
  charge: Pick<Stripe.Charge, "id" | "payment_intent">,
  event: string
): Promise<void> {
  const paymentIntentId = paymentIntentIdOf(charge);
  const { revoked } = await revokeAccessForPayment({ paymentIntentId });
  if (revoked > 0) return;
  await reportRefundNotApplied(event, { chargeId: charge.id, paymentIntentId });
}

/** Files "the money went back and we found nothing to revoke" in Sentry.
 * Never throws: a webhook that throws is a webhook Stripe retries, and
 * retrying a revocation that already happened is worse than losing a
 * report — the same rule as reportPremiumPaymentNotApplied. */
async function reportRefundNotApplied(
  event: string,
  extra: Record<string, unknown>
): Promise<void> {
  try {
    const error = new Error(
      `${event}: money was returned and no access row matched the payment — access may still be open`
    );
    error.name = "RefundLeftAccessOpen";
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "error",
      tags: { defect: "refund-left-access-open", source: event },
      extra,
    });
  } catch {
    // Reporting the problem must never become a second problem.
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured on this server" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // An OXXO Checkout Session (mode: "payment") fires this event the
      // moment the voucher/barcode is generated — before any money has
      // actually moved. It has no `subscription` field at all (that's
      // exclusive to mode: "subscription"), so the branch below is a
      // no-op for it by construction; access is granted later, once the
      // store payment actually clears — see async_payment_succeeded below.
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        if (session.client_reference_id && !subscription.metadata?.userId) {
          subscription.metadata = {
            ...subscription.metadata,
            userId: session.client_reference_id,
          };
        }
        await upsertFromStripeSubscription(subscription);
        // checkout.session.completed fires once per real Checkout Session —
        // exactly the "first purchase" moment a referral reward should key
        // off of (a renewal fires other event types, never this one again).
        if (session.client_reference_id) {
          await awardReferralRewardSafely(session.client_reference_id);
        }
      } else if (session.mode === "payment" && session.metadata?.plan === "lifetime") {
        // A lifetime purchase is also mode: "payment", same as an OXXO
        // voucher session — but unlike OXXO, a card payment settles
        // synchronously, so payment_status is already "paid" by the time
        // this event fires (an OXXO session is still "unpaid" here; it
        // gets access later, via async_payment_succeeded below). Gating on
        // payment_status, not just mode, keeps this branch a no-op for
        // OXXO sessions instead of double-granting access for them.
        const userId = session.client_reference_id;
        if (userId && session.payment_status === "paid") {
          await extendOrGrantSubscription(
            userId,
            LIFETIME_DURATION_DAYS,
            "lifetime",
            paymentIntentIdOf(session)
          );
          // Money in, tier out — checked, not assumed. See
          // reportPremiumPaymentNotApplied and PROGRESS.md 7.55.
          await reportPremiumPaymentNotApplied(userId, "lifetime", {
            source: "checkout.session.completed",
            reference: session.id,
          });
          await awardReferralRewardSafely(userId);
        }
      }
      break;
    }

    // The OXXO voucher was actually paid at a physical store (can be up to
    // `expires_after_days` — 3 — after checkout). This, not
    // checkout.session.completed, is the real "money received" moment for
    // an async payment method, so this is where access is granted. There's
    // no Stripe Subscription object behind an OXXO purchase (see
    // /api/checkout's oxxo branch) — extendOrGrantSubscription writes a
    // plain, non-Stripe-linked Subscription row directly, the same helper
    // used for referral rewards and manual admin grants.
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const planId = session.metadata?.plan;
      if (userId && planId && isPlanId(planId)) {
        await extendOrGrantSubscription(
          userId,
          plans[planId].durationDays,
          planId,
          paymentIntentIdOf(session)
        );
        // The voucher is no longer outstanding — debt 30. Settled before
        // anything else that can fail, so /profile stops telling this person
        // to go and pay even if a later step of this handler throws.
        await settlePendingCheckout(session.id, "paid");
        // Same read-back as the card branch above. A no-op for the monthly
        // and annual voucher plans — it only speaks up for a premium one.
        await reportPremiumPaymentNotApplied(userId, planId, {
          source: "checkout.session.async_payment_succeeded",
          reference: session.id,
        });
        // Same "only on a real payment" rule as the card path's
        // checkout.session.completed handler above — the voucher being
        // generated proves nothing, only it being paid does.
        await awardReferralRewardSafely(userId);
      }
      break;
    }

    // The voucher expired unpaid, or the async payment otherwise failed.
    // Nothing was ever granted for this session (see
    // async_payment_succeeded above), so there is no access to revert — but
    // there IS a pending row saying a voucher is outstanding, and leaving it
    // standing would make /profile promise a payment that can no longer be
    // made (debt 30).
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await settlePendingCheckout(
        session.id,
        event.type === "checkout.session.expired" ? "expired" : "failed"
      );
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertFromStripeSubscription(subscription);
      break;
    }

    // A subscription was canceled (immediately, or its cancellation took
    // effect at period end) — close access right away.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      // A cancellation is the most destructive of the three (it revokes,
      // it does not merely rewrite), so a legacy shared row is split apart
      // before it lands — see detachPremiumFromStripeRow.
      await detachPremiumFromStripeRow(subscription.id, subscription.metadata?.plan ?? "unknown");
      const existing = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        select: { userId: true },
      });
      await db.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "canceled" },
      });
      if (existing) await invalidateSubscriptionCache(existing.userId);
      break;
    }

    // A renewal payment failed — mark the subscription as past_due so
    // access is closed until it's resolved (or Stripe eventually cancels
    // the subscription outright, which fires the event above).
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;

      if (subscriptionId) {
        await detachPremiumFromStripeRow(subscriptionId, "unknown");
        const existing = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { userId: true },
        });
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: "past_due" },
        });
        if (existing) await invalidateSubscriptionCache(existing.userId);
      }
      break;
    }

    /**
     * DEBT 29. The money went back to the buyer.
     *
     * `charge.refunded` fires for a partial refund too, and a partial refund
     * is not a cancelled purchase — someone refunded a few pesos of a 2 299
     * one keeps what they bought. Stripe's own `charge.refunded` boolean is
     * the difference, and it is read instead of any amount so this handler
     * keeps its property of having no concept of money at all (there is a
     * case at the bottom of route.test.ts that holds it to that).
     */
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (!charge.refunded) break; // partial refund — access stands
      await revokeForRefundedCharge(charge, event.type);
      break;
    }

    /**
     * A chargeback. Stripe withdraws the funds the moment a dispute is
     * opened, so this is treated exactly like a refund and not deferred to
     * `charge.dispute.closed`: waiting would leave the content open for the
     * weeks a dispute takes to resolve, on money we no longer hold.
     */
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      await revokeForRefundedCharge({ id: charge, payment_intent: dispute.payment_intent }, event.type);
      break;
    }

    // A dispute ended. Won means the money came back to us — and the access
    // is NOT restored automatically: this handler revoked rows it can no
    // longer tell apart from rows that were cancelled for other reasons, and
    // guessing would hand access back to somebody who never had it. An admin
    // grant (/api/admin/subscriptions/grant) is the deliberate way back.
    // Acknowledged rather than left to `default` so the omission is a
    // written decision. PROGRESS.md 7.145, new debt.
    case "charge.dispute.closed":
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
