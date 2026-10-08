import { test, expect } from "./helpers/test";

/**
 * DEBT 44 and 7.260: /pricing carries an `Offer`, it names the base prices
 * in MXN whatever the reader's country, and those figures are ON THE PAGE.
 *
 * WHAT CHANGED IN 7.260. From 10.09.2026 (7.122) the Offer followed the
 * card: euros in Madrid, dollars in Texas. But outside Mexico the card is
 * an estimate ("≈", footnote) and the charge is always pesos — Google's
 * Rich Results Test, crawling from the US, read 8.66 / 51.92 / 133 USD,
 * a figure nobody is charged. Now the Offer is always 150 / 899 / 2299 MXN
 * from plans.ts.
 *
 * WHAT THIS SPEC MEASURES, and why it is not a unit test. Google's rule is
 * that the price in the markup is visible on the page. The unit tests in
 * src/lib/pricing-display.test.ts hold the block against the dictionary
 * strings inside the module; nothing there sees whether the page actually
 * renders those strings to a reader in Madrid. So this reads the rendered
 * HTML: the `price`/`priceCurrency` out of the JSON-LD, and then the same
 * figure written as a reader reads it ("$2,299 MXN") — as a whole card
 * element in Mexico, inside the footnote where the cards are conversions.
 *
 * FOUR COUNTRIES, chosen for the four answers the page has:
 *
 *  * MX — pesos on the cards;
 *  * ES — euros on the cards (decimals), pesos in the footnote;
 *  * AR — pesos argentinos on the cards (grouping differs between the two
 *    locales), pesos in the footnote;
 *  * BR — a dead rate feed (BRL is deliberately absent from the fixture
 *    table in playwright.config.ts): pesos on the cards, no footnote.
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

/** "2299" → "$2,299 MXN": how formatMoney (src/lib/plans.ts) writes a
 * peso amount for a reader — en-US grouping and the MXN suffix. This
 * formats; the amount itself is never recomputed here. */
function asWritten(offer: Offer): string {
  const [whole, cents] = offer.price.split(".");
  return `$${Number(whole).toLocaleString("en-US")}${cents ? `.${cents}` : ""} MXN`;
}

/** What the cards are in, per country — the control that each country
 * really was rendered its own way. */
const CARD_CURRENCY: Record<string, string> = { MX: "MXN", ES: "EUR", AR: "ARS", BR: "MXN" };

for (const lang of ["es", "ru"] as const) {
  for (const country of ["MX", "ES", "AR", "BR"] as const) {
    test(`/${lang}/pricing from ${country}: the Offer is the peso price, and it is on the page`, async ({ page }) => {
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
        expect(offer.priceCurrency, `${country}: the markup is in the currency charged`).toBe("MXN");
      }
      // Monthly, annual, Premium — the base prices, in that order.
      expect(offers!.map((offer) => offer.price)).toEqual(["150", "899", "2299"]);

      const converted = CARD_CURRENCY[country] !== "MXN";
      // The cards really are what this country is shown — otherwise every
      // case below would be the Mexican page four times over.
      await expect(page.getByText(new RegExp(`${CARD_CURRENCY[country]}\\*?$`)).first()).toBeVisible();

      for (const offer of offers!) {
        const figure = asWritten(offer);
        if (converted) {
          // The one footnote, visible, naming the figure.
          await expect(
            page.locator("p", { hasText: figure }).filter({ hasText: "MXN" }).last(),
            `${offer.name}: "${figure}" is in the footnote`
          ).toBeVisible();
        } else {
          await expect(
            page.getByText(figure, { exact: true }).first(),
            `${offer.name}: "${figure}" is on the card`
          ).toBeVisible();
        }
      }
    });
  }
}
