import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * A page must never be wider than the phone it is on.
 *
 * This is the guard for a whole class, not for one bug. The class: some
 * element deep in a page has an intrinsic width the layout can't shrink,
 * nothing above it bounds that width, and the document starts scrolling
 * sideways. Everything the owner then sees follows from that one fact and
 * looks like three separate defects — the sticky header slides off to the
 * left so text passes where it used to cover, the footer's right edge stops
 * at the viewport and reads as clipped, and the page rocks under the thumb.
 *
 * It has now happened twice, from two unrelated causes: the footer's
 * six-link row (29.08.2026, PROGRESS.md 7.46) and a 16-column word-search
 * board inside an unbounded wrapper (30.08.2026, 7.60). Between them
 * `scripts/check-layout-geometry.mjs` was written, and it did catch the
 * first — but it runs against a URL a person hands it, over the ten page
 * shapes listed inside it. The second bug lived on pages nobody had listed,
 * on production, for as long as that check was reporting `ok`. So the
 * measurement also moves into the suite that runs on every push.
 *
 * What is asserted is one number: documentElement.scrollWidth must not
 * exceed its clientWidth. Horizontal page scroll is never intentional in
 * this app — everything that genuinely scrolls sideways (the word deck, the
 * tab strips, the filter chips, the puzzle cards) does it inside its own
 * `overflow-x: auto` box, which does not widen the document.
 *
 * Each page is measured twice, at the top and after a scroll: a block that
 * only exists below the fold is exactly the kind of thing that widens a
 * document once it appears.
 */

// 360px: the narrowest width still common on Android, and the one where the
// word-search overflow measured worst (24px past the viewport, against 8px
// at 393). A page that fits here fits the iPhones too.
test.use({ viewport: { width: 360, height: 780 } });

/**
 * Page SHAPES — one per way a page in this app is built — restricted to
 * what exists in CI, whose database is created empty by `prisma db push`
 * and then given the fixtures in scripts/seed-e2e-fixture.mjs.
 *
 * `/word-games/WORD_SEARCH/C1/5` is the one that matters and is not here
 * for variety: it is the 16×16 fixture board, i.e. the exact intrinsic
 * width that overflowed on production. A grid that dense cannot shrink past
 * its 22px-per-column floor, so this page goes too wide the moment nothing
 * above the board bounds it again.
 */
const PATHS = [
  "",
  "/courses",
  "/courses/a1/1",
  "/pricing",
  "/profile",
  "/word-games/WORD_SEARCH/C1/5",
  "/glossary/caso-nominativo",
];

async function measure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const scrollsHorizontally = (el: Element) => {
      const o = getComputedStyle(el).overflowX;
      return o === "auto" || o === "scroll";
    };
    // A box that sticks out of a scroller by design is not the document's
    // problem — only an element with no horizontally scrollable ancestor
    // can widen the page.
    const insideAScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (scrollsHorizontally(p)) return true;
      }
      return false;
    };
    let widest: string | null = null;
    let worst = 1;
    for (const el of document.querySelectorAll("body *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const over = Math.round(Math.max(b.right - vw, -b.left));
      if (over <= worst || insideAScroller(el)) continue;
      worst = over;
      widest = `<${el.tagName.toLowerCase()} class="${String(el.className || "").slice(0, 80)}"> ${Math.round(
        b.width
      )}px at [${Math.round(b.left)}, ${Math.round(b.right)}]`;
    }
    return { vw, scrollWidth: de.scrollWidth, widest };
  });
}

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}: no page is wider than a 360px phone`, async ({ page }) => {
    // Premium, not standard: /word-games and C1 content are both gated
    // (see helpers/auth.ts), and a redirect to /pricing would measure the
    // pricing page twice instead of the puzzle board once — a check that
    // passes for the wrong reason.
    await loginWithSubscription(page, { tier: "premium" });

    const tooWide: string[] = [];
    for (const path of PATHS) {
      const url = `/${lang}${path}`;
      const response = await page.goto(url);
      // Several routes exist only on /es and answer 404 on /ru by design;
      // that is not a width problem. A 500 is, and quietly measuring an
      // error page instead of the real one is how a check comes to pass
      // for the wrong reason.
      const status = response?.status() ?? 0;
      if (status === 404) continue;
      expect(status, `${url} did not answer 200`).toBe(200);
      await page.waitForLoadState("networkidle");
      for (const scrollY of [0, 900]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(150);
        const m = await measure(page);
        if (m.scrollWidth > m.vw + 1) {
          tooWide.push(
            `${url} at scrollY=${scrollY}: document ${m.scrollWidth}px in a ${m.vw}px viewport` +
              (m.widest
                ? ` — widest offender ${m.widest}`
                : " — no single element to blame; check a parent's min-width")
          );
        }
      }
    }
    expect(tooWide, `pages wider than the viewport:\n${tooWide.join("\n")}`).toEqual([]);
  });
}
