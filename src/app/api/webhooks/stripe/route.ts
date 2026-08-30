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
} from "@/lib/subscription";
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
          await extendOrGrantSubscription(userId, LIFETIME_DURATION_DAYS, "lifetime");
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
        await extendOrGrantSubscription(userId, plans[planId].durationDays, planId);
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
    // async_payment_succeeded above), so there's nothing to revert here —
    // this case exists so the event type is explicitly acknowledged
    // instead of silently falling through to `default`.
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      break;

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

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
