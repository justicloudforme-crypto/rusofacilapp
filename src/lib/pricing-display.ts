import { formatApproximate, type LocalPriceContext } from "./currency";
import { formatMoney, plans } from "./plans";

/**
 * Which figure goes on the card — one figure, not two.
 *
 * WHAT CHANGED ON 09.09.2026 (PROGRESS.md 7.120). Between 08.09 and 09.09
 * a card showed the peso price large and the visitor's own money small and
 * grey underneath. That is backwards for everyone the second line was
 * written for: a reader in Buenos Aires or Madrid was given the number they
 * cannot act on in the size that says "this is the price", and the number
 * they can act on in the size that says "footnote". Now the visitor's
 * currency IS the figure — large, with the "≈" it has always carried — and
 * the peso base price moves to ONE footnote at the bottom of the page.
 *
 * WHO STILL SEES PESOS, and it is not an error path:
 *
 *  * Mexico — the peso figure already is the local one, and it is shown
 *    without "≈" and without the footnote, which would be explaining a
 *    conversion that did not happen;
 *  * an unknown country, a country outside the 44-currency allowlist in
 *    src/lib/currency.ts, or a rate feed that did not answer.
 *
 * ALL OR NOTHING, and that is the point of building the whole set here
 * rather than converting each figure where it is printed. If any one of the
 * four amounts fails to convert — a currency the feed skipped, a rate that
 * arrived as zero — the page falls back to pesos for ALL of them. A card
 * reading "≈ 7,95 EUR" next to one reading "$899 MXN" is worse than either
 * page on its own: it invites a comparison between two currencies and makes
 * the annual plan look like the expensive one.
 */

/** The peso strings from the dictionary, used verbatim when there is
 * nothing to convert to. */
export interface PesoPriceCopy {
  monthly: string;
  annual: string;
  lifetime: string;
  /** The annual plan's per-month figure — "≈$75 MXN". */
  annualPerMonth: string;
}

export interface PriceCopy extends PesoPriceCopy {
  /** True when these four are converted estimates rather than the peso
   * prices. The footnote is shown if and only if this is true: in Mexico,
   * and wherever no rate could be had, that sentence would be describing
   * something the reader cannot see. */
  converted: boolean;
}

/** The footnote marker on the figure. One asterisk, one footnote, at the
 * bottom of the page — the price does not carry its own explanation. */
export const FOOTNOTE_MARK = "*";

/** What "$899 MXN a year" is per month, in peso centavos. Derived from
 * plans.ts rather than written down again, so the estimate under the annual
 * card cannot drift away from the amount actually charged. */
export function perMonthCents(annualCents: number): number {
  return Math.round(annualCents / 12);
}

export function priceCopy(
  context: LocalPriceContext | null,
  locale: string,
  peso: PesoPriceCopy
): PriceCopy {
  const approx = (cents: number) => formatApproximate(cents, context, locale);
  const monthly = approx(plans.monthly.amountMxnCents);
  const annual = approx(plans.annual.amountMxnCents);
  const lifetime = approx(plans.lifetime.amountMxnCents);
  const annualPerMonth = approx(perMonthCents(plans.annual.amountMxnCents));
  if (!monthly || !annual || !lifetime || !annualPerMonth) return { ...peso, converted: false };
  return { monthly, annual, lifetime, annualPerMonth, converted: true };
}

/** The figure as it goes on the card: with the footnote marker when there
 * is a footnote to point at, and bare when there is not. */
export function marked(price: string, copy: PriceCopy): string {
  return copy.converted ? `${price}${FOOTNOTE_MARK}` : price;
}

/**
 * "$150 MXN, $899 MXN y $2,299 MXN" — the three base prices, named in the
 * footnote because that is now the only place on the page they appear.
 *
 * Built from plans.ts through formatMoney, the same function the pricing
 * text and the Stripe health check are held to (src/lib/plans.ts), so the
 * footnote cannot come to name a price the site no longer charges. Each
 * amount keeps its own "MXN": the peso sign is the dollar sign, and
 * "$150, $899 y $2,299 MXN" would leave the first two unmarked — the exact
 * thing src/lib/pricing-currency.test.ts exists to reject.
 */
export function basePricesText(locale: string): string {
  const amounts = (["monthly", "annual", "lifetime"] as const).map((plan) =>
    formatMoney(plans[plan].amountMxnCents)
  );
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(amounts);
  } catch {
    return amounts.join(", ");
  }
}

/** Fills the `{price}` slot of a button label or a per-month note. The
 * label and the figure above it name the SAME currency by construction —
 * they are the same string. */
export function withPrice(template: string, price: string): string {
  return template.replaceAll("{price}", price);
}

/** Fills the `{prices}` slot of the footnote. */
export function withBasePrices(template: string, prices: string): string {
  return template.replaceAll("{prices}", prices);
}
