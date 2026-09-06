import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * The introduction deck at phone widths: what the card cuts off, and how
 * big the things you have to hit are.
 *
 * WHY THIS SPEC EXISTS AND WHAT IT MEASURES THAT NOTHING ELSE DOES.
 * `npm run check:layout` has three measurements — the document is wider
 * than the viewport, a fixed panel hides what is under it, and content
 * narrower than 70% of a container wider than 700px. The defect this spec
 * pins is none of the three: at 320px the slide card's own header row did
 * not fit, and because the card carries `overflow-hidden` the page did NOT
 * grow a horizontal scrollbar — it simply cut 40px off the brand plate
 * (measured on production, 06.09.2026, PROGRESS.md 7.130). Clipping inside
 * an element is invisible to every check the project had.
 *
 * So the assertion is not "the page does not scroll sideways". It is:
 *   1. no descendant of the card reaches past the card's own right edge;
 *   2. every clickable element of the deck is at least 44×44, the
 *      project's minimum touch target (CLAUDE.md).
 *
 * The widths are the five real ones — 320 (the narrowest phone still in
 * use), 360, 375, 390, 393 — and not a range, because the failure was
 * width-specific: at 375 the same deck clipped 0px.
 *
 * The pager dots are the reason (2) is not free. Ten dots at 44px need
 * 440px and a phone gives 320–393, so the strip wraps; a run that starts
 * failing here after somebody puts the row back on one line is this spec
 * doing its job, not flaking.
 */
const WIDTHS = [320, 360, 375, 390, 393] as const;
const MIN_TAP = 44;

/** Sizes of everything clickable inside the deck, with a readable name. */
async function deckTargets(page: Page): Promise<{ name: string; w: number; h: number }[]> {
  return page.evaluate(() => {
    const deck = document.querySelector('[data-testid="intro-presentation"]');
    if (!deck) throw new Error('no [data-testid="intro-presentation"] on the page');
    const out: { name: string; w: number; h: number }[] = [];
    for (const el of deck.querySelectorAll("a, button")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      out.push({
        name: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`,
        w: Math.round(box.width * 10) / 10,
        h: Math.round(box.height * 10) / 10,
      });
    }
    return out;
  });
}

/** How many pixels the card cuts off its own content on the right. */
async function clippedPx(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="intro-slide-card"]');
    if (!card) throw new Error('no [data-testid="intro-slide-card"] on the page');
    const cardBox = card.getBoundingClientRect();
    let worst = 0;
    for (const el of card.querySelectorAll("*")) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      worst = Math.max(worst, box.right - cardBox.right);
    }
    return Math.round(worst);
  });
}

for (const lang of ["es", "ru"] as const) {
  for (const width of WIDTHS) {
    test(`/${lang}/courses at ${width}px: the slide card cuts nothing off`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      const response = await page.goto(`/${lang}/courses`);
      expect(response?.status()).toBe(200);
      await page.locator('[data-testid="intro-slide-card"]').waitFor();

      expect(await clippedPx(page), `slide card clips its own content at ${width}px`).toBeLessThanOrEqual(0);

      // The document itself must still not scroll sideways — the property
      // `overflow-hidden` was hiding, and the one check:layout does own.
      const doc = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(doc).toBeLessThanOrEqual(width);
    });

    test(`/${lang}/courses at ${width}px: every deck control is at least 44×44`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto(`/${lang}/courses`);
      await page.locator('[data-testid="intro-presentation"]').waitFor();

      // Both states of the deck are measured: the first slide, and the last
      // one, which is the only slide that shows the four level tiles.
      const dots = page.getByTestId("intro-dot");
      const total = await dots.count();
      expect(total).toBeGreaterThan(1);

      for (const at of [0, total - 1]) {
        await dots.nth(at).click();
        await page.waitForTimeout(150);
        const small = (await deckTargets(page)).filter((t) => t.w < MIN_TAP || t.h < MIN_TAP);
        expect(small, `too small on slide ${at + 1}: ${small.map((t) => `${t.name} ${t.w}×${t.h}`).join("; ")}`).toEqual([]);
      }
    });
  }
}
