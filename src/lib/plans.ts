export type PlanId = "monthly" | "annual";
export type CheckoutMethod = "card" | "oxxo";

interface Plan {
  id: PlanId;
  priceId: string | undefined;
  durationDays: number;
  // OXXO is a cash-voucher payment method with no reusable off-session
  // payment instrument — it cannot be attached to a recurring Stripe
  // Subscription, only to a one-time Checkout Session (see
  // /api/checkout's oxxo branch). So instead of a recurring Stripe Price,
  // OXXO checkout uses a fixed MXN amount defined here directly. This is a
  // static peso figure (~current USD price at ~18.7 MXN/USD), not a live
  // FX conversion like card checkout gets via Stripe Adaptive Pricing —
  // revisit it if the peso moves significantly against the dollar.
  oxxoAmountMxnCents: number;
}

export const plans: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    priceId: process.env.STRIPE_PRICE_MONTHLY,
    durationDays: 30,
    oxxoAmountMxnCents: 15_000, // $150.00 MXN
  },
  annual: {
    id: "annual",
    priceId: process.env.STRIPE_PRICE_ANNUAL,
    durationDays: 365,
    oxxoAmountMxnCents: 89_900, // $899.00 MXN
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "monthly" || value === "annual";
}

export function isCheckoutMethod(value: string): value is CheckoutMethod {
  return value === "card" || value === "oxxo";
}
