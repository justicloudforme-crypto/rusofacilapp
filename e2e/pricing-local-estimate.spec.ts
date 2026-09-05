import { test, expect } from "./helpers/test";

/**
 * "≈ 11,70 SGD" under "$150 MXN": what a visitor outside Mexico is told the
 * peso price means in their own money (PROGRESS.md 7.118).
 *
 * WHY THESE NUMBERS. On 07.09.2026 the owner opened a real Stripe checkout
 * through a Singapore exit: Stripe offered 11.70 SGD for the 150 MXN
 * monthly plan and named its rate, 1 MXN = 0.0780 SGD. playwright.config.ts
 * feeds the server a fixed rate table (FX_RATES_MXN) holding that day's
 * mid-market rates, so this spec asserts the page lands on the number the
 * till actually showed — not merely that some number appears. It also means
 * the run never calls the rate feed.
 *
 * The rules this spec is written under, both earned the hard way:
 *
 *  * 7.116 — a rendered-surface check sees ONLY the state the interface is
 *    in, so every claim is made about TWO snapshots that are required to
 *    differ;
 *  * 7.117 — the second snapshot is taken at a FRESH URL, never through
 *    page.reload(), because WebKit answered a reload from its own cache and
 *    handed the control back a byte-identical page.
 *
 * The country arrives as `x-vercel-ip-country`. There is no Vercel edge in
 * front of `next start`, so here the header is simply the test saying where
 * the buyer is; its ABSENCE is a Mexican visitor, who gets no second figure
 * at all because the peso price already is their local one.
 */

/** The fixture sets `x-forwarded-for` per test so the rate limiters see
 * separate clients; page-level headers REPLACE the context's, so anything
 * set here carries its own address. */
function headers(country?: string): Record<string, string> {
  return {
    "x-forwarded-for": "10.118.0.1",
    ...(country ? { "x-vercel-ip-country": country } : {}),
  };
}

/** Narrow and no-break spaces to ordinary ones — Russian groups thousands
 * with U+00A0, and an expectation written with a plain space would fail on
 * a page that is perfectly correct. */
function plain(text: string): string {
  return text.replace(/ | /g, " ");
}

/** 150 / 899 / 2299 MXN, converted at the fixture's mid-market rates with
 * the 4% Adaptive-Pricing markup, then rounded the way currency.ts rounds.
 * Written out by hand rather than computed, so a change to the rounding
 * has to be re-justified here instead of silently agreeing with itself. */
const EXPECTED: Record<string, Record<string, string[]>> = {
  SG: {
    // 150 * 0.074971 * 1.04 = 11.6955 -> 11.70, which is what Stripe showed.
    es: ["≈ 11,70 SGD", "≈ 70,09 SGD", "≈ 179 SGD"],
    ru: ["≈ 11,70 SGD", "≈ 70,09 SGD", "≈ 179 SGD"],
  },
  AR: {
    es: ["≈ 13.900 ARS", "≈ 83.400 ARS", "≈ 213.000 ARS"],
    ru: ["≈ 13 900 ARS", "≈ 83 400 ARS", "≈ 213 000 ARS"],
  },
};

