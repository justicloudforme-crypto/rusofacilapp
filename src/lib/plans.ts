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
   * What this plan costs, in Mexican peso centavos. ONE amount per plan,
   * for every payment method — the card Price in Stripe, the OXXO voucher,
   * and the text a buyer reads all come from this number.
   *
   * Why pesos are the base and not dollars (changed 2026-09-06, PROGRESS.md
   * 7.116). The Stripe account settles in MXN and MXN only — "all available
   * settlement currencies have been enabled" and USD is not among them.
   * Adaptive Pricing, which is what showed a Mexican buyer a peso figure at
   * the card form, requires the Price's own currency to be a settlement
   * currency; with a USD Price it was not, so every peso charge went through
   * a conversion we paid for. Pricing in the currency we are paid in removes
   * that conversion instead of hiding it.
   *
   * This is the ONLY place the figure is written down as a number. The
   * pricing page prints it as text (`dict.pricing.<plan>.price`) and
   * src/lib/stripe-price-health.test.ts holds the two together via
   * formatMoney below, so the amount a buyer is promised and the amount the
   * health check demands of Stripe cannot drift apart into two independent
   * hardcodes.
   */
  amountMxnCents: number;
  // "subscription" creates a recurring Stripe Subscription (monthly/annual);
  // "lifetime" is a single one-time Checkout Session (see /api/checkout) —
  // there's no Stripe Subscription object behind it at all.
  mode: "subscription" | "payment";
  durationDays: number;
}

/** The currency every plan is priced and billed in, everywhere: the Stripe
 * Prices behind card checkout, the inline `price_data` behind an OXXO
 * voucher, and the health check that asks Stripe whether those Prices are
 * the ones we advertise. Written once so those three cannot disagree. */
export const BASE_CURRENCY = "mxn";

/**
 * How an amount from `amountMxnCents` is written for a person to read.
 *
 * Mexican convention: the peso sign is the same `$` as the dollar's, so the
 * MXN suffix is not decoration — it is the only thing that says which
 * currency this is, and it is what the "no dollar figures left on the public
 * pages" check keys off (src/lib/pricing-currency.test.ts).
 *
 * Centavos are printed only when there are any. All three plans today are
 * whole pesos, and "$150.00 MXN" reads as a converted figure rather than a
 * price.
 */
export function formatMoney(cents: number): string {
  const pesos = Math.trunc(cents / 100);
  const centavos = cents % 100;
  const whole = pesos.toLocaleString("en-US");
  return centavos === 0
    ? `$${whole} MXN`
    : `$${whole}.${String(centavos).padStart(2, "0")} MXN`;
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
    amountMxnCents: 15_000, // $150 MXN
    mode: "subscription",
    durationDays: 30,
  },
  annual: {
    id: "annual",
    priceId: priceIdFromEnv("STRIPE_PRICE_ANNUAL"),
    priceEnvVar: "STRIPE_PRICE_ANNUAL",
    amountMxnCents: 89_900, // $899 MXN
    mode: "subscription",
    durationDays: 365,
  },
  lifetime: {
    id: "lifetime",
    priceId: priceIdFromEnv("STRIPE_PRICE_LIFETIME"),
    priceEnvVar: "STRIPE_PRICE_LIFETIME",
    amountMxnCents: 229_900, // $2,299 MXN
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
