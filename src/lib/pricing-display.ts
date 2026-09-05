import {
  approximateAmount,
  formatAmount,
  machineAmount,
  type ApproximateAmount,
  type LocalPriceContext,
} from "./currency";
import { BASE_CURRENCY, formatMoney, plans } from "./plans";

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

/**
 * One plan's price as a machine reads it — what goes into the `Offer` in
 * the JSON-LD of /pricing (PROGRESS.md 7.122, debt 44).
 *
 * It is built HERE, beside the string the card prints, and from the same
 * converted amount — not recomputed at the markup's call site. Since 7.118
 * this page is personalised: a visitor in Madrid is shown euros and a
 * visitor in Mexico pesos, from the same URL. Structured data has to name
 * the figure THIS response rendered, so the only safe construction is one
 * amount with two renderings, never two amounts that are meant to agree.
 */
export interface OfferAmount {
  /** A plain decimal with a dot and no grouping — "150", "11.70",
   * "13900" — which is the only form schema.org's `price` accepts. Same
   * decimals as the printed figure. */
  price: string;
  /** ISO 4217 of the figure actually shown: the visitor's currency when
   * these are conversions, "MXN" when they are the base prices. */
  currency: string;
}

export interface PriceCopy extends PesoPriceCopy {
  /** True when these four are converted estimates rather than the peso
   * prices. The footnote is shown if and only if this is true: in Mexico,
   * and wherever no rate could be had, that sentence would be describing
   * something the reader cannot see. */
  converted: boolean;
  /** The same three plan prices as numbers, for structured data. Always
   * present, and always in the currency the four strings above are in —
   * pesos when `converted` is false. */
  offers: Record<"monthly" | "annual" | "lifetime", OfferAmount>;
}

/** The base price of a plan as an `Offer`: "$2,299 MXN" is 2299 MXN. Kept
 * to formatMoney's own rule — centavos only when there are any — so the
 * markup and the printed price round the same way. */
export function pesoOffer(amountMxnCents: number): OfferAmount {
  const pesos = Math.trunc(amountMxnCents / 100);
  const centavos = amountMxnCents % 100;
  return {
    price: centavos === 0 ? String(pesos) : `${pesos}.${String(centavos).padStart(2, "0")}`,
    currency: BASE_CURRENCY.toUpperCase(),
  };
}

const PESO_OFFERS: PriceCopy["offers"] = {
  monthly: pesoOffer(plans.monthly.amountMxnCents),
  annual: pesoOffer(plans.annual.amountMxnCents),
  lifetime: pesoOffer(plans.lifetime.amountMxnCents),
};

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
  const approx = (cents: number) => approximateAmount(cents, context, locale);
  const monthly = approx(plans.monthly.amountMxnCents);
  const annual = approx(plans.annual.amountMxnCents);
  const lifetime = approx(plans.lifetime.amountMxnCents);
  const annualPerMonth = approx(perMonthCents(plans.annual.amountMxnCents));
  if (!monthly || !annual || !lifetime || !annualPerMonth) {
    return { ...peso, converted: false, offers: PESO_OFFERS };
  }
  const write = (amount: ApproximateAmount) => formatAmount(amount, locale);
  const offer = (amount: ApproximateAmount): OfferAmount => ({
    price: machineAmount(amount),
    currency: amount.currency,
  });
  return {
    monthly: write(monthly),
    annual: write(annual),
    lifetime: write(lifetime),
    annualPerMonth: write(annualPerMonth),
    converted: true,
    // Derived from the very amounts written out on the line above, so the
    // number a crawler reads and the number a reader sees cannot diverge.
    offers: { monthly: offer(monthly), annual: offer(annual), lifetime: offer(lifetime) },
  };
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

/**
 * The `Product` block of /pricing, with one `Offer` per paid plan.
 *
 * DEBT 44, and why it stayed open until 10.09.2026. Until today /pricing
 * carried only FAQPage and BreadcrumbList — no Offer at all — and that was
 * the safe state rather than an oversight: since 7.118 the page is
 * personalised, so an Offer written from the peso constants would have
 * advertised "899 MXN" to a reader who was being shown "≈ 45,80 EUR". A
 * price in structured data is a promise to the person who clicks the search
 * result; naming a figure that this very response did not render is exactly
 * the class of lie 7.120 spent a whole round removing from the copy.
 *
 * So the numbers come from `copy.offers`, which is the same converted
 * amount the cards print (see priceCopy above), and the currency comes with
 * them. In Mexico, in an unlisted or unknown country, and whenever the rate
 * feed stayed silent, that is MXN and the base prices — the same thing the
 * reader sees.
 *
 * The free tier is deliberately not an Offer. It is not sold, it needs no
 * `price`, and a "0 MXN" offer would make the page look like it sells four
 * things.
 */
export function pricingOffersJsonLd(args: {
  lang: string;
  url: string;
  name: string;
  description: string;
  planNames: Record<"monthly" | "annual" | "lifetime", string>;
  copy: PriceCopy;
}) {
  const { lang, url, name, description, planNames, copy } = args;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    brand: { "@type": "Brand", name: "RusoFácilapp" },
    url,
    offers: (["monthly", "annual", "lifetime"] as const).map((plan) => ({
      "@type": "Offer",
      name: planNames[plan],
      price: copy.offers[plan].price,
      priceCurrency: copy.offers[plan].currency,
      url,
      availability: "https://schema.org/InStock",
      // The locale the figure was formatted in, so the block says which
      // rendering of the page it describes.
      inLanguage: lang,
    })),
  };
}
