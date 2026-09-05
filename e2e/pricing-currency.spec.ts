import { test, expect } from "./helpers/test";

/**
 * What a visitor's browser actually paints on /pricing carries no dollar
 * figure — in either locale.
 *
 * This is the browser half of src/lib/pricing-currency.test.ts. That test
 * reads the dictionaries and the /pricing source, which is where every price
 * string is written; this one reads the rendered page, which is the thing the
 * claim is actually about. They can disagree — a price could arrive from
 * somewhere neither the dictionary nor the pricing components own — and that
 * disagreement is the whole reason both exist.
 *
 * The rule, restated here rather than imported: a Playwright spec and a
 * Vitest suite do not share a module graph in this repo, and a shared helper
 * that both had to reach through would be a third place to keep in step.
 * Ten lines, duplicated on purpose, with the sibling named above.
 *
 *   1. the three letters USD do not appear;
 *   2. every `$` followed by a digit is followed by `MXN`.
 *
 * Rule 2 is the one that matters: the peso is written with the same `$` as
 * the dollar, so "$150" alone tells a reader nothing (PROGRESS.md 7.116).
 */
function unmarkedMoney(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\$\s?\d[\d.,]*/g)) {
    const after = text.slice(match.index + match[0].length);
    if (!/^\s*MXN\b/.test(after)) found.push(match[0]);
  }
  return found;
}

const CARD_TAB: Record<string, string> = { es: "Tarjeta", ru: "Карта" };

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/pricing shows prices in pesos and no dollar figure`, async ({ page }) => {
    await page.goto(`/${lang}/pricing`);

    const body = page.locator("body");
    await expect(body).toBeVisible();

    async function pageText(): Promise<string> {
      // Narrow no-break space to an ordinary one so the money regex, which
      // is written with plain spaces, sees what a reader sees.
      return (await body.innerText()).replace(/\u00a0|\u202f/g, " ");
    }

    const asShown = await pageText();

    // The scan must have something to scan. A page that failed to render
    // would otherwise pass every assertion below by having no text at all —
    // the empty-input trap of PROGRESS.md 4.1.
    expect(asShown.length).toBeGreaterThan(500);
    expect(asShown).toContain("$150 MXN");
    expect(asShown).toContain("$899 MXN");
    expect(asShown).toContain("$2,299 MXN");

    // THE HALF THAT WAS NEARLY MISSED. Every paid card opens on its "cash"
    // tab, so the card CTA — one of the three strings that carries a price —
    // is not in the DOM at all until the tab is switched. A first version of
    // this spec scanned only the default view and passed with "$7.99/mes"
    // planted in es.json: the string was in the dictionary, in the bundle,
    // and one tap away from a buyer, and the browser check said clean.
    // Both views are scanned, and the assertion below proves the second one
    // actually reached different text.
    const cardTabs = page.getByRole("tab", { name: CARD_TAB[lang], exact: true });
    await expect(cardTabs).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) await cardTabs.nth(i).click();
    const withCardCtas = await pageText();
    expect(withCardCtas).not.toBe(asShown);

    for (const text of [asShown, withCardCtas]) {
      expect(text).not.toContain("USD");
      expect(unmarkedMoney(text)).toEqual([]);
    }

    // Positive control on the detector itself, run against this page's own
    // text with one dollar figure planted in it. Without this, "0 offenders"
    // could equally mean the regex never matches anything.
    expect(unmarkedMoney(`${withCardCtas}\nEmpezar por $7.99/mes`)).toEqual(["$7.99"]);
  });
}
