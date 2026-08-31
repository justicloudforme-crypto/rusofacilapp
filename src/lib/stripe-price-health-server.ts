import "server-only";
import { getStripe } from "./stripe";
import {
  checkStripePrices,
  type PriceHealthReport,
  type StripePriceFacts,
} from "./stripe-price-health";

/**
 * The server half of the price-authenticity check: turns a real Stripe
 * client into the single `PriceLookup` the pure module needs.
 *
 * Kept separate from src/lib/stripe-price-health.ts on purpose — that file
 * has to stay importable by `npm run test` and by the positive control
 * script, neither of which may pull in `server-only` or a Stripe key.
 */
export async function runStripePriceHealth(): Promise<PriceHealthReport> {
  const stripe = getStripe();

  if (!stripe) {
    // No key, no answer. Reporting every plan as broken here would cry wolf
    // on any environment without Stripe credentials; instead the caller is
    // told plainly that nothing was checked.
    return {
      ok: false,
      results: [],
      failing: ["STRIPE_SECRET_KEY"],
    };
  }

  return checkStripePrices(process.env as Record<string, string | undefined>, async (priceId) => {
    const price = await stripe.prices.retrieve(priceId);
    const facts: StripePriceFacts = {
      active: price.active,
      unitAmount: price.unit_amount ?? null,
      currency: price.currency,
      recurringInterval: price.recurring?.interval ?? null,
      product: typeof price.product === "string" ? price.product : (price.product?.id ?? null),
    };
    return facts;
  });
}
