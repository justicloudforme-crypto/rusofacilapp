/**
 * Asks Stripe whether the Price ids in the environment are the prices this
 * product actually sells: live, right amount, right currency.
 *
 * Why this exists, precisely. On 2026-08-24 `STRIPE_PRICE_LIFETIME`
 * (Production) was set to `price_1U86EtDP0jFvlr1mH1ANUlOE` — the id of the
 * 169,99 Price that was archived two days later. The value was a Price id in
 * every formal sense: right prefix, right issuer, unique among the Stripe
 * variables. src/lib/stripe-env.ts, the shape guard written after the
 * incident, would have waved it through, and did: the defect it was built
 * from was misdiagnosed (PROGRESS.md 7.66). What Stripe said, every single
 * time somebody pressed "buy Premium", was:
 *
 *     400 — The price specified is inactive.  param: line_items[0][price]
 *
 * A dead id and a live id are the same shape. The only thing that can tell
 * them apart is Stripe, so this check asks Stripe.
 *
 * WHAT IT CANNOT DO — read this before trusting a green run:
 *   - It cannot tell that the RIGHT price is on the RIGHT plan when the
 *     amounts happen to agree. Two live 47,99 prices of the same Product are
 *     interchangeable here and are not interchangeable to a buyer. The
 *     product invariant below narrows this but does not close it.
 *   - It cannot tell that the whole set was taken from the wrong account or
 *     the wrong product, as long as it was taken from ONE of them. The
 *     invariant compares the plans with each other, and a uniformly wrong
 *     set is self-consistent. See applyProductInvariant.
 *   - It does not replace the owner reading the amounts on Stripe's own
 *     dashboard. `expectedUsdCents` in src/lib/plans.ts is a number a human
 *     typed; if that number is wrong, this check enforces the wrong number
 *     with great confidence.
 *
 * NO SECRETS LEAVE THIS MODULE. Reports carry the variable NAME, the verdict,
 * the expected amount and what Stripe answered — never the value of an
 * environment variable, and never the Price id itself. Those variables are
 * Sensitive on Vercel, and this report goes to an HTTP response, a server log
 * and a Sentry event.
 */
import { plans, type PlanId } from "./plans";
import { hasStripeShape } from "./stripe-env";

export type PriceVerdict =
  | "OK"
  | "INACTIVE"
  | "NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PRODUCT_MISMATCH"
  | "MISSING_ENV";

/** The currency every card plan is billed in. OXXO is MXN and is priced
 * inline in plans.ts (`oxxoAmountMxnCents`), not through a Stripe Price, so
 * it has no Price id to check and is out of scope here. */
export const EXPECTED_CURRENCY = "usd";

/** What Stripe answered about one Price. Only the fields that decide a
 * verdict, plus the two that make a wrong verdict diagnosable. */
export interface StripePriceFacts {
  active: boolean;
  unitAmount: number | null;
  currency: string;
  /** Billing interval for a recurring Price, `null` for a one-time one. */
  recurringInterval: string | null;
  /** The Product the Price belongs to. Not a credential; it is what tells a
   * reader whether a live, correctly priced Price is attached to the right
   * thing. */
  product: string | null;
}

export interface PriceHealthResult {
  plan: PlanId;
  /** The environment variable, by name. Never its value. */
  envVar: string;
  verdict: PriceVerdict;
  expectedUsdCents: number;
  expectedCurrency: string;
  /** What Stripe said, when it was asked and answered. */
  actual: StripePriceFacts | null;
  /** One sentence, safe for a log. Contains no value of any variable. */
  detail: string;
}

export interface PriceHealthReport {
  ok: boolean;
  results: PriceHealthResult[];
  /** Names of the variables whose verdict is not OK, for the alert subject. */
  failing: string[];
}

/** Everything this check needs from Stripe, narrowed to one call so the
 * positive control can supply a stand-in without a network or a key. */
export interface PriceLookup {
  (priceId: string): Promise<StripePriceFacts | null>;
}

/** The one table of expectations, derived from the plan list rather than
 * written out a second time. A plan added to plans.ts is checked from the
 * day it is added, not from the day somebody remembers this file. */
