import { test, expect } from "./helpers/test";

/**
 * "≈ 11,70 SGD" IS the price on the card, and the peso figure appears once,
 * in the footnote at the bottom (PROGRESS.md 7.120).
 *
 * WHAT THIS SPEC ASSERTED YESTERDAY, and why it changed. Between 08.09 and
 * 09.09.2026 the page showed "$150 MXN" large with "≈ 11,70 SGD" small and
 * grey underneath, and this file measured exactly that — it required the
 * peso figure to be at least 1.5× the size of the estimate. That got the
 * emphasis backwards for the only reader the second line was ever written
 * for. The measurement is kept and inverted: the figure a visitor can act
 * on is now the large one, and what it is measured against is the footnote.
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
 * the buyer is; every control that means "a Mexican visitor" sends `MX`
 * EXPLICITLY, because an ABSENT header is the different rule "we do not
 * know where you are" — and in 7.118 a control written the absent way
 * missed a planted defect 8 times out of 8.
 */

/** The fixture sets `x-forwarded-for` per test so the rate limiters see
 * separate clients; page-level headers REPLACE the context's, so anything
 * set here carries its own address. */
function headers(country?: string): Record<string, string> {
  return {
    "x-forwarded-for": "10.120.0.1",
    ...(country ? { "x-vercel-ip-country": country } : {}),
  };
}

/** Narrow and no-break spaces to ordinary ones — Russian groups thousands
 * with U+00A0, and an expectation written with a plain space would fail on
 * a page that is perfectly correct.
 *
 * Written as escapes, not as the characters themselves. The first draft of
 * this file carried the literal U+00A0 and U+202F in the pattern; they were
 * flattened to ordinary spaces somewhere between here and the disk, which
 * turned the whole function into `replace(" ", " ")` — and six Russian
 * tests failed against a page that was correct. An invisible character in
 * a regex is not readable and not reviewable; \u00a0 is both. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** The figure as the card actually renders it: with the footnote asterisk.
 * The plain form is what the button label carries — the marker leads to the
 * footnote, and a button is not a place a reader looks one up. */
