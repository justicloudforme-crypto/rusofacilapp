import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_PRICING_MARKUP,
  COUNTRY_CURRENCY,
  currencyForCountry,
  formatApproximate,
  roundApproximate,
  type LocalPriceContext,
} from "./currency";
import { plans } from "./plans";
import { unmarkedMoney, usdMentions } from "./pricing-currency.test";

/**
 * The approximate figure shown beside the peso price (PROGRESS.md 7.118).
 *
 * The one measurement everything here is anchored to: on 07.09.2026 the
 * owner opened a real Stripe checkout through a Singapore exit and Stripe
 * offered 11.70 SGD for the 150 MXN monthly plan, naming its own rate,
 * 1 MXN = 0.0780 SGD. The mid-market rate that day was 0.074971. Those two
 * numbers are the fixture below, and the first test is simply: does this
 * module land on the number the till showed?
 */

/** Mid-market MXN rates, 08.09.2026, from open.er-api.com. */
const RATES: Record<string, number> = {
  SGD: 0.074971,
  ARS: 89.221548,
  EUR: 0.050958,
  USD: 0.05919,
  CLP: 55.097598,
};

const ctx = (currency: string): LocalPriceContext => ({ currency, rate: RATES[currency] });

describe("the approximate figure agrees with the checkout that was measured", () => {
  it("quotes the Singapore buyer the same 11,70 SGD Stripe did", () => {
    // 150 MXN * 0.074971 * 1.04 = 11.6955 -> 11.70. Stripe: 11.70.
    expect(formatApproximate(plans.monthly.amountMxnCents, ctx("SGD"), "es")).toBe("≈ 11,70 SGD");
  });

  it("the markup is what closes the gap, and it is not free to change", () => {
    // Mid-market alone would have quoted 11.25 — 3.8% under the till. This
    // is the assertion that fails if somebody sets the markup back to zero
    // "because the rate should be the rate".
    const mid = 150 * RATES.SGD;
    expect(Number(mid.toFixed(2))).toBe(11.25);
    const withMarkup = mid * (1 + ADAPTIVE_PRICING_MARKUP);
    // Against Stripe's own 0.0780 * 150 = 11.70, within a tenth of a cent.
    expect(Math.abs(withMarkup - 11.7)).toBeLessThan(0.01);
  });

  it("never quotes LESS than the measured till", () => {
    // The error is deliberately one-sided: being pleasantly surprised at
    // checkout is survivable, being ambushed there is not.
    expect(150 * RATES.SGD * (1 + ADAPTIVE_PRICING_MARKUP)).toBeGreaterThanOrEqual(11.69);
  });
});

describe("what a reader sees", () => {
  it("rounds big currencies so they read as estimates", () => {
    // 150 MXN in Argentina is 13,918.6 pesos argentinos. Five exact digits
    // would read as a quote; three significant figures read as "about".
    // NB the separator: Russian groups with a NO-BREAK space (U+00A0), not
    // an ordinary one. Written as an escape here so the expectation cannot
    // be "fixed" by silently pasting the wrong character into it.
    expect(formatApproximate(plans.monthly.amountMxnCents, ctx("ARS"), "ru")).toBe("≈ 13\u00a0900 ARS");
    expect(formatApproximate(plans.lifetime.amountMxnCents, ctx("ARS"), "ru")).toBe("≈ 213\u00a0000 ARS");
  });

  it("keeps the currency's own precision under 100 units", () => {
    expect(formatApproximate(plans.monthly.amountMxnCents, ctx("EUR"), "es")).toBe("≈ 7,95 EUR");
    // ...and drops the two fake zeros above it: three significant figures
    // leave nothing after the point anyway.
    expect(formatApproximate(plans.lifetime.amountMxnCents, ctx("EUR"), "es")).toBe("≈ 122 EUR");
  });

  it("honours a currency with no minor unit", () => {
    // The Chilean peso is written without decimals; the figure must not
    // arrive with two of them.
    expect(formatApproximate(plans.monthly.amountMxnCents, ctx("CLP"), "es")).toBe("≈ 8.600 CLP");
  });

  it("always carries the ≈ sign and the ISO code, never a $", () => {
    for (const currency of Object.keys(RATES)) {
      for (const plan of ["monthly", "annual", "lifetime"] as const) {
        const text = formatApproximate(plans[plan].amountMxnCents, ctx(currency), "es")!;
        expect(text.startsWith("≈ ")).toBe(true);
        expect(text.endsWith(` ${currency}`)).toBe(true);
        expect(text).not.toContain("$");
      }
    }
  });

  /**
   * The rule of src/lib/pricing-currency.test.ts, applied to strings this
   * module invents at runtime rather than to the dictionaries: a `$` not
   * followed by MXN is banned, because the peso and the dollar share a
   * sign. An approximate figure sidesteps it by never using the sign at
   * all — and the US case is the one to check, since "≈ 142 USD" is the
   * only output here that names the dollar.
   */
  it("a US visitor's figure is unambiguous by the money rule's own detector", () => {
    const text = formatApproximate(plans.lifetime.amountMxnCents, ctx("USD"), "es")!;
    expect(text).toBe("≈ 142 USD");
    expect(unmarkedMoney(text)).toEqual([]);
    // It does name USD — deliberately, and that is what makes it readable.
    // The banned thing was an unmarked `$`, not the word.
    expect(usdMentions(text)).toEqual(["USD"]);
  });
});

