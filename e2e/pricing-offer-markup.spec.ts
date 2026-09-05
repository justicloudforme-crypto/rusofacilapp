import { test, expect } from "./helpers/test";

/**
 * DEBT 44: /pricing carries an `Offer`, and it names the figure THIS
 * response rendered (PROGRESS.md 7.122).
 *
 * WHY THE DEBT WAITED. Until 10.09.2026 the page had FAQPage and
 * BreadcrumbList and no Offer at all, which was the safe state rather than
 * an omission: since 7.118 the page is personalised. A visitor in Madrid is
 * shown euros, a visitor in Mexico pesos, from one URL — so an Offer
 * written from the peso constants would have advertised "899 MXN" in the
 * search result of a reader who then lands on "≈ 45,80 EUR". A price in
 * structured data is a promise to whoever clicks that result.
 *
 * WHAT THIS SPEC MEASURES, and why it is not a unit test. The unit tests in
 * src/lib/pricing-display.test.ts hold the markup number against the card
 * string INSIDE the module. Nothing there can see whether the page hands
 * that module's output to both places — the very failure being guarded
 * against is a page that prints one number and computes a second for the
 * crawler. So this reads the rendered HTML: the `price`/`priceCurrency` out
 * of the JSON-LD, and then the same figure as an element on the card,
 * matched EXACTLY.
 *
 * THREE COUNTRIES, chosen for the three answers the rule has:
 *
 *  * MX — pesos, because pesos are the local money there;
 *  * ES — a converted figure in euros, decimals kept (under 100 units);
 *  * AR — a converted figure in pesos argentinos, four/six digits, which
 *    is where the grouping separator differs between the two locales
 *    ("13.900" in Spanish, "13 900" with U+00A0 in Russian) and where a
 *    naive comparison of digits would go wrong.
 *
 * The country arrives as `x-vercel-ip-country`; there is no Vercel edge in
 * front of `next start`, so here it is simply the test saying where the
 * buyer is. Mexico is sent EXPLICITLY as `MX` — an absent header is the
 * different rule "we do not know where you are", and in 7.118 a control
 * written the absent way missed a planted defect 8 times out of 8.
 */

function headers(country: string): Record<string, string> {
  return { "x-forwarded-for": "10.122.0.1", "x-vercel-ip-country": country };
}

interface Offer {
  "@type": string;
  name: string;
  price: string;
  priceCurrency: string;
}

/** The Product block of the page as served, or null if the page carries
 * none — which is itself a failure, and reported as one below. */
async function productOffers(page: import("@playwright/test").Page): Promise<Offer[] | null> {
  return page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const block of blocks) {
      const data = JSON.parse(block.textContent ?? "{}");
      if (data["@type"] === "Product" && Array.isArray(data.offers)) return data.offers;
    }
    return null;
  });
}

/**
 * The figure a machine number would be written as on the card, in this
 * locale — the assertion's other half.
 *
 * This formats; it does NOT convert. The rate, the 4% markup and the
 * rounding all happened once, on the server, and their result is what
 * arrives here as `price`. Re-deriving any of that would let this spec
 * agree with a page that is wrong in the same way.
 *
 * Peso amounts are written by formatMoney (src/lib/plans.ts) as
 * "$2,299 MXN" — en-US grouping and the MXN suffix that is the only thing
 * distinguishing a peso sign from a dollar sign. Converted amounts are
 * written by formatAmount (src/lib/currency.ts) as "≈ 13.900 ARS", grouped
 * in the page's own locale, and carry the footnote asterisk.
 */
function asWritten(offer: Offer, locale: string): string {
  const digits = offer.price.includes(".") ? offer.price.split(".")[1].length : 0;
  const value = Number(offer.price);
  if (offer.priceCurrency === "MXN") {
    const whole = Math.trunc(value).toLocaleString("en-US");
    return digits === 0 ? `$${whole} MXN` : `$${whole}.${offer.price.split(".")[1]} MXN`;
  }
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(value);
  // The asterisk points at the single conversion footnote at the foot of
  // the page; a peso figure has no footnote and carries no marker.
  return `≈ ${number} ${offer.priceCurrency}*`;
}

const EXPECTED_CURRENCY: Record<string, string> = { MX: "MXN", ES: "EUR", AR: "ARS" };

