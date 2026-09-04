import { test, expect } from "./helpers/test";
import { isFreeWordGamePuzzle } from "../src/lib/word-games/free-tier";

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

async function paths(page: import("@playwright/test").Page, within = "") {
  return page
    .locator(`${within} a`.trim())
    .evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname));
}

/**
 * The rungs a page PUBLISHES, read from the server-rendered index and not
 * from every <a> on the page.
 *
 * The distinction is the whole point on /[lang]/word-games, which also
 * renders WordGamesPicker's own grid: that grid lists a ladder in full,
 * paywalled rungs included, so counting every link there answers a
 * different question than "what did we publish as free". Measured
 * 04.09.2026 on the e2e fixture, the two differ by exactly the ★ rung.
 */
const publishedRungs = async (page: import("@playwright/test").Page, path: string) => {
  await page.goto(path);
  return puzzlesOf(await paths(page, "section:has(h2)"));
};

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
    const [, , type, level, sequence] = PUZZLE_HREF.exec(href)!;
    // Через само правило, а не через `<= 10` и `!== "C1"`: с 05.09.2026
    // бесплатным бывает и номер за десяткой, названный поимённо
    // (EXTRA_FREE_WORD_GAME_RUNGS, PROGRESS 7.110). Пересказ правила
    // здесь объявил бы такую страницу дефектом ссылки.
    expect(isFreeWordGamePuzzle({ type, level, sequence: Number(sequence) }), href).toBe(true);
  }

  // The same set the catalogue's own server-rendered index publishes: one
  // rule (isPubliclyOpenableWordGamePuzzle), one bank, two pages.
  expect(new Set(hubPuzzles)).toEqual(new Set(await publishedRungs(page, "/es/word-games")));

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
    // The ladder is read from what the catalogue PUBLISHES, not from every
    // link on it — see publishedRungs. Deduplicated because the index and
    // the picker can name the same rung.
    const ladder = [
      ...new Set(
        (await publishedRungs(page, `/${lang}/word-games`))
          .filter((h) => h.includes("/WORD_SEARCH/A1/"))
          .map((h) => Number(PUZZLE_HREF.exec(h)![4])),
      ),
    ].sort((a, b) => a - b);
    // Locally the bank holds rungs 1..10; the CI fixture holds 1, 3, 4 —
    // rung 2 is the ★ sample and is deliberately NOT published. Both are
    // enough for a first, a middle and a last, and no number is hardcoded.
    expect(ladder.length).toBeGreaterThanOrEqual(3);
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

    // A rung in the middle reaches BOTH ways.
    const middle = ladder[1];
    const around = await rungLinks(middle);
    expect(around, `puzzle ${middle} must link back to ${ladder[0]}`).toContain(ladder[0]);
    expect(around, `puzzle ${middle} must link on to ${ladder[2]}`).toContain(ladder[2]);

    const topLinks = await rungLinks(last);
    // The top of the FREE ladder links nothing above it. Rung 11 is
    // paywalled and a link to it is a 307 into /pricing.
    for (const seq of topLinks) {
      expect(seq, `puzzle ${last} must not link past the free ladder`).toBeLessThanOrEqual(last);
    }

    // And no neighbour link may name a rung the catalogue did not publish.
    // This is the assertion the ★ rung would trip: WORD_SEARCH/A1/2 is
    // free by the sequence rule, is Premium-gated, and answers an
    // anonymous visitor with a 307 — so it is absent from `ladder`, and a
    // walk that stepped onto it would be caught here rather than three
    // pages later.
    for (const seq of [...(await rungLinks(first)), ...around, ...topLinks]) {
      expect(ladder, `rung ${seq} is linked as a neighbour but not published as free`).toContain(seq);
    }
  });
}