export function expectedPrices(): Array<{
  plan: PlanId;
  envVar: string;
  expectedUsdCents: number;
}> {
  return (Object.keys(plans) as PlanId[]).map((plan) => ({
    plan,
    envVar: plans[plan].priceEnvVar,
    expectedUsdCents: plans[plan].expectedUsdCents,
  }));
}

function money(cents: number | null): string {
  return cents === null ? "no amount" : `${(cents / 100).toFixed(2)}`;
}

/**
 * The verdict for one variable, given what the environment holds and what
 * Stripe answered. Pure — the order of the tests is the whole content of it:
 *
 *   MISSING_ENV       nothing to ask about
 *   NOT_FOUND         asked, Stripe has no such Price
 *   INACTIVE          exists but is archived — the 24.08 defect
 *   CURRENCY_MISMATCH wrong currency makes the amount incomparable, so it
 *                     is decided before the amount
 *   AMOUNT_MISMATCH   live, right currency, wrong money
 */
export function verdictFor(
  expected: { plan: PlanId; envVar: string; expectedUsdCents: number },
  rawEnvValue: string | undefined,
  facts: StripePriceFacts | null | "not-found"
): PriceHealthResult {
  const base = {
    plan: expected.plan,
    envVar: expected.envVar,
    expectedUsdCents: expected.expectedUsdCents,
    expectedCurrency: EXPECTED_CURRENCY,
  };

  if (!hasStripeShape(expected.envVar, rawEnvValue)) {
    return {
      ...base,
      verdict: "MISSING_ENV",
      actual: null,
      detail:
        rawEnvValue === undefined || rawEnvValue.trim() === ""
          ? `${expected.envVar} is not set, so this plan cannot be sold at all.`
          : `${expected.envVar} is set to something that is not a Price id (see check:stripe-env).`,
    };
  }

  if (facts === "not-found" || facts === null) {
    return {
      ...base,
      verdict: "NOT_FOUND",
      actual: null,
      detail: `Stripe has no Price with the id in ${expected.envVar}. Checkout for this plan fails on every attempt.`,
    };
  }

  if (!facts.active) {
    return {
      ...base,
      verdict: "INACTIVE",
      actual: facts,
      detail:
        `The Price in ${expected.envVar} exists but is ARCHIVED. Stripe answers ` +
        `"The price specified is inactive" and no checkout session is created — ` +
        `this is exactly the 2026-08-24 defect.`,
    };
  }

  if (facts.currency !== EXPECTED_CURRENCY) {
    return {
      ...base,
      verdict: "CURRENCY_MISMATCH",
      actual: facts,
      detail: `${expected.envVar} points at a Price billed in ${facts.currency.toUpperCase()}, expected ${EXPECTED_CURRENCY.toUpperCase()}.`,
    };
  }

  if (facts.unitAmount !== expected.expectedUsdCents) {
    return {
      ...base,
      verdict: "AMOUNT_MISMATCH",
      actual: facts,
      detail:
        `${expected.envVar} points at a live Price of ${money(facts.unitAmount)} USD, ` +
        `but this plan is advertised at ${money(expected.expectedUsdCents)} USD. ` +
        `Someone would be charged the wrong amount.`,
    };
  }

  return {
    ...base,
    verdict: "OK",
    actual: facts,
    detail: `${expected.envVar}: live Price, ${money(facts.unitAmount)} USD, as advertised.`,
  };
}

/**
 * The one property that no single plan can be judged on: every plan must
 * sell the SAME Stripe Product.
 *
 * Why derived and not written down. The obvious form of this check is a
 * table — "lifetime belongs to prod_…" — and that table is a hardcode typed
 * by a human, of exactly the class this whole file exists because of
 * (PROGRESS.md 7.66). It would also rot silently the day the Product is
 * recreated in Stripe. So nothing is hardcoded here: the expectation is read
 * off the answers Stripe just gave. Measured by the owner on production on
 * 2026-08-31, all three plans answered prod_V686OIEKpWeTGX — one product —
 * which is what makes the invariant true today and safe to switch on.
 *
 * What it catches: one price dragged in from a different Product — a test
 * product, an old product, a neighbouring project — while live, in USD and at
 * the advertised amount. That set is `OK` on every per-plan test and wrong.
 *
 * What it CANNOT catch, by construction: all plans pointing at prices of one
 * FOREIGN product. The invariant asks whether the plans agree, and a
 * uniformly wrong set agrees with itself. Only a hardcoded product id or a
 * human looking at the dashboard sees that, and neither is free. The
 * positive control asserts this blind spot out loud rather than leaving it
 * to be discovered.
 *
 * Applied only to plans that are otherwise OK, and only when at least two of
 * them answered with a product. A plan already reported INACTIVE or
 * AMOUNT_MISMATCH keeps that verdict: it is the more specific and more
 * actionable one, the report is already `ok: false`, and a broken plan's
 * product must not get a vote on what the majority product is.
 *
 * The majority is a STRICT plurality. Two plans against two — or one against
 * one — names no odd one out, so every disagreeing plan is flagged and the
 * detail says the check cannot tell which side is right. Silently picking a
 * winner there would be the check inventing an expectation it does not have.
 */
