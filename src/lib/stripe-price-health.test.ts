import { describe, expect, it } from "vitest";
import {
  applyProductInvariant,
  checkStripePrices,
  expectedPrices,
  formatPriceHealth,
  verdictFor,
  type PriceHealthResult,
  type StripePriceFacts,
} from "./stripe-price-health";
import { plans } from "./plans";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";

/**
 * The guard merged as PR #114 checks the SHAPE of the Stripe variables and
 * would have passed the real 2026-08-24 defect without a murmur: the value
 * in STRIPE_PRICE_LIFETIME was a genuine Price id, correctly prefixed and
 * unique — it was simply the id of a price that had been archived. These
 * tests are about the property the shape guard cannot see.
 */

const LIVE_LIFETIME: StripePriceFacts = {
  active: true,
  unitAmount: 12_299,
  currency: "usd",
  recurringInterval: null,
  product: "prod_live",
};

const expectedLifetime = {
  plan: "lifetime" as const,
  envVar: "STRIPE_PRICE_LIFETIME",
  expectedUsdCents: 12_299,
};

describe("verdictFor — one variable at a time", () => {
  it("passes a live Price at the advertised amount", () => {
    const result = verdictFor(expectedLifetime, "price_live", LIVE_LIFETIME);
    expect(result.verdict).toBe("OK");
  });

  it("catches the real defect: a correctly shaped id pointing at an ARCHIVED price", () => {
    // price_1U86EtDP0jFvlr1mH1ANUlOE, the 169,99 price archived on 26.08.
    const archived: StripePriceFacts = {
      ...LIVE_LIFETIME,
      active: false,
      unitAmount: 16_999,
    };
    const result = verdictFor(expectedLifetime, "price_archived", archived);
    expect(result.verdict).toBe("INACTIVE");
    // Archived is reported ahead of the amount: "inactive" is what Stripe
    // says and what has to be fixed, and an archived price at the RIGHT
    // amount would otherwise read as OK.
    expect(result.detail).toContain("ARCHIVED");
  });

  it("catches an id Stripe does not recognise", () => {
    expect(verdictFor(expectedLifetime, "price_gone", "not-found").verdict).toBe("NOT_FOUND");
  });

  it("catches a live price at the wrong amount", () => {
    const result = verdictFor(expectedLifetime, "price_live", {
      ...LIVE_LIFETIME,
      unitAmount: 16_999,
    });
    expect(result.verdict).toBe("AMOUNT_MISMATCH");
    expect(result.detail).toContain("169.99");
    expect(result.detail).toContain("122.99");
  });

  it("catches a live price in the wrong currency before comparing amounts", () => {
    const result = verdictFor(expectedLifetime, "price_live", {
      ...LIVE_LIFETIME,
      currency: "mxn",
      unitAmount: 229_900,
    });
    expect(result.verdict).toBe("CURRENCY_MISMATCH");
  });

  it("reports an unset variable as MISSING_ENV, not as a Stripe problem", () => {
    expect(verdictFor(expectedLifetime, undefined, null).verdict).toBe("MISSING_ENV");
    expect(verdictFor(expectedLifetime, "   ", null).verdict).toBe("MISSING_ENV");
  });

  it("reports a misshapen value as MISSING_ENV rather than asking Stripe about it", () => {
    // A value of the wrong kind must never be sent to the Stripe API: Stripe
    // quotes the value back inside the error text it returns.
    const result = verdictFor(expectedLifetime, "sk_live_notarealkey", null);
    expect(result.verdict).toBe("MISSING_ENV");
    expect(result.detail).not.toContain("sk_live_notarealkey");
  });
});

