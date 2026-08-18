import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { invalidateSubscriptionCache } from "@/lib/subscription";

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

async function upsertFromStripeSubscription(subscription: Stripe.Subscription) {
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  const userId = existing?.userId ?? subscription.metadata?.userId;
  if (!userId) return; // nothing we can link this event to

  const plan = existing?.plan ?? subscription.metadata?.plan ?? "unknown";
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
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        if (session.client_reference_id && !subscription.metadata?.userId) {
          subscription.metadata = {
            ...subscription.metadata,
            userId: session.client_reference_id,
          };
        }
        await upsertFromStripeSubscription(subscription);
      }
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