export function applyProductInvariant(results: PriceHealthResult[]): PriceHealthResult[] {
  const eligible = new Set(
    results.filter((r) => r.verdict === "OK" && r.actual?.product)
  );
  if (eligible.size < 2) return results;

  const counts = new Map<string, number>();
  for (const r of eligible) {
    const product = r.actual!.product as string;
    counts.set(product, (counts.get(product) ?? 0) + 1);
  }
  if (counts.size === 1) return results;

  const top = Math.max(...counts.values());
  const leaders = [...counts.entries()].filter(([, n]) => n === top).map(([product]) => product);
  const majority = leaders.length === 1 ? leaders[0] : null;
  const seen = [...counts.keys()].sort().join(", ");

  return results.map((result) => {
    if (!eligible.has(result)) return result;
    const product = result.actual!.product as string;
    if (majority !== null && product === majority) return result;

    return {
      ...result,
      verdict: "PRODUCT_MISMATCH" as const,
      detail:
        majority === null
          ? `${result.envVar} points at a live, correctly priced Price of product ${product}, ` +
            `but the plans do not agree on one product (${seen}) and no majority names the odd one out. ` +
            `All plans must sell the same product; which of these is the intended one has to be read off Stripe.`
          : `${result.envVar} points at a live, correctly priced Price of product ${product}, ` +
            `while the other plans sell ${majority}. All plans must sell the same product, so this Price ` +
            `was most likely taken from a different (or test) product — it passes every per-plan test and ` +
            `would still charge for the wrong thing.`,
    };
  });
}

/**
 * Runs the whole table. `env` and `lookup` are injected so the positive
 * control can plant an archived and a nonexistent price without touching
 * Stripe, and so the route can pass the real client.
 */
export async function checkStripePrices(
  env: Record<string, string | undefined>,
  lookup: PriceLookup
): Promise<PriceHealthReport> {
  const results: PriceHealthResult[] = [];

  for (const expected of expectedPrices()) {
    const raw = env[expected.envVar];
    if (!hasStripeShape(expected.envVar, raw)) {
      results.push(verdictFor(expected, raw, null));
      continue;
    }
    let facts: StripePriceFacts | null = null;
    try {
      facts = await lookup((raw as string).trim());
    } catch {
      // A Price id Stripe does not recognise raises rather than returning
      // null. Any other transport failure lands here too and is reported the
      // same way: from this side they are indistinguishable, and both mean
      // "we could not confirm this plan can be sold".
      facts = null;
    }
    results.push(verdictFor(expected, raw, facts ?? "not-found"));
  }

  // Cross-plan last: it needs every answer before it can say anything, and
  // it may only downgrade a verdict that is otherwise OK.
  const judged = applyProductInvariant(results);

  const failing = judged.filter((r) => r.verdict !== "OK").map((r) => r.envVar);
  return { ok: failing.length === 0, results: judged, failing };
}

/** One-line-per-plan summary for a log or a Sentry message. Values never
 * appear; this is asserted by the tests and by the self-test. */
export function formatPriceHealth(report: PriceHealthReport): string {
  const lines = report.results.map((r) => `  ${r.envVar}: ${r.verdict} — ${r.detail}`);
  return [
    report.ok
      ? "Stripe price health: all plans point at live, correctly priced Prices."
      : `Stripe price health: ${report.failing.length} plan(s) cannot be sold as advertised.`,
    ...lines,
  ].join("\n");
}