describe("checkStripePrices — the whole table", () => {
  const clean = {
    STRIPE_PRICE_MONTHLY: "price_monthly",
    STRIPE_PRICE_ANNUAL: "price_annual",
    STRIPE_PRICE_LIFETIME: "price_lifetime",
  };

  const catalogue: Record<string, StripePriceFacts> = {
    price_monthly: {
      active: true,
      unitAmount: 799,
      currency: "usd",
      recurringInterval: "month",
      product: "prod_live",
    },
    price_annual: {
      active: true,
      unitAmount: 4_799,
      currency: "usd",
      recurringInterval: "year",
      product: "prod_live",
    },
    price_lifetime: LIVE_LIFETIME,
  };

  const lookup = async (id: string) => catalogue[id] ?? null;

  it("passes the clean set", async () => {
    const report = await checkStripePrices(clean, lookup);
    expect(report.ok).toBe(true);
    expect(report.failing).toEqual([]);
    expect(report.results).toHaveLength(3);
  });

  it("fails when one plan points at an archived price", async () => {
    const report = await checkStripePrices(
      { ...clean, STRIPE_PRICE_LIFETIME: "price_archived" },
      async (id) =>
        id === "price_archived" ? { ...LIVE_LIFETIME, active: false } : catalogue[id] ?? null
    );
    expect(report.ok).toBe(false);
    expect(report.failing).toEqual(["STRIPE_PRICE_LIFETIME"]);
  });

  it("treats a lookup that throws as NOT_FOUND rather than crashing the check", async () => {
    const report = await checkStripePrices(clean, async () => {
      throw new Error("No such price");
    });
    expect(report.ok).toBe(false);
    expect(report.results.map((r) => r.verdict)).toEqual(["NOT_FOUND", "NOT_FOUND", "NOT_FOUND"]);
  });

  it("fails when one plan sells a live, correctly priced price of another product", async () => {
    // Nothing wrong with this price except the thing it sells: active, USD,
    // 122,99 exactly as advertised. Every per-plan test passes it.
    const report = await checkStripePrices(clean, async (id) =>
      id === "price_lifetime"
        ? { ...LIVE_LIFETIME, product: "prod_somewhere_else" }
        : catalogue[id] ?? null
    );
    expect(report.ok).toBe(false);
    expect(report.failing).toEqual(["STRIPE_PRICE_LIFETIME"]);
    expect(report.results.find((r) => r.envVar === "STRIPE_PRICE_LIFETIME")?.verdict).toBe(
      "PRODUCT_MISMATCH"
    );
  });

  it("passes a set that is entirely from a foreign product — the documented blind spot", async () => {
    // Asserted, not assumed: the invariant asks whether the plans agree with
    // EACH OTHER, so a uniformly wrong set is self-consistent and passes.
    // Catching this needs a hardcoded product id, which is the thing this
    // check was built to avoid.
    const report = await checkStripePrices(clean, async (id) => {
      const facts = catalogue[id];
      return facts ? { ...facts, product: "prod_someone_elses" } : null;
    });
    expect(report.ok).toBe(true);
  });

  it("never prints the value of a variable, in any verdict", async () => {
    const secretish = "price_THIS_VALUE_MUST_NOT_APPEAR";
    const report = await checkStripePrices(
      { ...clean, STRIPE_PRICE_LIFETIME: secretish },
      async (id) => (id === secretish ? { ...LIVE_LIFETIME, active: false } : catalogue[id] ?? null)
    );
    const text = JSON.stringify(report) + formatPriceHealth(report);
    expect(text).not.toContain(secretish);
    // Positive control on the assertion itself: the report does name the
    // variable, so a search that finds nothing at all would be broken.
    expect(text).toContain("STRIPE_PRICE_LIFETIME");
  });
});


/**
 * The cross-plan invariant: all plans must sell the same Stripe Product.
 * It is derived from the answers, not from a table of product ids — see the
 * comment on applyProductInvariant for why a table was rejected.
 */
