/**
 * The visitor's own currency, and the approximate figure shown beside the
 * peso price.
 *
 * WHY THIS EXISTS. Since 06.09.2026 every plan is priced in Mexican pesos
 * and nothing else (PROGRESS.md 7.116) — the account settles in MXN, so
 * pricing in MXN is what removes a conversion instead of hiding it. That is
 * right for the till and useless for a reader: "$899 MXN" tells a buyer in
 * Buenos Aires or Singapore nothing about what they are about to spend.
 * Stripe's Adaptive Pricing, switched on in the dashboard on 07.09.2026,
 * does convert — but only once the buyer has already left the site and is
 * looking at the checkout form. This module fills the gap between the two
 * screens with a secondary, explicitly approximate figure.
 *
 * THE VISITOR'S CURRENCY IS THE PRICE (changed 09.09.2026, PROGRESS.md
 * 7.120). For one day this figure sat small and grey UNDER a large peso
 * price. That was backwards for exactly the reader it was written for: the
 * number they cannot act on was given the size that says "this is the
 * price". Now there is one figure per card and this is it, with the "≈" it
 * has always carried; the peso base price is named once, in a footnote at
 * the bottom of the page. A Mexican visitor still sees no conversion at
 * all — converting MXN to MXN is noise — and neither does anyone whose
 * country or rate we do not have.
 *
 * NOTE FOR THE "no dollar figures" RULE (src/lib/pricing-currency.test.ts,
 * e2e/pricing-currency.spec.ts). That rule bans a `$` that is not followed
 * by MXN, because the peso sign and the dollar sign are the same character.
 * Nothing here ever emits `$`: an approximate figure is always written as a
 * bare number plus the ISO code ("≈ 13 900 ARS"), which is unambiguous by
 * construction and cannot be mistaken for a peso amount. formatApproximate
 * is tested for that directly.
 */

/**
 * How much the checkout's own rate sits above the mid-market rate.
 *
 * Adaptive Pricing converts at a rate that already contains Stripe's
 * currency-conversion fee, documented at 2% (plus the card fee's own
 * currency component, which is why the band is usually quoted as 2–4%). We
 * do not get to see that rate from here, so the question is which side of
 * it to land on.
 *
 * MEASURED, 07.09.2026. The owner opened a real checkout through a
 * Singapore exit: Stripe offered 11.70 SGD for the 150 MXN monthly plan and
 * named its rate, 1 MXN = 0.0780 SGD. The mid-market rate from the source
 * below, the same day, was 0.074971 — so the checkout's rate was mid-market
 * +4.04%, the top of the band.
 *
 * So the markup is applied to the number the page shows, rather than
 * disclosed as a percentage next to a mid-market figure:
 *
 *  1. A buyer compares two numbers — the one on this page and the one on
 *     the checkout screen. A "+2–4% conversion fee" line asks them to do
 *     arithmetic, and nobody does it; they see a bigger number at the till
 *     and read it as bait.
 *  2. With 4% applied, that measured pair agrees to within 0.04%
 *     (0.074971 × 1.04 = 0.077970 against Stripe's 0.0780).
 *  3. The error is deliberately one-sided. If the real markup on a given
 *     day is nearer 2%, this page has quoted slightly MORE than the till
 *     will ask. Being pleasantly surprised at the checkout is a survivable
 *     failure; being ambushed there is not.
 *
 * What the copy says instead of a percentage: that the figure is
 * approximate and that the exact amount is set by the payment page. That is
 * the true statement, and it is the one a reader can act on.
 */
export const ADAPTIVE_PRICING_MARKUP = 0.04;

/**
 * ISO 3166-1 alpha-2 → the ISO 4217 code a buyer there thinks in.
 *
 * An ALLOWLIST, not a lookup table, and short on purpose. A country that is
 * not here gets no second figure — exactly what an unknown country gets —
 * because the promise being made is "this is roughly what your card will be
 * charged", and it is only worth making where all three of these hold:
 *
 *  * the currency is one Stripe can present at checkout, so the page and
 *    the till name the SAME currency (the owner's Singapore measurement
 *    showed the checkout switching itself to SGD);
 *  * the currency has a stable published rate — hyperinflating and
 *    multiple-rate currencies would put a confident-looking number next to
 *    a figure nobody can hit;
 *  * Stripe serves buyers there at all.
 *
 * Deliberate absences: CU and VE (Stripe does not serve them; VES also has
 * no single meaningful rate), RU and BY (same). EC, SV and PA are mapped to
 * USD because that is what people actually hold and pay in there.
 */
