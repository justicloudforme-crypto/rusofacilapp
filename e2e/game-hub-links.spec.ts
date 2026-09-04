import { test, expect } from "./helpers/test";

/**
 * The games have one entry page, and no game page is a dead end.
 *
 * Measured on production 04.09.2026, crawling all 1906 sitemap URLs plus
 * six public pages that are not in it, taking links from the RENDERED HTML
 * of each page (PROGRESS.md 7.93's method, including its lesson that the
 * filter must not be a substring of the path):
 *
 *   /es/juegos-para-aprender-ruso        6 inbound, all from themed landings
 *   /es/crucigramas-ruso-principiantes   1 inbound
 *   /es/sopa-de-letras-alfabeto-cirilico 2 inbound
 *   each /es/sopa-de-letras-ruso-<tema>  1 inbound
 *   the 160 free puzzle URLs             0 edges BETWEEN them
 *
 * The header renders four links and the footer six, and neither set
 * contains a game page — so nothing pointed down into the games from the
 * pages people actually land on.
 *
 * Anonymous and with JavaScript off on purpose: that is the crawler's
 * surface, and it is also the surface a visitor gets before hydration.
 */
test.use({ javaScriptEnabled: false });

const PUZZLE_HREF = /^\/(es|ru)\/word-games\/(WORD_SEARCH|CROSSWORD)\/(A1|A2|B1|B2|C1)\/(\d+)$/;

/** The Spanish game pages, the same four GameLandingLinks knows about
 * plus the six themed boards and the catalogue. */
const GAME_PAGES = [
  "/es/juegos-para-aprender-ruso",
  "/es/sopa-de-letras-ruso",
  "/es/crucigramas-ruso-principiantes",
  "/es/sopa-de-letras-alfabeto-cirilico",
  "/es/sopa-de-letras-ruso-comida",
  "/es/sopa-de-letras-ruso-ropa",
  "/es/sopa-de-letras-ruso-ciudad",
  "/es/sopa-de-letras-ruso-familia",
  "/es/sopa-de-letras-ruso-clima",
  "/es/sopa-de-letras-ruso-compras",
  "/es/word-games",
];

async function paths(page: import("@playwright/test").Page) {
  return page
    .locator("a")
    .evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname));
}

const puzzlesOf = (hrefs: string[]) => hrefs.filter((h) => PUZZLE_HREF.test(h));

test("es: the hub serves the whole free sample and both game types with no JavaScript", async ({ page }) => {
  await page.goto("/es/juegos-para-aprender-ruso");
  const hub = await paths(page);
  const hubPuzzles = puzzlesOf(hub);

  // Both types, which is the point: before 04.09.2026 this page carried no
  // puzzle link of any kind, so a crawler arriving on the query it is
  // written for found three cards and nothing to crawl.
  expect(hubPuzzles.some((h) => h.includes("/CROSSWORD/"))).toBe(true);
  expect(hubPuzzles.some((h) => h.includes("/WORD_SEARCH/"))).toBe(true);

  // Every puzzle it names is genuinely free — a link to a locked rung
  // would be a 307 into /pricing handed to a crawler on purpose.
  for (const href of hubPuzzles) {
    const [, , , level, sequence] = PUZZLE_HREF.exec(href)!;
    expect(level, href).not.toBe("C1");
    expect(Number(sequence), href).toBeLessThanOrEqual(10);
  }

  // The same set the catalogue's own server-rendered index emits: one rule
  // (isFreeWordGamePuzzle), one bank, two pages.
  await page.goto("/es/word-games");
  const catalogue = puzzlesOf(await paths(page));
  const indexed = new Set(catalogue.filter((h) => Number(PUZZLE_HREF.exec(h)![4]) <= 10 && !h.includes("/C1/")));
  expect(new Set(hubPuzzles)).toEqual(indexed);

  // Positive control for the extractor itself: run it on a page that has
  // no puzzle links at all. If this ever returns something, the counts
  // above are measuring the chrome, not the page.
  await page.goto("/es/terms");
  expect(puzzlesOf(await paths(page))).toHaveLength(0);
});

