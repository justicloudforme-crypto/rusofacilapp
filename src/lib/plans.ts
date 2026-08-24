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
  // Undefined for lifetime: that plan is card-only for now, no OXXO option.
  oxxoAmountMxnCents?: number;
}

// Lifetime access is modeled as a Subscription row with a currentPeriodEnd
// far in the future rather than a new "no expiry" concept — every access
// check (isSubscriptionActive, the lesson-page gate, the proxy) already
// keys off currentPeriodEnd, so this reuses that machinery instead of
// teaching it a second access model.
export const LIFETIME_DURATION_DAYS = 100 * 365;

export const plans: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    priceId: process.env.STRIPE_PRICE_MONTHLY,
    mode: "subscription",
    durationDays: 30,
    oxxoAmountMxnCents: 15_000, // $150.00 MXN
  },
  annual: {
    id: "annual",
    priceId: process.env.STRIPE_PRICE_ANNUAL,
    mode: "subscription",
    durationDays: 365,
    oxxoAmountMxnCents: 89_900, // $899.00 MXN
  },
  lifetime: {
    id: "lifetime",
    priceId: process.env.STRIPE_PRICE_LIFETIME,
    mode: "payment",
    durationDays: LIFETIME_DURATION_DAYS,
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "monthly" || value === "annual" || value === "lifetime";
}

export function isCheckoutMethod(value: string): value is CheckoutMethod {
  return value === "card" || value === "oxxo";
}