const APPROX_NOTE: Record<string, string> = {
  es: "Los importes en tu moneda son aproximados",
  ru: "Суммы в вашей валюте примерные",
};

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/pricing: a Singapore visitor is quoted the figure the checkout showed`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("SG"));
    await page.goto(`/${lang}/pricing`);

    const body = page.locator("body");
    const inSingapore = plain(await body.innerText());
    // A page that failed to render would pass every "does not contain"
    // below by having no text at all — PROGRESS.md 4.1.
    expect(inSingapore.length).toBeGreaterThan(500);

    // The peso figures are untouched and still present. This is the half
    // that would fail if the estimate had REPLACED the price rather than
    // joined it.
    for (const peso of ["$150 MXN", "$899 MXN", "$2,299 MXN"]) {
      expect(inSingapore).toContain(peso);
    }
    for (const approx of EXPECTED.SG[lang]) {
      expect(inSingapore).toContain(approx);
    }
    expect(inSingapore).toContain(APPROX_NOTE[lang]);

    // The peso stays the price: it is rendered visibly larger than the
    // estimate under it. Measured, not assumed from the class names.
    const pesoSize = await page
      .getByText("$150 MXN", { exact: true })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const approxSize = await page
      .getByText(EXPECTED.SG[lang][0], { exact: true })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(pesoSize).toBeGreaterThan(approxSize * 1.5);

    // THE CONTROL. The same page, one header removed, has to come back
    // DIFFERENT and carry no estimate at all — a Mexican reads pesos and
    // nothing else. Without this, every assertion above could be passing
    // against a page that shows the same thing to everyone.
    //
    // The control sends `MX` EXPLICITLY rather than dropping the header.
    // Dropping it tests "unknown country", which is a different rule with a
    // different answer; a real Mexican visitor arrives with MX in the
    // header, and the reason they see no estimate is that converting pesos
    // to pesos is noise. Only a control that says MX can catch a mapping
    // that started quoting Mexicans their own currency back.
    //
    // A fresh URL, not reload(): WebKit answers a reload from its own cache
    // (PROGRESS.md 7.117). The query string is ignored by the page.
    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}/pricing?control=in-mexico`);
    const inMexico = plain(await body.innerText());
    expect(inMexico).not.toBe(inSingapore);
    expect(inMexico).toContain("$150 MXN");
    expect(inMexico).not.toContain("SGD");
    expect(inMexico).not.toContain(APPROX_NOTE[lang]);
  });

  test(`/${lang}/pricing: the currency follows the country, not the language`, async ({ page }) => {
    // Argentina and Singapore read the SAME page in the same language and
    // must see different money — this is what proves the figure is derived
    // from the header rather than baked into the locale.
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}/pricing`);
    const inArgentina = plain(await page.locator("body").innerText());
    expect(inArgentina.length).toBeGreaterThan(500);
    for (const approx of EXPECTED.AR[lang]) {
      expect(inArgentina).toContain(approx);
    }
    expect(inArgentina).not.toContain("SGD");

    await page.setExtraHTTPHeaders(headers("SG"));
    await page.goto(`/${lang}/pricing?control=singapore`);
    const inSingapore = plain(await page.locator("body").innerText());
    expect(inSingapore).not.toBe(inArgentina);
    expect(inSingapore).toContain(EXPECTED.SG[lang][0]);
    expect(inSingapore).not.toContain("ARS");
  });

  test(`/${lang}/pricing: an unlisted country is told nothing rather than something wrong`, async ({ page }) => {
    // Cuba is in no allowlist here: Stripe does not serve it, so a
    // confident figure beside the price would be a promise about a payment
    // that cannot happen. The page must simply show pesos — the same thing
    // it showed before 08.09.2026.
    await page.setExtraHTTPHeaders(headers("CU"));
    await page.goto(`/${lang}/pricing`);
    const unlisted = plain(await page.locator("body").innerText());
    expect(unlisted.length).toBeGreaterThan(500);
    expect(unlisted).toContain("$150 MXN");
    expect(unlisted).not.toContain(APPROX_NOTE[lang]);

    // Control: the very same browser, one country code changed, does get a
    // figure. Otherwise "no estimate" could just mean "the feature is off".
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}/pricing?control=listed`);
    const listed = plain(await page.locator("body").innerText());
    expect(listed).not.toBe(unlisted);
    expect(listed).toContain(EXPECTED.AR[lang][0]);
  });

  test(`/${lang}: the front page's price strip carries the same estimate`, async ({ page }) => {
    // The three peso figures are repeated on the front page, so the second
    // line is repeated with them — a visitor who never opens /pricing
    // should not have to in order to find out what the number means.
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}`);
    const inArgentina = plain(await page.locator("body").innerText());
    expect(inArgentina.length).toBeGreaterThan(500);
    for (const approx of EXPECTED.AR[lang]) {
      expect(inArgentina).toContain(approx);
    }
    expect(inArgentina).toContain(APPROX_NOTE[lang]);

    // Explicitly MX, for the reason spelled out in the first test.
    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}?control=in-mexico`);
    const inMexico = plain(await page.locator("body").innerText());
    expect(inMexico).not.toBe(inArgentina);
    expect(inMexico).not.toContain("ARS");
    expect(inMexico).not.toContain(APPROX_NOTE[lang]);
  });
}
