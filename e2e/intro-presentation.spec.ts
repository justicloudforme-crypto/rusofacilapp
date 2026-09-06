import { test, expect } from "./helpers/test";
import { buildIntroSlides, introPdfPageCount } from "../src/lib/intro/content";
import { introStatsFrom, INTRO_STATIC_STATS } from "../src/lib/intro/stats";

/**
 * The introduction deck, on the two pages that serve it and in the file it
 * exports itself as.
 *
 * What this measures that nothing else could. `buildIntroSlides` is unit
 * tested and scripts/check-intro-numbers.ts proves no slide writes a
 * number by hand — both against the function. Neither of them opens the
 * page. Before this spec, "the deck renders at all" was checked by nobody:
 * /[lang]/courses had no e2e coverage, and /api/intro/pdf had none either,
 * even though it is the one route in the app that runs a PDF renderer at
 * request time and can fail on a font, a shape or a database read without
 * anything else noticing.
 *
 * The deck is pinned TWICE, and the second pin is the one that matters.
 *
 * The first draft of this spec built its expectation with
 * `buildIntroSlides` and compared it to the page. That is a consistency
 * check, not a count: deleting a slide from src/lib/intro/content.ts moved
 * BOTH sides down by one and the spec stayed green — measured, with a slide
 * actually removed and the app rebuilt, 05.09.2026. So the deck's identity
 * is also written down here, in order:
 *
 *   DECK — what the presentation is. Removing, adding, renaming or
 *   reordering a slide changes this list, in a diff, on purpose.
 *
 *   buildIntroSlides — what the code produces. Its ids must equal DECK,
 *   and its titles are what the page is then searched for, so the titles
 *   themselves are never retyped here and cannot drift.
 *
 * Do not edit DECK to make a run pass. Editing it is how the deck changes;
 * a red line here when you did not mean to change the deck is the finding.
 */
const DECK = [
  "intro-1-reach",
  "intro-2-doors",
  "intro-3-easier",
  "intro-4-alphabet",
  "intro-5-literature",
  "intro-6-typing",
  "intro-7-consistency",
  "intro-8-variety",
  "intro-9-inside",
  "intro-10-first-week",
] as const;

const EXPECTED_SLIDES = buildIntroSlides(introStatsFrom(null));
const EXPECTED_PDF_PAGES = introPdfPageCount(EXPECTED_SLIDES);

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/courses renders the whole deck, one dot per slide`, async ({ page }) => {
    const response = await page.goto(`/${lang}/courses`);
    expect(response?.status()).toBe(200);

    // The source still is the deck this spec describes.
    expect(EXPECTED_SLIDES.map((slide) => slide.id)).toEqual([...DECK]);

    // The pager dots are one <button> per slide, each labelled with that
    // slide's title — the only place in the DOM where the whole deck is
    // present at once (the card itself shows one slide at a time).
    const dots = page.getByRole("button", { name: EXPECTED_SLIDES[0].title, exact: true });
    await expect(dots).toHaveCount(1);
    for (const slide of EXPECTED_SLIDES) {
      await expect(
        page.getByRole("button", { name: slide.title, exact: true }),
        `no pager dot for "${slide.title}"`,
      ).toHaveCount(1);
    }

    // The deck is Spanish in both locales, by the same rule as the lesson
    // content — so the first slide's heading is the same string on /ru.
    await expect(page.getByRole("heading", { name: EXPECTED_SLIDES[0].title })).toBeVisible();

    // And a number that came from the data reached the rendered page. The
    // alphabet count is the one to assert here: it is static, so this
    // holds on a CI database seeded with the e2e fixture as well as on a
    // full one.
    await page.getByRole("button", { name: EXPECTED_SLIDES[3].title, exact: true }).click();
    await expect(page.getByRole("heading", { name: EXPECTED_SLIDES[3].title })).toBeVisible();
    await expect(page.getByText(`${INTRO_STATIC_STATS.alphabetLetters} letras`, { exact: false }).first()).toBeVisible();

    // The last slide is reachable, and reaching it is what opens the level
    // picker — the one decision this presentation asks for.
    await page.getByRole("button", { name: EXPECTED_SLIDES[EXPECTED_SLIDES.length - 1].title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: EXPECTED_SLIDES[EXPECTED_SLIDES.length - 1].title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /A1/ }).first()).toBeVisible();
  });
}

test("/api/intro/pdf answers 200 with one page per slide plus the cover", async ({ request }) => {
  const response = await request.get("/api/intro/pdf");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");

  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // Page objects, counted from the document itself: `/Type /Page` with no
  // `s` after it, so the single `/Type /Pages` node is not counted as an
  // eleventh page.
  const pdf = body.toString("latin1");
  const pages = [...pdf.matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
  expect(EXPECTED_SLIDES.map((slide) => slide.id)).toEqual([...DECK]);
  expect(pages, `${DECK.length} slides plus one cover`).toBe(DECK.length + 1);
  expect(EXPECTED_PDF_PAGES).toBe(DECK.length + 1);
});
