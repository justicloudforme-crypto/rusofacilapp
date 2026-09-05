import { describe, expect, it } from "vitest";
import {
  FOOTNOTE_MARK,
  basePricesText,
  marked,
  perMonthCents,
  priceCopy,
  withBasePrices,
  withPrice,
} from "./pricing-display";
import { formatMoney, plans } from "./plans";
import type { LocalPriceContext } from "./currency";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";

/**
 * One figure per card, in the visitor's own money, and pesos in a single
 * footnote (PROGRESS.md 7.120).
 *
 * The rates are the owner's measured ones — 1 MXN = 0.074971 SGD and
 * 0.050958 EUR on 07-08.09.2026, the same table playwright.config.ts feeds
 * the e2e server — so the numbers asserted here are the numbers a browser
 * paints, not a second set invented for a unit test.
 */
const RATES: Record<string, number> = { SGD: 0.074971, EUR: 0.050958, ARS: 89.221548 };
const ctx = (currency: string): LocalPriceContext => ({ currency, rate: RATES[currency] });

/** The peso strings, exactly as /pricing hands them over. */
const PESO = {
  monthly: es.pricing.monthly.price,
  annual: es.pricing.annual.price,
  lifetime: es.pricing.lifetime.price,
  annualPerMonth: es.pricing.annual.perMonthPrice,
};

describe("what goes on the card", () => {
  it("reads the real dictionary — an empty fixture would pass everything below", () => {
    expect(PESO.monthly).toBe("$150 MXN");
    expect(PESO.annualPerMonth).toBe("≈$75 MXN");
  });

  it("quotes the visitor's currency, and the peso figure is nowhere in it", () => {
    const copy = priceCopy(ctx("SGD"), "es", PESO);
    expect(copy.converted).toBe(true);
    expect(copy.monthly).toBe("≈ 11,70 SGD");
    expect(copy.annual).toBe("≈ 70,09 SGD");
    expect(copy.lifetime).toBe("≈ 179 SGD");
    // The whole point of the change: no peso string survives into the copy
    // the card renders. Pesos appear once, in the footnote.
    for (const figure of [copy.monthly, copy.annual, copy.lifetime, copy.annualPerMonth]) {
      expect(figure).not.toContain("MXN");
      expect(figure).not.toContain("$");
      expect(figure.startsWith("≈")).toBe(true);
    }
  });

  it("converts the annual plan's per-month line too, from the annual amount", () => {
    // 89 900 / 12 = 7 492 centavos; 74.92 * 0.050958 * 1.04 = 3.97 EUR.
    expect(perMonthCents(plans.annual.amountMxnCents)).toBe(7_492);
    expect(priceCopy(ctx("EUR"), "es", PESO).annualPerMonth).toBe("≈ 3,97 EUR");
  });

  describe("who is shown pesos, and it is not an error", () => {
    it("Mexico, an unlisted country and an unknown one all get the dictionary's pesos", () => {
      // All three arrive here as a null context — the distinction is made
      // upstream in src/lib/currency.ts and src/lib/country-server.ts.
      const copy = priceCopy(null, "es", PESO);
      expect(copy).toEqual({ ...PESO, converted: false });
    });

    /**
     * THE DEAD-FEED CASE, which is the one this module is built around.
     * open.er-api.com refusing, timing out or answering without our
     * currency all come back as the same thing: no rate. The page must fall
     * back to the peso prices whole — not to a blank figure, not to a
     * half-converted set.
     */
    it("a rate that never arrived leaves every figure in pesos", () => {
      for (const dead of [null, { currency: "EUR", rate: 0 }, { currency: "EUR", rate: Number.NaN }]) {
        const copy = priceCopy(dead as LocalPriceContext | null, "es", PESO);
        expect(copy.converted).toBe(false);
        expect(copy.monthly).toBe("$150 MXN");
        expect(copy.annualPerMonth).toBe("≈$75 MXN");
      }
    });

    it("ALL FOUR figures or none — a page never mixes two currencies", () => {
      // The failure this rejects is subtle and would look fine in review: a
      // per-figure fallback would put "≈ 7,95 EUR" beside "$899 MXN" and
      // invite a reader to compare them, making the annual plan look like
      // the expensive one. Simulated by a currency Intl can format but the
      // feed answered zero for.
      const copy = priceCopy({ currency: "EUR", rate: 0 }, "es", PESO);
      const figures = [copy.monthly, copy.annual, copy.lifetime, copy.annualPerMonth];
      expect(figures.every((f) => f.includes("MXN"))).toBe(true);
    });
  });
});

