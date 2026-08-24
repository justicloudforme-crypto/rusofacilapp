import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import type { PlanId } from "@/lib/plans";

// RevenueCat webhooks (https://www.revenuecat.com/docs/integrations/webhooks)
// don't sign the body like Stripe does — auth is a plain shared secret sent
// as `Authorization: Bearer <secret>`, configured once in the RevenueCat
// dashboard's webhook settings. Timing-safe compare isn't worth the
// complexity here: this header is a fixed shared secret compared once per
// request, not a password-auth path.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

// RevenueCat's app_user_id is whatever we passed to `Purchases.logIn()` on
// the client — per the hybrid-billing architecture, that's always set to
// our own internal userId directly (unlike Stripe, which needs a metadata
// round-trip because Stripe has no concept of "our" user id at all).
interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  original_transaction_id?: string | null;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
}

// "lifetime" is not a Stripe PlanId (see src/lib/plans.ts) — it's sold
// exclusively as a native, non-renewing store product, never through
// Stripe on web, so it's kept out of that Stripe-specific type rather
// than conflated with it.
type RevenueCatPlanId = PlanId | "lifetime";

// Maps a store product identifier (configured in App Store Connect / Play
// Console and mirrored into RevenueCat) to our internal plan id, the same
// way STRIPE_PRICE_MONTHLY/ANNUAL map a Stripe Price id to one. Values are
// filled in once real store products exist — until then this map is empty
// and events fall back to "unknown", same as the Stripe webhook does for
// an unrecognized subscription.
function planFromProductId(productId: string | undefined): RevenueCatPlanId | "unknown" {
  const monthly = process.env.REVENUECAT_PRODUCT_MONTHLY;
  const annual = process.env.REVENUECAT_PRODUCT_ANNUAL;
  const lifetime = process.env.REVENUECAT_PRODUCT_LIFETIME;
  if (productId && monthly && productId === monthly) return "monthly";
  if (productId && annual && productId === annual) return "annual";
  if (productId && lifetime && productId === lifetime) return "lifetime";
  return "unknown";
}

// A lifetime purchase is a StoreKit "non-consumable" — it has no renewal,
// no expiration, and RevenueCat's NON_RENEWING_PURCHASE event for it never
// carries an expiration_at_ms at all (unlike a subscription in its grace
// period, which does). Treating that "no expiration" case as short-lived
// would incorrectly cut off access a year after purchase — access is
// meant to never end, so it gets an explicit far-future date instead of
// reusing the (unset) event field.
const LIFETIME_PERIOD_END = new Date("2099-12-31T00:00:00.000Z");

function periodEndOf(event: RevenueCatEvent, plan: RevenueCatPlanId | "unknown"): Date {
  if (plan === "lifetime") return LIFETIME_PERIOD_END;
  if (event.expiration_at_ms) return new Date(event.expiration_at_ms);
  // A subscription event without an expiration and without a recognized
  // product mapping — shouldn't happen for a real subscription, but
  // falls back to a short window rather than granting indefinite access
  // for an unmapped product.
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

async function upsertFromEvent(event: RevenueCatEvent, status: string) {
  const transactionId = event.original_transaction_id;
  if (!transactionId) return; // nothing stable to key this event on

  const existing = await db.subscription.findUnique({
    where: { rcOriginalTransactionId: transactionId },
  });

  // Once a Subscription row exists, its plan is trusted as-is (an
  // existing row's `plan` column already went through this same mapping
  // when the row was created) — only a brand-new row needs the product-id
  // lookup.
  const plan = (existing?.plan as RevenueCatPlanId | "unknown" | undefined) ?? planFromProductId(event.product_id);

  await db.subscription.upsert({
    where: { rcOriginalTransactionId: transactionId },
    update: {
      status,
      currentPeriodEnd: periodEndOf(event, plan),
    },
    create: {
      userId: event.app_user_id,
      plan,
      status,
      currentPeriodEnd: periodEndOf(event, plan),
      provider: "revenuecat",
      rcOriginalTransactionId: transactionId,
      rcAppUserId: event.app_user_id,
      rcStore: event.store ?? null,
    },
  });
  await invalidateSubscriptionCache(event.app_user_id);
}

export async function POST(request: NextRequest) {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "RevenueCat is not configured on this server" },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Invalid or missing Authorization header" }, { status: 401 });
  }

  let body: RevenueCatWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body.event;
  if (!event?.type || !event.app_user_id) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  switch (event.type) {
    // First purchase and a manual/store-driven renewal both mean the same
    // thing for us: the subscription is active through the new
    // expiration_at_ms. Handled identically, same as Stripe's
    // customer.subscription.created/updated pair above.
    // NON_RENEWING_PURCHASE is a one-time StoreKit "non-consumable" buy —
    // this is the event type a Lifetime purchase actually fires (it never
    // renews, so RENEWAL/CANCELLATION/EXPIRATION never apply to it).
    // periodEndOf() special-cases the "lifetime" plan to never expire.
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE": {
      await upsertFromEvent(event, "active");
      break;
    }

    // The user turned off auto-renew (or a refund/chargeback was issued).
    // This is NOT the same as access ending — Apple/Google keep the
    // subscription usable through the already-paid period, and RevenueCat
    // will send EXPIRATION separately when it actually lapses. So this
    // only refreshes the period-end bookkeeping, it does not revoke
    // access early (unlike Stripe's customer.subscription.deleted, which
    // fires exactly at the moment access should end).
    case "CANCELLATION": {
      await upsertFromEvent(event, "active");
      break;
    }

    // The grace period (if any) is over and the subscription has actually
    // lapsed — this is the real "close access now" signal.
    case "EXPIRATION": {
      const transactionId = event.original_transaction_id;
      if (transactionId) {
        const existing = await db.subscription.findUnique({
          where: { rcOriginalTransactionId: transactionId },
          select: { userId: true },
        });
        await db.subscription.updateMany({
          where: { rcOriginalTransactionId: transactionId },
          data: { status: "canceled" },
        });
        if (existing) await invalidateSubscriptionCache(existing.userId);
      }
      break;
    }

    // A renewal payment failed and the store is retrying — mirrors
    // Stripe's invoice.payment_failed handling.
    case "BILLING_ISSUE": {
      const transactionId = event.original_transaction_id;
      if (transactionId) {
        const existing = await db.subscription.findUnique({
          where: { rcOriginalTransactionId: transactionId },
          select: { userId: true },
        });
        await db.subscription.updateMany({
          where: { rcOriginalTransactionId: transactionId },
          data: { status: "past_due" },
        });
        if (existing) await invalidateSubscriptionCache(existing.userId);
      }
      break;
    }

    // TEST fires whenever the "Send test event" button in the RevenueCat
    // dashboard is used to verify the endpoint is reachable; TRANSFER and
    // SUBSCRIPTION_PAUSED aren't part of this app's plan model yet. Both
    // acknowledged explicitly rather than falling through silently.
    case "TEST":
    case "TRANSFER":
    case "SUBSCRIPTION_PAUSED":
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
