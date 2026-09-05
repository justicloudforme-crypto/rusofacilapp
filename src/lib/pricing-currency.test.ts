import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { formatMoney, plans, BASE_CURRENCY } from "./plans";
import { withPrice } from "./pricing-display";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";

/**
 * No dollar figure is left anywhere a visitor can read one.
 *
 * Why this needs a check of its own. On 2026-09-06 the base price moved from
 * USD to MXN (PROGRESS.md 7.116), and the peso is written with the SAME `$`
 * sign as the dollar. So "$150" is not evidence of anything: the only thing
 * that tells a reader which currency they are being asked for is the "MXN"
 * after it. A half-finished migration does not look broken — it looks like a
 * price. That is exactly the class of defect that survives a careful reading.
 *
 * The rule enforced here, on every string a visitor can see:
 *
 *   1. the three letters USD do not appear at all;
 *   2. every `$` followed by a digit is followed, immediately after the
 *      number, by `MXN`.
 *
 * Rule 2 is the one that matters and the one that is easy to get wrong: it
 * rejects "$150", "$7.99/mes" and "≈$4/mes" while accepting "$150 MXN" and
 * "$899 MXN/año". A visitor never has to work out which dollar is meant.
 *
 * WHAT THIS DOES NOT COVER. It reads the dictionaries and the /pricing
 * source, which is where every price string in this app lives — it does not
 * open a browser. The rendered page is checked in the browser by
 * e2e/pricing-currency.spec.ts, which applies this same rule to the text
 * Chromium and Mobile Safari actually paint.
 */

/** Money-shaped text with no MXN marker after it. Exported shape kept in
 * step with e2e/pricing-currency.spec.ts by hand — see the note there. */
export function unmarkedMoney(text: string): string[] {
  const found: string[] = [];
  const pattern = /\$\s?\d[\d.,]*/g;
  for (const match of text.matchAll(pattern)) {
    const after = text.slice(match.index + match[0].length);
    if (!/^\s*MXN\b/.test(after)) found.push(match[0]);
  }
  return found;
}