describe("the footnote marker", () => {
  it("is attached only when there is a footnote to point at", () => {
    const converted = priceCopy(ctx("SGD"), "es", PESO);
    const pesos = priceCopy(null, "es", PESO);
    expect(marked(converted.monthly, converted)).toBe(`≈ 11,70 SGD${FOOTNOTE_MARK}`);
    // A Mexican reader gets no asterisk, because there is no sentence at
    // the bottom of their page for it to lead to.
    expect(marked(pesos.monthly, pesos)).toBe("$150 MXN");
  });
});

describe("the footnote's own peso figures", () => {
  it("names all three base prices, each marked MXN", () => {
    const text = basePricesText("es");
    for (const plan of ["monthly", "annual", "lifetime"] as const) {
      expect(text).toContain(formatMoney(plans[plan].amountMxnCents));
    }
    expect(text).toBe("$150 MXN, $899 MXN y $2,299 MXN");
    expect(basePricesText("ru")).toBe("$150 MXN, $899 MXN и $2,299 MXN");
  });

  it("every `$` in the rendered footnote is followed by MXN", () => {
    // The rule of src/lib/pricing-currency.test.ts, applied to the string
    // that only exists after interpolation — the dictionary value itself
    // holds no `$` at all, so the dictionary scan cannot see this.
    for (const [locale, dict] of [
      ["es", es],
      ["ru", ru],
    ] as const) {
      const rendered = withBasePrices(dict.pricing.approxNote, basePricesText(locale));
      expect(rendered).toContain("$150 MXN");
      for (const match of rendered.matchAll(/\$\s?\d[\d.,]*/g)) {
        expect(rendered.slice(match.index + match[0].length)).toMatch(/^\s*MXN\b/);
      }
    }
  });
});

describe("the button names the currency above it", () => {
  it.each(["es", "ru"] as const)("%s: the CTA carries the same string as the figure", (locale) => {
    const dict = locale === "es" ? es : ru;
    const copy = priceCopy(ctx("ARS"), locale, PESO);
    for (const plan of ["monthly", "annual", "lifetime"] as const) {
      const cta = withPrice(dict.pricing[plan].cardCta, copy[plan]);
      expect(cta).toContain(copy[plan]);
      expect(cta).not.toContain("{price}");
      expect(cta).not.toContain("MXN");
    }
  });

  it("and in pesos it reproduces the pre-09.09.2026 label exactly", () => {
    const copy = priceCopy(null, "es", PESO);
    expect(withPrice(es.pricing.monthly.cardCta, copy.monthly)).toBe("Empezar por $150 MXN/mes");
    expect(withPrice(ru.pricing.monthly.cardCta, copy.monthly)).toBe("Начать за $150 MXN/мес.");
    expect(withPrice(es.pricing.annual.perMonthNote, copy.annualPerMonth)).toBe(
      "≈$75 MXN/mes pagando por año"
    );
  });

  /** PROGRESS.md 4.1 — a filler that fills nothing would make every
   * assertion above pass by leaving the template untouched. */
  describe("positive control", () => {
    it("catches a template whose slot was never filled", () => {
      expect(withPrice("Empezar por {price}/mes", "≈ 11,70 SGD")).toBe("Empezar por ≈ 11,70 SGD/mes");
      expect(withPrice("Empezar por {precio}/mes", "≈ 11,70 SGD")).toContain("{precio}");
    });
  });
});