describe("applyProductInvariant — the plans must agree on one product", () => {
  function ok(envVar: string, product: string | null): PriceHealthResult {
    return {
      plan: "monthly",
      envVar,
      verdict: "OK",
      expectedUsdCents: 799,
      expectedCurrency: "usd",
      actual: { active: true, unitAmount: 799, currency: "usd", recurringInterval: "month", product },
      detail: `${envVar}: live Price, 7.99 USD, as advertised.`,
    };
  }

  const verdicts = (rs: PriceHealthResult[]) =>
    Object.fromEntries(applyProductInvariant(rs).map((r) => [r.envVar, r.verdict]));

  it("leaves a set that agrees on one product untouched", () => {
    // Production, as the owner measured it on 2026-08-31: all three plans
    // answered prod_V686OIEKpWeTGX.
    expect(verdicts([ok("A", "prod_one"), ok("B", "prod_one"), ok("C", "prod_one")])).toEqual({
      A: "OK",
      B: "OK",
      C: "OK",
    });
  });

  it("flags the plan whose price was taken from a different product", () => {
    expect(verdicts([ok("A", "prod_one"), ok("B", "prod_one"), ok("C", "prod_other")])).toEqual({
      A: "OK",
      B: "OK",
      C: "PRODUCT_MISMATCH",
    });
  });

  it("names the two products in the detail, so the reader can go and look", () => {
    const flagged = applyProductInvariant([
      ok("A", "prod_one"),
      ok("B", "prod_one"),
      ok("C", "prod_other"),
    ]).find((r) => r.verdict === "PRODUCT_MISMATCH")!;
    expect(flagged.detail).toContain("prod_other");
    expect(flagged.detail).toContain("prod_one");
  });

  it("flags every plan when no product holds a strict majority", () => {
    // One against one names no odd one out. Picking a side here would be the
    // check inventing an expectation it does not have.
    expect(verdicts([ok("A", "prod_one"), ok("B", "prod_other")])).toEqual({
      A: "PRODUCT_MISMATCH",
      B: "PRODUCT_MISMATCH",
    });
    const tied = applyProductInvariant([ok("A", "prod_one"), ok("B", "prod_other")])[0];
    expect(tied.detail).toContain("no majority");
  });

  it("does not let a broken plan vote on what the majority product is", () => {
    // Two healthy plans of prod_one, plus an ARCHIVED price of prod_other.
    // If the archived one counted, the vote would be 2:1 and unchanged here
    // — but with a second archived one it would tie and redden the healthy
    // plans. Broken plans keep their own, more specific verdict and stay out
    // of the count entirely.
    const archived: PriceHealthResult = {
      ...ok("C", "prod_other"),
      verdict: "INACTIVE",
      detail: "The Price in C exists but is ARCHIVED.",
    };
    const archived2: PriceHealthResult = { ...archived, envVar: "D" };
    expect(verdicts([ok("A", "prod_one"), ok("B", "prod_one"), archived, archived2])).toEqual({
      A: "OK",
      B: "OK",
      C: "INACTIVE",
      D: "INACTIVE",
    });
  });

  it("says nothing when there is nothing to compare", () => {
    // One plan cannot disagree with itself, and a plan whose product Stripe
    // did not report cannot be judged: silence, not a red verdict invented
    // out of a missing field.
    expect(verdicts([ok("A", "prod_one")])).toEqual({ A: "OK" });
    expect(verdicts([ok("A", "prod_one"), ok("B", null)])).toEqual({ A: "OK", B: "OK" });
  });
});

describe("the expected table has exactly one source", () => {
  it("covers every plan in plans.ts, by construction", () => {
    expect(expectedPrices().map((e) => e.plan).sort()).toEqual(Object.keys(plans).sort());
  });

  /**
   * The amount lives in plans.ts as a number and on the pricing page as
   * text. Two hardcodes of the same fact drift; this holds them together,
   * so `expectedUsdCents` cannot be corrected without the page a buyer
   * reads being corrected in the same commit, and vice versa.
   */
  it.each(["monthly", "annual", "lifetime"] as const)(
    "the %s amount matches what both pricing pages promise",
    (plan) => {
      const asText = `$${(plans[plan].expectedUsdCents / 100).toFixed(2)} USD`;
      expect(es.pricing[plan].price).toBe(asText);
      expect(ru.pricing[plan].price).toBe(asText);
    }
  );
});
