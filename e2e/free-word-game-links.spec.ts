import { test, expect } from "./helpers/test";

/**
 * The free puzzles must be reachable by a LINK, not only by a sitemap
 * entry — and by a link that exists without JavaScript.
 *
 * Measured on production 02.09.2026 over all 1906 sitemap URLs: 78 of the
 * 160 free puzzle URLs had zero inbound links from any crawlable page.
 * They were in the sitemap (160/160), allowed by robots.txt (160/160) and
 * served a playable board to an anonymous visitor (160/160) — and Search
 * Console still reported "no referring page" for them, because the hub
 * renders its ladder through a client component whose grid follows React
 * state, so the server emitted links for one (type, level) pair only.
 *
 * Anonymous on purpose: this is the surface a crawler sees, and the rest
 * of word-games.spec.ts signs in before every test.
 */
test.use({ javaScriptEnabled: false });

const PUZZLE_HREF = /\/(es|ru)\/word-games\/(WORD_SEARCH|CROSSWORD)\/(A1|A2|B1|B2|C1)\/(\d+)$/;

async function puzzleLinks(page: import("@playwright/test").Page, within: string) {
  const hrefs = await page.locator(`${within} a`).evaluateAll((els) =>
    els.map((el) => new URL((el as HTMLAnchorElement).href).pathname),
  );
  return hrefs.filter((h) => PUZZLE_HREF.test(h));
}

for (const lang of ["es", "ru"] as const) {
  test(`${lang}: the hub links free puzzles with no JavaScript, past the picker's initial tab`, async ({ page }) => {
    await page.goto(`/${lang}/word-games`);

    const section = "section:has(h2)";
    const indexed = await puzzleLinks(page, section);
    expect(indexed.length).toBeGreaterThan(0);

    // Every link the index emits is genuinely free — the same rule the
    // paywall, robots.ts and sitemap.ts read. A link to a locked rung
    // would send a crawler to a 307 into /pricing.
    for (const href of indexed) {
      const [, , , level, sequence] = PUZZLE_HREF.exec(href)!;
      expect(level, href).not.toBe("C1");
      expect(Number(sequence), href).toBeLessThanOrEqual(10);
    }

    // The point of the section: it covers ladders the picker's initial tab
    // (WORD_SEARCH / A1) does not. Without it, everything below was the
    // only thing a crawler could see.
    const pairs = new Set(indexed.map((h) => h.split("/").slice(3, 5).join("/")));
    expect([...pairs].some((p) => p !== "WORD_SEARCH/A1")).toBe(true);

    // Positive control, on the same page: the picker's own server-rendered
    // grid must be visibly narrower than the index. If this ever stops
    // being true the test above has stopped measuring what it claims to.
    const pickerLinks = await puzzleLinks(page, "div:has(> div.grid)");
    const pickerPairs = new Set(pickerLinks.map((h) => h.split("/").slice(3, 5).join("/")));
    expect(pickerPairs.size).toBeLessThanOrEqual(pairs.size);
  });

  test(`${lang}: every free puzzle the hub links opens for a signed-out visitor`, async ({ page }) => {
    await page.goto(`/${lang}/word-games`);
    const indexed = await puzzleLinks(page, "section:has(h2)");
    // Locally the bank holds all 80; in CI the fixture holds a handful.
    // Sampling keeps the run bounded without ever sampling nothing.
    const sample = indexed.filter((_, i) => i % 13 === 0).slice(0, 6);
    expect(sample.length).toBeGreaterThan(0);
    for (const href of sample) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBe(200);
      expect(new URL(page.url()).pathname, `${href} must not bounce to the paywall`).toBe(href);
      await expect(page.locator("h1")).toBeVisible();
    }
  });
}
