import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * DEBT 46: the paywall modal, opened by a browser (PROGRESS.md 7.122).
 *
 * WHY IT WAS OPEN. 7.120 moved the modal onto the shared price module along
 * with /pricing and the front page, and said so plainly: the modal was
 * checked by the build and the type-checker and by nothing else, because no
 * e2e opened it — that needs a signed-in visitor AND content they are not
 * entitled to. So "one figure, in the visitor's own currency, plus the
 * footnote at the foot of the modal" held on the module being shared, not
 * on anything measured. A rendered-surface check sees only the state the
 * interface is in (7.116): what is not open does not exist for it.
 *
 * WHAT IS MEASURED. The modal's three figures are read out of the open
 * dialog and each is required to appear, as the WHOLE text of an element,
 * on /pricing for the SAME country. Not "both look converted", not "both
 * mention EUR" — the same string, character for character. That is the only
 * claim that fails when one surface drifts to a different rounding, a
 * different currency or a stale literal.
 *
 * HOW IT IS OPENED. A signed-in visitor with no subscription, on
 * /word-games, tapping a Premium-only rung: the tile is a Link whose
 * onClick cancels navigation and calls openPaywall("premium"). Which rung
 * that is differs between dev.db (WORD_SEARCH A1 from 134) and the CI
 * fixture (WORD_SEARCH A1/2), so it is never named by number here — the
 * tile carries data-locked, which is exactly the "does this navigate or
 * does it open the paywall" distinction, and the glyph is not: a Premium
 * subscriber sees the same ★/👑 on a tile that opens.
 *
 * The country arrives as `x-vercel-ip-country`; there is no Vercel edge in
 * front of `next start`, so here it is the test saying where the buyer is.
 * Mexico is always sent EXPLICITLY — an absent header is the different rule
 * "we do not know where you are", and a control written the absent way
 * missed a planted defect 8 times out of 8 in 7.118.
 */

function headers(country: string): Record<string, string> {
  return { "x-forwarded-for": "10.123.0.1", "x-vercel-ip-country": country };
}

/** Opens the paywall from a locked word-game rung and returns the three
 * figures it shows, top to bottom. */
async function figuresInPaywall(page: Page, lang: string): Promise<string[]> {
  await page.goto(`/${lang}/word-games`);
  const locked = page.locator('a[data-locked="true"]').first();
  // If this ever fails, the database this run points at has no
  // Premium-only rung at all — which would make every assertion below
  // vacuous rather than passing.
  await expect(locked, "a Premium-only rung exists to tap").toBeVisible();
  await locked.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const figures = await dialog.locator("[data-plan-price]").allTextContents();
  expect(figures, "three plans in the modal").toHaveLength(3);
  return figures;
}

/** The ISO code every figure in that country has to carry. MX is the peso
 * base price, written by formatMoney as "$150 MXN". */
const EXPECTED_CURRENCY: Record<string, string> = { MX: "MXN", ES: "EUR", AR: "ARS" };

for (const lang of ["es", "ru"] as const) {
  for (const country of ["MX", "ES", "AR"] as const) {
    test(`/${lang} paywall from ${country}: the modal quotes what /pricing quotes`, async ({ page }) => {
      await loginWithoutSubscription(page);
      await page.setExtraHTTPHeaders(headers(country));

      const figures = await figuresInPaywall(page, lang);
      for (const figure of figures) {
        expect(figure, `${country}: the modal's figure is in the visitor's currency`).toContain(
          EXPECTED_CURRENCY[country]
        );
      }
      // Three plans, three amounts — a modal repeating one price three
      // times would satisfy every comparison below.
      expect(new Set(figures).size).toBe(3);

      // The footnote belongs to the modal itself, because the modal is the
      // whole surface a reader can see while it is open (7.120) — and it is
      // there if and only if the figures above are conversions.
      const dialogText = await page.getByRole("dialog").innerText();
      const footnote = lang === "ru" ? "Базовая цена задана" : "El precio base está";
      if (country === "MX") {
        expect(dialogText).not.toContain(footnote);
        // No orphaned asterisk either: the marker exists to lead to a
        // footnote, and there is none here.
        for (const figure of figures) expect(figure.endsWith("*")).toBe(false);
      } else {
        expect(dialogText).toContain(footnote);
        for (const figure of figures) expect(figure.endsWith("*")).toBe(true);
      }

      // THE CLAIM. Each figure from the modal is on /pricing for the same
      // country, as the whole text of an element.
      await page.goto(`/${lang}/pricing`);
      for (const figure of figures) {
        await expect(
          page.getByText(figure, { exact: true }).first(),
          `"${figure}" from the paywall is on /pricing in ${country}`
        ).toBeVisible();
      }
    });
  }

  /**
   * THE CONTROL. Every assertion above is made about one country at a time,
   * and all of them would pass on a modal that showed the same three
   * strings to everyone — which is precisely what the modal did before
   * 09.09.2026. Two countries, one browser, one session: the figures must
   * differ.
   *
   * A fresh URL rather than page.reload(): WebKit answered a reload from
   * its own cache and handed a control back a byte-identical page (7.117).
   */
  test(`/${lang} paywall: the modal follows the country, not the session`, async ({ page }) => {
    await loginWithoutSubscription(page);

    await page.setExtraHTTPHeaders(headers("AR"));
    const inArgentina = await figuresInPaywall(page, lang);

    await page.setExtraHTTPHeaders(headers("MX"));
    const inMexico = await figuresInPaywall(page, lang);

    expect(inMexico).not.toEqual(inArgentina);
    expect(inMexico.every((figure) => figure.includes("MXN"))).toBe(true);
    expect(inArgentina.every((figure) => figure.includes("ARS"))).toBe(true);
    // And the Mexican set is the base price itself, not merely "something
    // with MXN in it".
    expect(inMexico).toContain("$150 MXN");
  });
}