for (const lang of ["es", "ru"] as const) {
  for (const country of ["MX", "ES", "AR"] as const) {
    test(`/${lang}/pricing from ${country}: the Offer names the figure on the card`, async ({ page }) => {
      await page.setExtraHTTPHeaders(headers(country));
      await page.goto(`/${lang}/pricing`);

      // A page that failed to render would satisfy several checks below by
      // having nothing in it — PROGRESS.md 4.1.
      const body = await page.locator("body").innerText();
      expect(body.length).toBeGreaterThan(500);

      const offers = await productOffers(page);
      expect(offers, "the page carries a Product block with offers").not.toBeNull();
      expect(offers).toHaveLength(3);

      for (const offer of offers!) {
        expect(offer["@type"]).toBe("Offer");
        // The currency of the country, not of the language: this same page
        // in Spanish is euros in Madrid and pesos in Mexico City.
        expect(offer.priceCurrency, `${country} is quoted in its own currency`).toBe(
          EXPECTED_CURRENCY[country]
        );
        // A machine number: a plain decimal, no grouping, no sign, no code.
        expect(offer.price).toMatch(/^\d+(\.\d+)?$/);

        // THE CLAIM. The figure the markup names, written out, is on the
        // card — as the whole text of an element, not as a substring of a
        // sentence somewhere.
        const figure = asWritten(offer, lang);
        await expect(
          page.getByText(figure, { exact: true }).first(),
          `${offer.name}: ${offer.price} ${offer.priceCurrency} is rendered as "${figure}"`
        ).toBeVisible();
      }

      // Three plans, three different amounts — a page whose markup repeated
      // one plan's price three times would pass every assertion above.
      expect(new Set(offers!.map((offer) => offer.price)).size).toBe(3);
      expect(new Set(offers!.map((offer) => offer.name)).size).toBe(3);
      // Monthly, annual, Premium — in that order, which is ascending in
      // every currency because conversion is monotonic. This is what ties a
      // price to the plan it is named against: a block that paired the
      // right three numbers with the wrong three names would otherwise
      // satisfy every "the figure is on the card" check above.
      const values = offers!.map((offer) => Number(offer.price));
      expect(values).toEqual([...values].sort((a, b) => a - b));
    });
  }

  /**
   * THE CONTROL, and it is the reason the loop above is not enough. Every
   * assertion there is made about ONE rendering; all of them would still
   * pass on a page that showed the same thing to everybody. Two countries,
   * one browser, and the two answers have to differ — in the markup and on
   * the card alike.
   *
   * A fresh URL, never page.reload(): WebKit answered a reload out of its
   * own cache and handed a byte-identical page back to a control (7.117).
   */
  test(`/${lang}/pricing: the markup follows the country, not the page`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}/pricing`);
    const inArgentina = (await productOffers(page))!;
    expect(inArgentina.every((offer) => offer.priceCurrency === "ARS")).toBe(true);

    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}/pricing?control=in-mexico`);
    const inMexico = (await productOffers(page))!;
    expect(inMexico.every((offer) => offer.priceCurrency === "MXN")).toBe(true);
    expect(inMexico.map((offer) => offer.price)).toEqual(["150", "899", "2299"]);
    expect(inMexico.map((offer) => offer.price)).not.toEqual(inArgentina.map((offer) => offer.price));

    // And the base prices are what a Mexican reader is actually shown, so
    // the MXN branch is not merely "some constant that happens to be MXN".
    for (const offer of inMexico) {
      await expect(page.getByText(asWritten(offer, lang), { exact: true }).first()).toBeVisible();
    }
  });

  /**
   * A dead rate feed. Brazil is in the allowlist — BRL is a promise this
   * site is willing to make — and BRL is deliberately absent from the
   * fixture rate table in playwright.config.ts, which is the same null
   * every failure path of src/lib/exchange-rates.ts returns. The card falls
   * back to pesos whole (7.120); the markup has to fall back with it,
   * because an Offer in BRL over a card in MXN is the exact mismatch this
   * file exists to prevent.
   */
  test(`/${lang}/pricing: a dead rate feed leaves pesos in the markup too`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("BR"));
    await page.goto(`/${lang}/pricing`);
    const offers = (await productOffers(page))!;
    expect(offers.every((offer) => offer.priceCurrency === "MXN")).toBe(true);
    for (const offer of offers) {
      await expect(page.getByText(asWritten(offer, lang), { exact: true }).first()).toBeVisible();
    }
  });
}