export const COUNTRY_CURRENCY: Readonly<Record<string, string>> = {
  // The Americas
  US: "USD", CA: "CAD", AR: "ARS", BR: "BRL", CL: "CLP", CO: "COP",
  PE: "PEN", UY: "UYU", PY: "PYG", BO: "BOB", CR: "CRC", GT: "GTQ",
  HN: "HNL", NI: "NIO", DO: "DOP", EC: "USD", SV: "USD", PA: "USD",
  PR: "USD",
  // The euro area
  ES: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", SK: "EUR",
  SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", CY: "EUR",
  MT: "EUR", HR: "EUR",
  // The rest of Europe
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  CZ: "CZK", RO: "RON", HU: "HUF", BG: "BGN", TR: "TRY", UA: "UAH",
  // Asia, the Pacific, Africa, the Middle East
  SG: "SGD", AU: "AUD", NZ: "NZD", JP: "JPY", KR: "KRW", IN: "INR",
  ID: "IDR", MY: "MYR", TH: "THB", PH: "PHP", HK: "HKD", TW: "TWD",
  IL: "ILS", AE: "AED", SA: "SAR", ZA: "ZAR",
};

/** The currency to quote to a visitor from `country`, or null when there is
 * none to quote: no country, a country we do not price for, or Mexico —
 * where the peso figure already IS the local figure. */
export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const code = COUNTRY_CURRENCY[country.toUpperCase()];
  return code && code !== "MXN" ? code : null;
}

/** What a rate lookup and a country add up to: enough to convert, or
 * nothing at all. Built on the server (src/lib/country-server.ts) and
 * carried into client components as finished strings, never as this. */
export interface LocalPriceContext {
  /** ISO 4217 of the visitor's currency. Never "MXN". */
  currency: string;
  /** Units of `currency` per one peso, mid-market, before the markup. */
  rate: number;
}

/** Decimal places this currency is normally written with — 2 for the euro,
 * 0 for the Chilean peso and the yen. Asked of the platform rather than
 * kept as a table here, so a currency added to the allowlist above cannot
 * arrive with the wrong precision. */
function fractionDigits(currency: string, locale: string): number {
  try {
    const resolved = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions();
    return resolved.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * The figure, rounded so that it reads as an estimate.
 *
 * Under 100 units the currency's own precision is kept — the owner's
 * measured checkout said 11.70 SGD, and "≈ 12 SGD" beside it would look
 * like a different number. At 100 and above the value is cut to three
 * significant figures (13,918 → 13,900), which is what makes an approximate
 * figure LOOK approximate; a five-digit exact number reads as a quote.
 */
export function roundApproximate(value: number, digits: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 100) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 2);
  return Math.round(value / magnitude) * magnitude;
}

/**
 * "≈ 13 900 ARS" — or null when there is nothing honest to say.
 *
 * Never a `$`, never a bare number: the ISO code is the whole point. The
 * amount arrives in peso centavos, the same integer /api/checkout hands to
 * Stripe (src/lib/plans.ts), so the estimate and the charge start from one
 * number rather than two.
 */
export function formatApproximate(
  amountMxnCents: number,
  context: LocalPriceContext | null,
  locale: string
): string | null {
  if (!context) return null;
  const { currency, rate } = context;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const raw = (amountMxnCents / 100) * rate * (1 + ADAPTIVE_PRICING_MARKUP);
  const digits = fractionDigits(currency, locale);
  const rounded = roundApproximate(raw, digits);
  if (rounded <= 0) return null;

  // Three significant figures leave nothing after the point above 100, so
  // printing the currency's decimals there would only add two fake zeros.
  const shown = rounded < 100 ? digits : 0;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: shown,
    maximumFractionDigits: shown,
    // Explicit, because the default ("auto") leaves four-digit numbers
    // ungrouped in both of this site's locales: "8600 CLP" beside a
    // grouped "$2,299 MXN" looks like two different kinds of number.
    useGrouping: true,
  }).format(rounded);
  return `≈ ${number} ${currency}`;
}
