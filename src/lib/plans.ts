import { hasStripeShape } from "./stripe-env";

export type PlanId = "monthly" | "annual" | "lifetime";
export type CheckoutMethod = "card" | "oxxo";

interface Plan {
  id: PlanId;
  priceId: string | undefined;
  /**
   * The environment variable the Price id above is read from. Named here
   * rather than inline at the call site so a checker can walk the plan list
   * and report by variable name — see src/lib/stripe-price-health.ts, which
   * asks Stripe whether each of these actually points at a live Price.
   */
  priceEnvVar: string;
  /**
   * What that Price is supposed to cost, in US cents, for card checkout.
   *
   * This is the ONLY place the figure is written down as a number. The
   * pricing page prints it as text (`dict.pricing.<plan>.price`) and
   * src/lib/plans-price-parity.test.ts holds the two together, so the
   * amount a buyer is promised and the amount the health check demands of
   * Stripe cannot drift apart into two independent hardcodes.
   */
  expectedUsdCents: number;
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
// This is not belt-and-braces over the build-time check — it closes the case
// where a value reaches the runtime without passing a build of this repo.
//
// It is a SHAPE gate and nothing more, and the incident it was written for
// turned out not to be a shape problem at all: between 2026-08-24 and
// 2026-08-31 STRIPE_PRICE_LIFETIME held `price_1U86EtDP0jFvlr1mH1ANUlOE` —
// a correctly shaped Price id belonging to the ARCHIVED 169,99 price. Every
// rule here passed it, and Stripe answered every Premium checkout with
// "The price specified is inactive" (see PROGRESS.md 7.66). Authenticity —
// live, right amount, right currency — is checked against Stripe itself in
// src/lib/stripe-price-health.ts. This gate only keeps a categorically wrong
// kind of value from being handed to the Stripe API.
function priceIdFromEnv(name: string): string | undefined {
  const value = process.env[name];
  return hasStripeShape(name, value) ? value : undefined;
}

export const plans: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    priceId: priceIdFromEnv("STRIPE_PRICE_MONTHLY"),
    priceEnvVar: "STRIPE_PRICE_MONTHLY",
    expectedUsdCents: 799, // $7.99 USD
    mode: "subscription",
    durationDays: 30,
    oxxoAmountMxnCents: 15_000, // $150.00 MXN
  },
  annual: {
    id: "annual",
    priceId: priceIdFromEnv("STRIPE_PRICE_ANNUAL"),
    priceEnvVar: "STRIPE_PRICE_ANNUAL",
    expectedUsdCents: 4799, // $47.99 USD
    mode: "subscription",
    durationDays: 365,
    oxxoAmountMxnCents: 89_900, // $899.00 MXN
  },
  lifetime: {
    id: "lifetime",
    priceId: priceIdFromEnv("STRIPE_PRICE_LIFETIME"),
    priceEnvVar: "STRIPE_PRICE_LIFETIME",
    expectedUsdCents: 12_299, // $122.99 USD
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
