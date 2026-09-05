import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * Who is offered cash, in the browser.
 *
 * OXXO is a shop in Mexico. Until 07.09.2026 the cash tab was not merely
 * offered everywhere — it was the tab every paid card OPENED on, in every
 * country, and the page also promised OXXO in its caption and its FAQ
 * (PROGRESS.md 7.115, 7.117). Since 10.09.2026 it does not open even in
 * Mexico: the card is the default there too, and cash is a tab that has to
 * be tapped — but a tab that stayed exactly as big and as findable as it
 * was (PROGRESS.md 7.121, measured in the first test below).
 *
 * The rule this spec is written under comes from 7.116, where a browser
 * check said "clean" about a page carrying a planted dollar price: a
 * rendered-surface check sees ONLY the state the interface is in. Anything
 * behind a tab does not exist for it. So every claim here is made about two
 * snapshots — one before a switch and one after — and each pair is required
 * to DIFFER, or the switch could have silently done nothing and the check
 * would be measuring the same screen twice.
 *
 * The country arrives as `x-vercel-ip-country`, which Vercel attaches at
 * the edge and overwrites if a client sends its own (measured 07.09.2026,
 * see src/lib/country.ts). There is no edge in front of `next start`, so
 * here the header is simply the test's way of saying where the buyer is —
 * and its ABSENCE is what a Mexican visitor gets, since off a deployment
 * "unknown" means Mexico by design.
 */

const CASH_TAB: Record<string, string> = { es: "Efectivo", ru: "Наличные" };
const CARD_TAB: Record<string, string> = { es: "Tarjeta", ru: "Карта" };
const CASH_STEPS: Record<string, string> = { es: "Cómo pagar en efectivo", ru: "Как оплатить наличными" };
const CASH_CTA: Record<string, string> = { es: "Pagar en efectivo — $150 MXN", ru: "Оплатить наличными — $150 MXN" };
/** The card CTA now carries whatever figure the card shows, so it depends
 * on where the buyer is (PROGRESS.md 7.120). In Mexico that is pesos; in
 * Spain it is the euro estimate this suite's fixed rate table produces —
 * 150 MXN x 0.050958 x 1.04 = 7.9494 -> 7,95 EUR (playwright.config.ts,
 * FX_RATES_MXN). The button naming the same currency as the price above it
 * is the point, so it is asserted here rather than pinned to pesos. */
const CARD_CTA_MX: Record<string, string> = { es: "Empezar por $150 MXN/mes", ru: "Начать за $150 MXN/мес." };
const CARD_CTA_ES: Record<string, string> = {
  es: "Empezar por ≈ 7,95 EUR/mes",
  ru: "Начать за ≈ 7,95 EUR/мес.",
};
const CASH_CAPTION: Record<string, string> = { es: "efectivo OXXO", ru: "наличные OXXO" };
const CARD_ONLY_CAPTION: Record<string, string> = {
  es: "Aceptamos tarjetas de crédito y débito",
  ru: "Принимаем кредитные и дебетовые карты",
};
const OXXO_QUESTION: Record<string, string> = {
  es: "¿Qué pasa si no pago el código OXXO a tiempo?",
  ru: "Что если не оплатить штрихкод OXXO вовремя?",
};

/** The fixture sets `x-forwarded-for` per test so the rate limiters see
 * separate clients; page-level headers REPLACE the context's, so anything
 * set here has to carry its own address. */
function headers(country?: string): Record<string, string> {
  return {
    "x-forwarded-for": "10.117.0.1",
    ...(country ? { "x-vercel-ip-country": country } : {}),
  };
}

/** The rendered DOM with every <script> removed.
 *
 * `page.content()` is NOT usable for "this text is not on the page": the
 * OXXO strings are props of a client component, so React's own flight
 * payload carries all of them inside a <script> whether the block is
 * rendered or not — measured 10.09.2026, it is why the first draft of this
 * check failed on a correct page. What a reader, a screen reader or a
 * Ctrl+F can reach is the element tree, so that is what is asked. */
