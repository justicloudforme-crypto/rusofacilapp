import { hasStripeShape } from "./stripe-env";

export type PlanId = "monthly" | "annual" | "lifetime";
export type CheckoutMethod = "card" | "oxxo";

interface Plan {
  id: PlanId;
  priceId: string | undefined;
  // "subscription" creates a recurring Stripe Subscription (monthly/annual);
  // "lifetime" is a single one-time Checkout Session (see /api/checkout) —
  // there's no Stripe Subscription object behind it at all.
  mode: "subscription" | "payment";
  durationDays: number;
  // OXXO is a cash-voucher payment method with no reusable off-session
  // payment instrument — it cannot be attached to a recurring Stripe
  // Subscription, only to a one-time Checkout Session (see
  // /api/checkout's oxxo branch). So instead of a recurring Stripe Price,
  // OXXO checkout uses a fixed MXN amount defined here directly. This is a
  // static peso figure (~current USD price at ~18.7 MXN/USD), not a live
  // FX conversion like card checkout gets via Stripe Adaptive Pricing —
  // revisit it if the peso moves significantly against the dollar.
  oxxoAmountMxnCents?: number;
}

// Lifetime access is modeled as a Subscription row with a currentPeriodEnd
// far in the future rather than a new "no expiry" concept — every access
// check (isSubscriptionActive, the lesson-page gate, the proxy) already
// keys off currentPeriodEnd, so this reuses that machinery instead of
// teaching it a second access model.
export const LIFETIME_DURATION_DAYS = 100 * 365;

// Last gate before a Price id is handed to Stripe. A price id that is not a
// price id is treated as ABSENT rather than passed through, which routes it
// into the refusal /api/checkout already has (pricing page + a Sentry event)
// instead of into a Stripe API call that throws.
//
// This is not belt-and-braces over the build-time check — it closes something
// the build-time check cannot. Between 2026-08-24 and 2026-08-31
// STRIPE_PRICE_LIFETIME held a copy of the live secret key, so every Premium
// checkout sent `line_items: [{ price: "sk_live_…" }]` to Stripe, and Stripe
// answers that with `No such price: 'sk_live_…'` — the secret quoted back
// inside an exception message, which onRequestError then files into Sentry.
// A malformed price id is therefore not only a sale that cannot complete, it
// is a credential leaving the process. It stops here.
function priceIdFromEnv(name: string): string | undefined {
  const value = process.env[name];
  return hasStripeShape(name, value) ? value : undefined;
}

export const plans: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    priceId: priceIdFromEnv("STRIPE_PRICE_MONTHLY"),
    mode: "subscription",
    durationDays: 30,
    oxxoAmountMxnCents: 15_000, // $150.00 MXN
  },
  annual: {
    id: "annual",
    priceId: priceIdFromEnv("STRIPE_PRICE_ANNUAL"),
    mode: "subscription",
    durationDays: 365,
    oxxoAmountMxnCents: 89_900, // $899.00 MXN
  },
  lifetime: {
    id: "lifetime",
    priceId: priceIdFromEnv("STRIPE_PRICE_LIFETIME"),
    mode: "payment",
    durationDays: LIFETIME_DURATION_DAYS,
    // $2,299 MXN at ~18.7 MXN/USD matches the $122.99 USD card price
    // (dict.pricing.lifetime.price) — same rate the monthly/annual OXXO
    // amounts above already use.
    oxxoAmountMxnCents: 229_900, // $2,299.00 MXN
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "monthly" || value === "annual" || value === "lifetime";
}

export function isCheckoutMethod(value: string): value is CheckoutMethod {
  return value === "card" || value === "oxxo";
}