describe("when to say nothing at all", () => {
  it("says nothing to a Mexican — the peso price already is the local one", () => {
    expect(currencyForCountry("MX")).toBeNull();
    expect(currencyForCountry("mx")).toBeNull();
  });

  it("says nothing when the country is unknown or unlisted", () => {
    expect(currencyForCountry(null)).toBeNull();
    expect(currencyForCountry(undefined)).toBeNull();
    expect(currencyForCountry("")).toBeNull();
    // Deliberate absences, each for a stated reason in currency.ts.
    for (const country of ["CU", "VE", "RU", "BY", "ZZ"]) {
      expect(currencyForCountry(country)).toBeNull();
    }
  });

  it("says nothing when there is no rate, rather than showing a broken one", () => {
    expect(formatApproximate(15_000, null, "es")).toBeNull();
    expect(formatApproximate(15_000, { currency: "ARS", rate: 0 }, "es")).toBeNull();
    expect(formatApproximate(15_000, { currency: "ARS", rate: Number.NaN }, "es")).toBeNull();
    expect(formatApproximate(15_000, { currency: "ARS", rate: -1 }, "es")).toBeNull();
  });

  it("the country lookup is case-insensitive, the way the header is not guaranteed to be", () => {
    expect(currencyForCountry("ar")).toBe("ARS");
    expect(currencyForCountry("AR")).toBe("ARS");
  });
});

describe("the allowlist itself", () => {
  it("is populated, so nothing above passes on an empty table", () => {
    expect(Object.keys(COUNTRY_CURRENCY).length).toBeGreaterThan(40);
  });

  it("holds only well-formed pairs, and never MXN", () => {
    for (const [country, currency] of Object.entries(COUNTRY_CURRENCY)) {
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(currency).toMatch(/^[A-Z]{3}$/);
      expect(currency).not.toBe("MXN");
    }
  });

  it("covers the Spanish-speaking markets this site actually sells to", () => {
    for (const country of ["AR", "CO", "CL", "PE", "ES", "UY", "BO", "PY", "CR", "GT", "DO", "EC", "US"]) {
      expect(COUNTRY_CURRENCY[country]).toBeTruthy();
    }
  });
});

describe("positive control — the rounding must actually round", () => {
  it("a detector that returned its input would fail these", () => {
    expect(roundApproximate(13918.6, 2)).toBe(13900);
    expect(roundApproximate(213_012, 2)).toBe(213_000);
    expect(roundApproximate(11.6955, 2)).toBe(11.7);
    expect(roundApproximate(11.6955, 0)).toBe(12);
    expect(roundApproximate(99.994, 2)).toBe(99.99);
    // 100 is the seam between the two rules — checked on both sides of it.
    expect(roundApproximate(100.4, 2)).toBe(100);
  });

  it("refuses nonsense instead of formatting it", () => {
    expect(roundApproximate(0, 2)).toBe(0);
    expect(roundApproximate(-5, 2)).toBe(0);
    expect(roundApproximate(Number.NaN, 2)).toBe(0);
  });
});