export function usdMentions(text: string): string[] {
  return [...text.matchAll(/\bUSD\b/g)].map((m) => m[0]);
}

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}) {
  if (typeof value === "string") {
    out[prefix] = value;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

const DICTIONARIES: Array<[string, Record<string, string>]> = [
  ["es.json", flatten(es)],
  ["ru.json", flatten(ru)],
];

/** Every file that can put a price on the /pricing page without going
 * through a dictionary: the page itself and the three cards it renders. */
function pricingSources(): Array<[string, string]> {
  const root = path.join(process.cwd(), "src");
  const files = [path.join(root, "app", "[lang]", "pricing", "page.tsx")];
  const components = path.join(root, "components", "pricing");
  for (const name of readdirSync(components)) {
    if (name.endsWith(".tsx")) files.push(path.join(components, name));
  }
  return files.map((file) => [path.relative(root, file), readFileSync(file, "utf8")]);
}

describe("no dollar figures on the public pricing surface", () => {
  it("reads real content — an empty scan would pass everything below", () => {
    const [, esFlat] = DICTIONARIES[0];
    expect(Object.keys(esFlat).length).toBeGreaterThan(1000);
    expect(esFlat["pricing.monthly.price"]).toBeTruthy();
    expect(pricingSources().length).toBeGreaterThanOrEqual(4);
  });

  it.each(DICTIONARIES)("%s contains no USD price text", (_file, flat) => {
    const offenders = Object.entries(flat)
      .flatMap(([key, value]) => [
        ...usdMentions(value).map(() => `${key}: USD in "${value}"`),
        ...unmarkedMoney(value).map((hit) => `${key}: "${hit}" is not marked MXN, in "${value}"`),
      ]);
    expect(offenders).toEqual([]);
  });

  it("the /pricing page and its cards hold no price text of their own", () => {
    const offenders = pricingSources().flatMap(([file, source]) => [
      ...usdMentions(source).map(() => `${file}: USD`),
      ...unmarkedMoney(source).map((hit) => `${file}: "${hit}" is not marked MXN`),
    ]);
    expect(offenders).toEqual([]);
  });

  it("every plan's price text is exactly its amount, in pesos", () => {
    for (const plan of ["monthly", "annual", "lifetime"] as const) {
      const asText = formatMoney(plans[plan].amountMxnCents);
      expect(asText).toMatch(/^\$[\d,]+ MXN$/);
      expect(es.pricing[plan].price).toBe(asText);
      expect(ru.pricing[plan].price).toBe(asText);
      // The call-to-action a buyer actually presses names the same figure —
      // the price above the fold and the price on the button cannot differ.
      //
      // Since 09.09.2026 the card CTA does not hold the figure at all: it
      // holds a `{price}` slot that /pricing fills with whatever it just put
      // on the card, which is how the button and the price are kept in the
      // same currency by construction rather than by two matching literals
      // (PROGRESS.md 7.120). So what is checked is that the slot exists and
      // that filling it with the peso price reproduces the old string. The
      // CASH CTA still carries the peso figure outright, and rightly: an
      // OXXO voucher is only ever offered to a buyer in Mexico, where the
      // peso price is the only price.
      for (const dict of [es, ru]) {
        expect(dict.pricing[plan].cardCta).toContain("{price}");
        expect(withPrice(dict.pricing[plan].cardCta, asText)).toContain(asText);
        expect(dict.pricing[plan].cashCta).toContain(asText);
      }
    }
    expect(BASE_CURRENCY).toBe("mxn");
  });

  it("the annual plan's per-month figure is the peso fallback, and is marked MXN", () => {
    // Shown under the annual card when nothing was converted, and replaced
    // by the visitor's own currency when something was. It is deliberately
    // hand-written rather than derived — 89 900 / 12 is 74.92, and
    // "$74.92 MXN/mes" reads as a converted figure rather than a price —
    // so the only thing to hold it to is the currency rule and the size of
    // the number.
    for (const dict of [es, ru]) {
      expect(dict.pricing.annual.perMonthPrice).toBe("≈$75 MXN");
      expect(unmarkedMoney(dict.pricing.annual.perMonthPrice)).toEqual([]);
      expect(dict.pricing.annual.perMonthNote).toContain("{price}");
    }
    const exact = plans.annual.amountMxnCents / 12 / 100;
    expect(Math.abs(exact - 75)).toBeLessThan(1);
  });

  it("the conversion footnote names the base prices through a slot, not a literal", () => {
    // The footnote is now the ONLY place on the page a peso figure appears
    // for a visitor who is being quoted in their own money. It must not
    // hardcode those figures: they are filled in from plans.ts at render
    // time (basePricesText), so a price change cannot leave the footnote
    // quoting a price the site no longer charges.
    for (const dict of [es, ru]) {
      expect(dict.pricing.approxNote).toContain("{prices}");
      expect(dict.pricing.approxNote.startsWith("*")).toBe(true);
      expect(unmarkedMoney(dict.pricing.approxNote)).toEqual([]);
      // And the thing this footnote replaced: it used to say the charge is
      // always in pesos, which Adaptive Pricing makes false.
      expect(dict.pricing.approxNote).not.toMatch(/cobro siempre|Списание всегда/);
    }
  });

  /**
   * PROGRESS.md 4.1. Both halves of the rule are planted separately,
   * because they fail for different reasons: rule 1 is a word, rule 2 is a
   * missing suffix, and a detector can easily have only one of them.
   */
  describe("positive control — the detector must find a planted dollar", () => {
    it("catches the exact string this migration replaced", () => {
      expect(usdMentions("$122.99 USD")).toEqual(["USD"]);
      expect(unmarkedMoney("$122.99 USD")).toEqual(["$122.99"]);
    });

    it("catches a dollar figure with no currency word at all", () => {
      // The dangerous one: nothing here says "dollar", and it reads as a
      // price. Only the absent MXN gives it away.
      expect(usdMentions("Empezar por $7.99/mes")).toEqual([]);
      expect(unmarkedMoney("Empezar por $7.99/mes")).toEqual(["$7.99"]);
      expect(unmarkedMoney("≈$4/mes pagando por año")).toEqual(["$4"]);
    });

    it("catches a planted value inside the real dictionary scan", () => {
      const planted = { ...DICTIONARIES[0][1], "pricing.monthly.price": "$7.99 USD" };
      const offenders = Object.entries(planted).filter(
        ([, value]) => usdMentions(value).length > 0 || unmarkedMoney(value).length > 0
      );
      expect(offenders.map(([key]) => key)).toEqual(["pricing.monthly.price"]);
    });

    it("negative control — the peso strings we ship are NOT flagged", () => {
      // Without this the rule could be "flag everything with a $", which
      // would pass the clean set only by rejecting it too.
      for (const good of ["$150 MXN", "$2,299 MXN", "Pagar en efectivo — $899 MXN", "≈$75 MXN/mes"]) {
        expect(unmarkedMoney(good)).toEqual([]);
        expect(usdMentions(good)).toEqual([]);
      }
    });
  });
});