function onCard(figure: string): string {
  return `${figure}*`;
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

/** The three peso amounts, which for a converted visitor must now appear
 * ONCE each — inside the footnote and nowhere else. */
const PESOS = ["$150 MXN", "$899 MXN", "$2,299 MXN"];

const FOOTNOTE: Record<string, string> = {
  es: "El precio base está en pesos mexicanos",
  ru: "Базовая цена задана в мексиканских песо",
};

/** The monthly card's button, which has to name the same currency as the
 * figure above it — outside Mexico there is no method tab, so it is on
 * screen with nothing to tap first. */
const CARD_CTA: Record<string, (price: string) => string> = {
  es: (price) => `Empezar por ${price}/mes`,
  ru: (price) => `Начать за ${price}/мес.`,
};

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/pricing: a Singapore visitor is quoted the figure the checkout showed, and only it`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders(headers("SG"));
    await page.goto(`/${lang}/pricing`);

    const body = page.locator("body");
    const inSingapore = plain(await body.innerText());
    // A page that failed to render would pass every "does not contain"
    // below by having no text at all — PROGRESS.md 4.1.
    expect(inSingapore.length).toBeGreaterThan(500);

    for (const approx of EXPECTED.SG[lang]) {
      expect(inSingapore).toContain(approx);
    }

    // THE CHANGE OF 7.120, stated as a count rather than as a presence: the
    // peso figures are not gone from the page, they are down to exactly one
    // appearance each, in the footnote. A card that still carried a peso
    // line under its price would make each of these 2.
    for (const peso of PESOS) {
      expect(count(inSingapore, peso), `${peso} should appear once, in the footnote`).toBe(1);
    }
    expect(inSingapore).toContain(FOOTNOTE[lang]);

    // The button names the currency of the figure above it. This is the
    // assertion that would have failed on the old dictionary, where the CTA
    // said "$150 MXN/mes" under an SGD price.
    await expect(
      page.getByRole("button", { name: CARD_CTA[lang]("≈ 11,70 SGD"), exact: true }).first()
    ).toBeVisible();

    // The estimate is the PRICE now: measured against the footnote that
    // explains it, not against a peso figure that no longer sits beside it.
    const figureSize = await page
      .getByText(onCard(EXPECTED.SG[lang][0]), { exact: true })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const footnoteSize = await page
      .getByText(FOOTNOTE[lang], { exact: false })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(figureSize).toBeGreaterThan(footnoteSize * 1.5);

    // THE CONTROL. The same page, the header changed to MX, has to come
    // back DIFFERENT: pesos, no "≈", no footnote. Without this, every
    // assertion above could be passing against a page that shows the same
    // thing to everyone. A fresh URL, not reload(), for the WebKit reason
    // in the header comment.
    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}/pricing?control=in-mexico`);
    const inMexico = plain(await body.innerText());
    expect(inMexico).not.toBe(inSingapore);
    expect(inMexico).toContain("$150 MXN");
    expect(inMexico).not.toContain("SGD");
    expect(inMexico).not.toContain(FOOTNOTE[lang]);
    // And no orphaned asterisk: the marker exists to point at a footnote,
    // so a page without the footnote must not carry it either.
    expect(inMexico).not.toContain("$150 MXN*");
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
    await expect(
      page.getByRole("button", { name: CARD_CTA[lang](EXPECTED.AR[lang][0]), exact: true }).first()
    ).toBeVisible();

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
    // it showed before 08.09.2026, footnote included, since there is no
    // conversion to explain.
    await page.setExtraHTTPHeaders(headers("CU"));
    await page.goto(`/${lang}/pricing`);
    const unlisted = plain(await page.locator("body").innerText());
    expect(unlisted.length).toBeGreaterThan(500);
    expect(unlisted).toContain("$150 MXN");
    expect(unlisted).not.toContain(FOOTNOTE[lang]);
    await expect(
      page.getByRole("button", { name: CARD_CTA[lang]("$150 MXN"), exact: true }).first()
    ).toBeVisible();

    // Control: the very same browser, one country code changed, does get a
    // figure. Otherwise "no estimate" could just mean "the feature is off".
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}/pricing?control=listed`);
    const listed = plain(await page.locator("body").innerText());
    expect(listed).not.toBe(unlisted);
    expect(listed).toContain(EXPECTED.AR[lang][0]);
  });

  /**
   * THE RATE SOURCE IS DEAD, and the page is fine.
   *
   * Brazil is in the allowlist — a BRL figure is a promise this site is
   * willing to make — and BRL is deliberately absent from the fixture rate
   * table. That is the same null getPesoRate returns when open.er-api.com
   * refuses, times out, answers something that is not JSON, or answers
   * without our currency in it (src/lib/exchange-rates.ts): every failure
   * path in that module funnels into one value, and this exercises it
   * through the real render rather than through a stub.
   *
   * Two things are claimed, and the second is the one a unit test cannot
   * make: the page falls back to pesos whole, AND the layout it falls back
   * into is the same layout — the figure keeps the size it has when it is a
   * conversion, and nothing spills sideways out of the viewport.
   */
  test(`/${lang}/pricing: a dead rate feed shows pesos, and the page does not come apart`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("BR"));
    await page.goto(`/${lang}/pricing`);
    const noRate = plain(await page.locator("body").innerText());
    expect(noRate.length).toBeGreaterThan(500);

    for (const peso of PESOS) expect(noRate).toContain(peso);
    expect(noRate).not.toContain("BRL");
    expect(noRate).not.toContain("≈ ");
    expect(noRate).not.toContain(FOOTNOTE[lang]);
    await expect(
      page.getByRole("button", { name: CARD_CTA[lang]("$150 MXN"), exact: true }).first()
    ).toBeVisible();

    const geometry = async (figure: string) => ({
      fontSize: await page
        .getByText(figure, { exact: true })
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
    });

    const withoutRate = await geometry("$150 MXN");
    // No horizontal overflow: the page fits its own viewport, at whatever
    // width this project runs (chromium 1280, mobile-iphone 375).
    expect(withoutRate.overflow).toBeLessThanOrEqual(1);

    // The control, and the measurement that makes "the layout is fine"
    // mean something: the same card with a rate available. Same slot, same
    // type size — the fallback is not a smaller, differently-styled page.
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}/pricing?control=with-rate`);
    const withRate = await geometry(onCard(EXPECTED.AR[lang][0]));
    expect(plain(await page.locator("body").innerText())).not.toBe(noRate);
    expect(withoutRate.fontSize).toBe(withRate.fontSize);
    expect(withRate.overflow).toBeLessThanOrEqual(1);
  });

  test(`/${lang}: the front page's price strip carries the same figure`, async ({ page }) => {
    // The three figures are repeated on the front page, so they are
    // repeated in the same currency — a visitor who never opens /pricing
    // should not have to in order to find out what they are about to spend.
    await page.setExtraHTTPHeaders(headers("AR"));
    await page.goto(`/${lang}`);
    const inArgentina = plain(await page.locator("body").innerText());
    expect(inArgentina.length).toBeGreaterThan(500);
    for (const approx of EXPECTED.AR[lang]) {
      expect(inArgentina).toContain(approx);
    }
    expect(inArgentina).toContain(FOOTNOTE[lang]);
    for (const peso of PESOS) {
      expect(count(inArgentina, peso), `${peso} should appear once, in the footnote`).toBe(1);
    }

    // Explicitly MX, for the reason spelled out in the header comment.
    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}?control=in-mexico`);
    const inMexico = plain(await page.locator("body").innerText());
    expect(inMexico).not.toBe(inArgentina);
    expect(inMexico).not.toContain("ARS");
    expect(inMexico).not.toContain(FOOTNOTE[lang]);
    expect(inMexico).toContain("$150 MXN");
  });
}