test("es: no Spanish game page is a dead end", async ({ page }) => {
  // Only pages that actually render are measured. Locally the bank holds
  // every puzzle these pages embed and all eleven answer 200; the CI
  // fixture holds four rows, so the pages that embed a specific puzzle
  // 404 there. Asserting a status per page would make this test a
  // statement about the fixture; asserting the SHAPE OF THE GRAPH over
  // whatever rendered is a statement about the linking, which is what it
  // is for. The two pages that depend on no particular puzzle are
  // required to be there, so the graph can never be empty.
  const outgoing = new Map<string, string[]>();
  for (const path of GAME_PAGES) {
    const response = await page.goto(path);
    if (response?.status() !== 200) continue;
    const links = await paths(page);
    outgoing.set(
      path,
      GAME_PAGES.filter((other) => other !== path && links.includes(other)),
    );
  }
  expect([...outgoing.keys()]).toEqual(
    expect.arrayContaining(["/es/juegos-para-aprender-ruso", "/es/word-games"]),
  );

  // 1. No dead end: every page that rendered points at another game page.
  for (const [path, others] of outgoing) {
    expect(others.length, `${path} links to no other game page`).toBeGreaterThanOrEqual(1);
  }

  // 2. No orphan: every game page, including the ones that could not
  //    render here, is linked from at least one page that did.
  for (const path of GAME_PAGES) {
    const inbound = [...outgoing].filter(([from, others]) => from !== path && others.includes(path));
    expect(inbound.length, `nothing links to ${path}`).toBeGreaterThanOrEqual(1);
  }

  // Positive control, same measurement on a page that is deliberately not
  // part of the games: it must come out empty, otherwise "links to
  // another game page" is being satisfied by the shared header and footer.
  await page.goto("/es/terms");
  const control = await paths(page);
  expect(GAME_PAGES.filter((p) => control.includes(p))).toHaveLength(0);
});

for (const lang of ["es", "ru"] as const) {
  test(`${lang}: a free puzzle links its neighbour rungs and never past the free ladder`, async ({ page }) => {
    await page.goto(`/${lang}/word-games`);
    // Deduplicated: the catalogue renders the picker's own grid AND the
    // free index, so every free rung appears twice in the HTML.
    const ladder = [
      ...new Set(
        puzzlesOf(await paths(page))
          .filter((h) => h.includes("/WORD_SEARCH/A1/"))
          .map((h) => Number(PUZZLE_HREF.exec(h)![4]))
          .filter((n) => n <= 10),
      ),
    ].sort((a, b) => a - b);
    // Locally the bank holds rungs 1..10; the CI fixture holds two. Both
    // are enough for a first and a last, and neither number is hardcoded.
    expect(ladder.length).toBeGreaterThanOrEqual(2);
    const [first] = ladder;
    const last = ladder[ladder.length - 1];

    const rungLinks = async (sequence: number) => {
      await page.goto(`/${lang}/word-games/WORD_SEARCH/A1/${sequence}`);
      expect(new URL(page.url()).pathname).toBe(`/${lang}/word-games/WORD_SEARCH/A1/${sequence}`);
      return puzzlesOf(await paths(page))
        .filter((h) => h.includes("/WORD_SEARCH/A1/"))
        .map((h) => Number(PUZZLE_HREF.exec(h)![4]));
    };

    // The bottom rung reaches the next one — this is also the positive
    // control for the assertion below: it proves the extractor sees
    // neighbour links at all, so "no link past the last free rung" is not
    // green because nothing was ever found.
    expect(await rungLinks(first)).toContain(ladder[1]);

    // The top of the FREE ladder links nothing above it. Rung 11 is
    // paywalled and a link to it is a 307 into /pricing.
    for (const seq of await rungLinks(last)) {
      expect(seq, `puzzle ${last} must not link past the free ladder`).toBeLessThanOrEqual(last);
    }
  });
}