async function domHtml(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script").forEach((node) => node.remove());
    return clone.innerHTML;
  });
}

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/pricing: a Mexican visitor gets the CARD first, and cash is one tap away and no smaller for it`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders(headers("MX"));
    await page.goto(`/${lang}/pricing`);

    const body = page.locator("body");
    const asShown = await body.innerText();
    // A page that failed to render passes every "does not contain" below by
    // having no text at all — PROGRESS.md 4.1.
    expect(asShown.length).toBeGreaterThan(500);

    // What the page opens on, since 10.09.2026: the card CTA, on all three
    // paid cards, with nothing to tap first.
    expect(asShown).toContain(CARD_CTA_MX[lang]);
    await expect(page.getByRole("button", { name: CARD_CTA_MX[lang], exact: true })).toBeVisible();

    // And the four steps about walking to a shop are not merely unpainted —
    // they are NOT IN THE DOM. innerText would report the same for a block
    // that is present and hidden, and a screen-reader or a Ctrl+F would not.
    expect(asShown).not.toContain(CASH_STEPS[lang]);
    expect(asShown).not.toContain(CASH_CTA[lang]);
    expect(await domHtml(page)).not.toContain(CASH_STEPS[lang]);
    await expect(page.getByText(CASH_STEPS[lang])).toHaveCount(0);

    // The tab itself is untouched by any of that: still there, three times,
    // one per paid card.
    const cashTabs = page.getByRole("tab", { name: CASH_TAB[lang], exact: true });
    const cardTabs = page.getByRole("tab", { name: CARD_TAB[lang], exact: true });
    await expect(cashTabs).toHaveCount(3);
    await expect(cardTabs).toHaveCount(3);
    await expect(cashTabs.first()).toBeVisible();
    await expect(cashTabs.first()).toBeEnabled();
    // aria-selected is the machine-readable half of "the card is what is
    // open": a sighted user sees the filled pill, everyone else reads this.
    await expect(cardTabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(cashTabs.first()).toHaveAttribute("aria-selected", "false");

    // HOW VISIBLE the unselected cash tab is, measured rather than argued.
    // The change was meant to move what OPENS, not to shrink the tab, so:
    // it is a full 44px touch target, it is not a sliver next to the card
    // tab, and it carries a glyph — a mark that survives losing the fill,
    // for a tab that no longer has colour to announce it. See
    // src/components/pricing/PaymentMethodTabs.tsx.
    const cashBoxBefore = (await cashTabs.first().boundingBox())!;
    const cardBox = (await cardTabs.first().boundingBox())!;
    expect(cashBoxBefore.height).toBeGreaterThanOrEqual(44);
    expect(cashBoxBefore.width).toBeGreaterThan(cardBox.width * 0.8);
    expect(await cashTabs.first().locator("svg").count()).toBe(1);

    for (let i = 0; i < 3; i += 1) await cashTabs.nth(i).click();
    const onCash = await body.innerText();

    // The switch has to have changed something, or both snapshots are the
    // same screen and the assertions are worth nothing.
    expect(onCash).not.toBe(asShown);
    expect(onCash).toContain(CASH_STEPS[lang]);
    expect(onCash).toContain(CASH_CTA[lang]);
    expect(onCash).not.toContain(CARD_CTA_MX[lang]);
    await expect(cashTabs.first()).toHaveAttribute("aria-selected", "true");

    // ...and being selected did not change the tab's size either, which is
    // the other half of "as visible as before": the box a Mexican buyer had
    // to hit when cash was the default is the box they have now.
    const cashBoxAfter = (await cashTabs.first().boundingBox())!;
    expect(Math.abs(cashBoxAfter.width - cashBoxBefore.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(cashBoxAfter.height - cashBoxBefore.height)).toBeLessThanOrEqual(1);

    // And back: the card tab still works from the cash state, so this is a
    // switch and not a one-way door.
    for (let i = 0; i < 3; i += 1) await cardTabs.nth(i).click();
    const backOnCard = await body.innerText();
    expect(backOnCard).not.toBe(onCash);
    expect(backOnCard).toContain(CARD_CTA_MX[lang]);
    expect(await domHtml(page)).not.toContain(CASH_STEPS[lang]);
  });

  test(`/${lang}/pricing: outside Mexico there is no cash anywhere on the page`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("ES"));
    await page.goto(`/${lang}/pricing`);

    const body = page.locator("body");
    const outsideMexico = await body.innerText();
    expect(outsideMexico.length).toBeGreaterThan(500);

    // The card CTA is on screen with nothing to tap first — the whole point
    // of the change, and the assertion a hidden-behind-a-tab check would
    // have missed.
    expect(outsideMexico).toContain(CARD_CTA_ES[lang]);
    await expect(page.getByRole("button", { name: CARD_CTA_ES[lang], exact: true })).toBeVisible();

    // No tab strip at all: not cash-behind-a-tap, no method choice.
    await expect(page.getByRole("tab")).toHaveCount(0);
    expect(outsideMexico).not.toContain(CASH_STEPS[lang]);
    expect(outsideMexico).not.toContain(CASH_CTA[lang]);
    expect(outsideMexico).not.toContain(CASH_CAPTION[lang]);
    expect(outsideMexico).toContain(CARD_ONLY_CAPTION[lang]);
    // Four questions, not five: the OXXO-expiry one is gone with the method.
    expect(outsideMexico).not.toContain(OXXO_QUESTION[lang]);
    await expect(page.locator("details")).toHaveCount(4);
    // Only one word of the FAQ text changes with the method, and it is the
    // auto-renewal answer — it must no longer name OXXO. <details> is
    // closed, so the answer has to be read from the DOM rather than from
    // what is painted.
    const answers = await page.locator("details p").allTextContents();
    expect(answers.join("\n")).not.toContain("OXXO");

    // THE CONTROL, and the reason this test is not simply "the page has no
    // cash on it": the same page, same browser, one header removed, has to
    // come back DIFFERENT and full of cash. Without it every "not.toContain"
    // above would pass just as happily against a page that rendered nothing
    // at all, or against a selector that stopped matching.
    await page.setExtraHTTPHeaders(headers());
    // A fresh URL, not reload(): WebKit answered the reload from its own
    // cache, and the control came back byte-identical to the page it was
    // supposed to differ from — which is the control catching itself, and
    // the reason it is written as "these two must differ" rather than
    // "this one has cash in it". The query string is ignored by the page.
    await page.goto(`/${lang}/pricing?control=in-mexico`);
    const inMexico = await body.innerText();
    expect(inMexico).not.toBe(outsideMexico);
    // The control asks for the TAB, not for the instructions: since
    // 10.09.2026 the instructions are behind that tab even in Mexico
    // (PROGRESS.md 7.121), so demanding them here would be demanding the
    // old default back.
    await expect(page.getByRole("tab", { name: CASH_TAB[lang], exact: true })).toHaveCount(3);
    expect(inMexico).toContain(CASH_CAPTION[lang]);
    await expect(page.locator("details")).toHaveCount(5);
  });
}

/**
 * The front page makes the same promise in one word — a trust tile reading
 * "OXXO / Pago en efectivo" — and it was made to every country too. Same
 * rule, same header, and the same two-snapshot shape: the claim is not "the
 * page has no OXXO on it" but "these two renders differ, and only one of
 * them says OXXO".
 */
for (const lang of ["es", "ru"] as const) {
  test(`/${lang}: the OXXO trust tile is shown in Mexico and nowhere else`, async ({ page }) => {
    await page.setExtraHTTPHeaders(headers("ES"));
    await page.goto(`/${lang}`);
    const outsideMexico = await page.locator("body").innerText();
    expect(outsideMexico.length).toBeGreaterThan(500);
    expect(outsideMexico).not.toContain("OXXO");

    await page.setExtraHTTPHeaders(headers());
    await page.goto(`/${lang}?control=in-mexico`);
    const inMexico = await page.locator("body").innerText();
    expect(inMexico).not.toBe(outsideMexico);
    expect(inMexico).toContain("OXXO");
  });
}
