import { type Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

// Runs everywhere, CI included. It used to self-skip under CI because
// word-game puzzles are generated from the FlashcardCard bank and that bank
// is DB-backed only, so a fresh CI database had no puzzles and nothing here
// could pass. That is now solved by seeding four real puzzle rows —
// e2e/fixtures/word-games.json, loaded by scripts/seed-e2e-fixture.mjs —
// instead of trying to reconstruct the card bank and re-run the generator.
// See PROGRESS.md 7.52.
//
// Nothing below may depend on WHICH puzzle it gets: locally these tests run
// against dev.db's real generated content, in CI against the fixture, and
// the generator rewrites the local rows whenever it runs. Read the grid,
// the word list and (for the crossword) the answers from the running app.

// Narrow, iPhone-sized viewport, same convention as mobile-menu.spec.ts —
// this is the width the word-games UI actually needs to work at.
test.use({ viewport: { width: 390, height: 844 } });

// Word games now require an active subscription (see proxy.ts's
// protectContentRoute) — every test below needs to actually reach the
// puzzle, not get redirected to /pricing.
test.beforeEach(async ({ page }) => {
  await loginWithSubscription(page);
});

// Serial, not parallel. The original reason given here — /api/auth/register's
// 10/min cap — has not applied since 12da466 bypassed that limiter under
// E2E_TEST_SEED, and each test now carries its own client IP anyway
// (e2e/helpers/test.ts). The reason that does apply: these tests each drive
// a whole puzzle, which means one POST /api/word-games/check per keystroke
// against a 120/min budget. Serial keeps each test's traffic inside its own
// minute instead of stacking two solves into one window.
test.describe.configure({ mode: "serial" });

/** Cyrillic, ordered by how often a letter turns up in Russian text. The
 * order is a cost control, not a correctness one: the oracle below stops
 * the moment every cell is known, so putting the common letters first
 * usually ends it a third of the way through the alphabet. */
const CYRILLIC_BY_FREQUENCY = "оеаинтсрвлкмдпуяызъьбгчйхжшюцщэфё".split("");

interface Cell {
  row: number;
  col: number;
}

/** Every answer cell of the crossword currently on screen, read from the
 * DOM. CrosswordBoard renders a plain `<div>` for a blocked square and an
 * `<input aria-label="row N col M">` (1-indexed) for an answer square, so
 * the inputs ARE the answer cells — no need to know the grid's shape. */
async function readCrosswordCells(page: Page): Promise<Cell[]> {
  const labels = await page
    .locator("input[aria-label^='row']")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
  return labels.map((label) => {
    const m = /^row (\d+) col (\d+)$/.exec(label);
    if (!m) throw new Error(`unexpected crossword cell label: ${label}`);
    return { row: Number(m[1]) - 1, col: Number(m[2]) - 1 };
  });
}

/**
 * The puzzle's answers, obtained from the running application rather than
 * written down here.
 *
 * Why not a fixture. This test used to carry the six words of
 * CROSSWORD/A1/1 with their row/col hardcoded. `prisma/generate-word-games.ts`
 * regenerated that rung, "среда" at row 0 col 1 stopped existing, and the
 * test failed on a cell that isn't there — a data drift, not a regression,
 * and the second time this exact fixture had rotted (see the comment it
 * replaces). Any re-derived fixture rots the same way on the next
 * regeneration, and a fixture also cannot travel between two different
 * databases: dev.db locally, the seeded fixture in CI.
 *
 * How. POST /api/word-games/check grades a batch of guesses per cell and
 * reports each one correct or not. Send every unresolved cell the same
 * candidate letter, keep the cells it says are correct, move to the next
 * candidate. That route's own comment already names this property ("repeated
 * calls turn it into an oracle that reconstructs the whole solution") as the
 * reason it sits behind the subscription gate — the gate is satisfied here,
 * by the same logged-in, subscribed session the test plays with.
 *
 * Cost: one request per distinct letter in the solution, not one per cell.
 * A 429 from the limiter is failed loudly instead of shrugged off: a
 * silently-truncated oracle would look like a puzzle with unknown cells.
 */
async function solveCrossword(page: Page, puzzleId: string, cells: Cell[]): Promise<Map<string, string>> {
  const solution = new Map<string, string>();
  let unresolved = cells;

  for (const letter of CYRILLIC_BY_FREQUENCY) {
    if (unresolved.length === 0) break;
    const response = await page.request.post("/api/word-games/check", {
      data: { puzzleId, guesses: unresolved.map((c) => ({ row: c.row, col: c.col, letter })) },
    });
    expect(response.status(), `POST /api/word-games/check while reading the solution (letter "${letter}")`).toBe(200);
    const { results } = (await response.json()) as { results: { row: number; col: number; correct: boolean }[] };
    const correct = new Set(results.filter((r) => r.correct).map((r) => `${r.row},${r.col}`));
    for (const cell of unresolved) if (correct.has(`${cell.row},${cell.col}`)) solution.set(`${cell.row},${cell.col}`, letter);
    unresolved = unresolved.filter((c) => !correct.has(`${c.row},${c.col}`));
  }

  // A cell no candidate matched means the alphabet above lost a letter, or
  // the grid holds something that isn't a Cyrillic letter at all. Either way
  // the rest of the test would be meaningless.
  expect(unresolved, "crossword cells the alphabet could not account for").toEqual([]);
  return solution;
}

/**
 * Types the solution the way a person does: one key press per cell, once.
 *
 * It used to type each cell, check whether the letter had actually appeared,
 * and retype the ones that had not, up to four passes. That was a workaround
 * for a real defect in the product, not a property of typing: a controlled
 * cell could lose a keystroke outright when a re-render landed between the
 * browser's edit and the input event (PROGRESS.md 7.54). The board no longer
 * does that, so the retyping is gone and this is a single honest pass.
 *
 * The check at the end stays. If a letter ever goes missing again, this
 * fails naming the cell, instead of the test limping on to fail ten lines
 * later on a celebration that could not possibly have appeared.
 *
 * `pressSequentially`, not `press`: `press` only knows named keys and ASCII
 * and rejects Cyrillic outright ("Unknown key"). Backspace first when a cell
 * is occupied, because `maxLength={1}` would otherwise drop the keystroke —
 * and Backspace is the board's own clearing path, so this stays a
 * description of what a player does.
 */
async function fillCrossword(page: Page, solution: Map<string, string>) {
  const cellFor = (key: string) => {
    const [row, col] = key.split(",").map(Number);
    return page.getByLabel(`row ${row + 1} col ${col + 1}`, { exact: true });
  };

  for (const [key, letter] of solution) {
    const cell = cellFor(key);
    if ((await cell.inputValue()) !== "") await cell.press("Backspace");
    await cell.pressSequentially(letter);
  }

  const missing: string[] = [];
  for (const [key, letter] of solution) {
    if ((await cellFor(key).inputValue()).toLowerCase() !== letter) missing.push(key);
  }
  expect(missing, "cells that did not keep the letter that was typed into them").toEqual([]);
}

test("crossword: full solve flow shows check feedback and the completion celebration", async ({ page }) => {
  // CrosswordBoard POSTs /api/word-games/check on every keystroke, against
  // a 120/min budget. A 429 makes runCheck bail out silently — no red cell,
  // no celebration — and the test would then fail on a timeout that names
  // the dialog instead of the cause. Name the cause. (This is also why the
  // test drives rung 1, six words: the big rungs at the top of a ladder
  // hold eighteen, and solving one of those twice does not fit in the
  // application's own per-minute budget. Measured: PROGRESS.md 7.52.)
  const rateLimited: string[] = [];
  page.on("response", (r) => {
    if (r.status() === 429 && r.url().includes("/api/word-games/")) rateLimited.push(r.url());
  });

  await page.goto("/es/word-games/CROSSWORD/A1/1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Crucigrama");
  const cells = await readCrosswordCells(page);
  expect(cells.length).toBeGreaterThan(0);

  // The puzzle's id is never printed on the page, and it is what /check
  // and /hint are addressed by. Take it from the board's own first call:
  // typing into any cell makes CrosswordBoard POST /api/word-games/check
  // with the id in its body. Reading it from the application means the test
  // cannot address a puzzle the page isn't actually showing.
  const firstCell = page.getByLabel(`row ${cells[0].row + 1} col ${cells[0].col + 1}`, { exact: true });
  const [checkRequest] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/api/word-games/check") && r.method() === "POST"),
    firstCell.fill("а"),
  ]);
  const puzzleId = (JSON.parse(checkRequest.postData() ?? "{}") as { puzzleId?: string }).puzzleId;
  expect(puzzleId, "puzzleId from the board's own /check call").toBeTruthy();

  const solution = await solveCrossword(page, puzzleId!, cells);
  expect(solution.size).toBe(cells.length);

  // A deliberately wrong letter first — this is what confirms the red
  // incorrect-cell styling really round-trips through POST /check, and it
  // has to be a letter this cell's answer is NOT, which is only knowable
  // now. (The old version typed a fixed "ю" and would have silently
  // stopped testing anything the day "ю" became the right answer.)
  const firstKey = `${cells[0].row},${cells[0].col}`;
  const wrongLetter = CYRILLIC_BY_FREQUENCY.find((l) => l !== solution.get(firstKey))!;
  await firstCell.fill(wrongLetter);
  await expect(firstCell).toHaveClass(/border-red-400/);

  await fillCrossword(page, solution);

  // Before the celebration, not after: a 429 makes CrosswordBoard's runCheck
  // return early, so the last graded keystroke never arrives and the puzzle
  // is never reported solved. Asserted here so that failure says "rate
  // limited" instead of "no dialog appeared".
  expect(rateLimited, "the board's own /check calls were rate-limited mid-solve").toEqual([]);

  // Regression guard for a real bug (5aa9e8d): WordGamePlayer used to show
  // BOTH the old CelebrationModal and the new GameResultPanel at once — two
  // stacked role="dialog" elements. Exactly one now.
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("dialog")).toContainText("resuelto");

  await page.screenshot({ path: "test-results/word-games-crossword-solved.png" });

  // "Play again" must actually restart the SAME puzzle, not just close the
  // dialog — confirm the board resets to empty and is solvable again.
  await page.getByRole("button", { name: "Jugar otro puzle" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(firstCell).toHaveValue("");
  await fillCrossword(page, solution);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

  // "Next game" must navigate back to the word-games catalog.
  await page.getByRole("button", { name: "← Volver a los juegos de palabras" }).click();
  await expect(page).toHaveURL(/\/es\/word-games$/);

  expect(rateLimited, "the board's own /check calls were rate-limited during the run").toEqual([]);
});

const DIRS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** Straight-line-only finder — good enough for the straight rungs (1-10);
 * curved/★ puzzles (11+) need findBentPath below since a bent word has no
 * single start/end/direction. Returns every cell along the line (not just
 * start/end) so dragSelect can move through each one's real center —
 * interpolating only between the two endpoints is what let a diagonal
 * drag clip a corner and "staircase" through an extra cell (verified: a
 * real bug hunt, not a hypothetical) that doesn't spell the word. */
function findPath(grid: string[][], word: string): { row: number; col: number }[] | null {
  const upper = word.toUpperCase();
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      for (const [dr, dc] of DIRS) {
        const endRow = row + dr * (upper.length - 1);
        const endCol = col + dc * (upper.length - 1);
        if (endRow < 0 || endRow >= grid.length || endCol < 0 || endCol >= grid[0].length) continue;
        let matches = true;
        for (let i = 0; i < upper.length; i++) {
          if (grid[row + dr * i]?.[col + dc * i]?.toUpperCase() !== upper[i]) {
            matches = false;
            break;
          }
        }
        if (matches) return Array.from({ length: upper.length }, (_, i) => ({ row: row + dr * i, col: col + dc * i }));
      }
    }
  }
  return null;
}

/** Brute-force backtracking search for a bent path (8-adjacent steps, no
 * self-revisit) spelling `word` in the grid — the click-sequence test's
 * own independent way of locating a curved word to click through, mirroring
 * (but not reusing) the generator's own backtracking placer so the test
 * verifies the puzzle from the outside, the same way a real player would
 * have to find it. */
function findBentPath(grid: string[][], word: string): { row: number; col: number }[] | null {
  const upper = word.toUpperCase();
  const rows = grid.length;
  const cols = grid[0].length;

  function backtrack(path: { row: number; col: number }[], visited: Set<string>): { row: number; col: number }[] | null {
    if (path.length === upper.length) return path;
    const last = path[path.length - 1];
    const nextLetter = upper[path.length];
    for (const [dr, dc] of DIRS) {
      const r = last.row + dr;
      const c = last.col + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (grid[r][c]?.toUpperCase() !== nextLetter) continue;
      path.push({ row: r, col: c });
      visited.add(key);
      const result = backtrack(path, visited);
      if (result) return result;
      path.pop();
      visited.delete(key);
    }
    return null;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col]?.toUpperCase() !== upper[0]) continue;
      const found = backtrack([{ row, col }], new Set([`${row},${col}`]));
      if (found) return found;
    }
  }
  return null;
}

async function readGrid(page: Page): Promise<string[][]> {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-row]"));
    const rows = Math.max(...buttons.map((b) => Number(b.dataset.row))) + 1;
    const cols = Math.max(...buttons.map((b) => Number(b.dataset.col))) + 1;
    const g: string[][] = Array.from({ length: rows }, () => Array(cols).fill(""));
    for (const b of buttons) g[Number(b.dataset.row)][Number(b.dataset.col)] = b.textContent?.trim() ?? "";
    return g;
  });
}

/** The word-list `<li>`s carry a `data-word` attribute precisely so tests
 * (and anything else) don't have to parse displayed text — which now also
 * contains the "(translation)" suffix and would otherwise need fragile
 * string-trimming to recover the bare word. */
async function readWordList(page: Page): Promise<string[]> {
  return page.locator("ul li[data-word]").evaluateAll((els) => els.map((el) => el.getAttribute("data-word") ?? ""));
}

/** Drags through every cell's real center in order, jumping directly to
 * each one (steps: 1, no interpolation) rather than from just the first
 * to the last cell with linear interpolation across the whole line — see
 * findPath's comment for why. This isn't only about the endpoints: even
 * interpolating between two *adjacent* diagonal cells passes through a
 * geometric midpoint that resolves to a third, "staircase" cell (verified
 * directly), inflating the selection past the word's real length. A
 * single direct jump per intended cell is what a careful, precise drag
 * looks like — an imprecise one legitimately can catch an extra cell,
 * same as in any real grid-selection UI, which is not a bug to route
 * around here. */
async function dragSelect(page: Page, path: { row: number; col: number }[]) {
  const boxes = await Promise.all(
    path.map((cell) => page.locator(`button[data-row="${cell.row}"][data-col="${cell.col}"]`).boundingBox()),
  );
  if (boxes.some((b) => !b)) throw new Error("missing cell bounding box");

  const first = boxes[0]!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  for (const box of boxes.slice(1)) {
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 1 });
  }
  await page.mouse.up();
}

test("word search: hovering the grid with no button held must not select anything", async ({ page }) => {
  // Regression guard for a real reported bug: the Pointer Events API
  // fires pointermove on plain hover, not only while a button is held,
  // so without an explicit "is a button actually down" guard, merely
  // moving the mouse across the grid — no click at all — was silently
  // building a selection on its own.
  await page.goto("/es/word-games/WORD_SEARCH/A1/1");
  await page.waitForSelector("button[data-row]");

  const cells = await page.locator("button[data-row]").all();
  for (let i = 0; i < 30; i++) {
    const box = await cells[i].boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  }

  const highlighted = await page.locator("button[data-row].bg-foreground\\/15").count();
  expect(highlighted).toBe(0);
  const foundCount = await page.locator("ul li[data-word].line-through").count();
  expect(foundCount).toBe(0);
});

test("word search: select a real word and see it struck through in the word list", async ({ page }) => {
  await page.goto("/es/word-games/WORD_SEARCH/A1/1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sopa de letras");

  const cellCount = await page.locator("button[data-row]").count();
  expect(cellCount).toBeGreaterThan(0);

  const grid = await readGrid(page);
  const words = await readWordList(page);
  expect(words.length).toBeGreaterThan(0);
  const targetWord = words[0];

  const path = findPath(grid, targetWord);
  expect(path).not.toBeNull();
  if (!path) return;
  await dragSelect(page, path);

  const foundEntry = page.locator(`ul li[data-word="${targetWord}"]`);
  await expect(foundEntry).toHaveClass(/line-through/);
  // The translation shows in parens next to the word — requested so the
  // sidebar doubles as a vocabulary aid while searching.
  await expect(foundEntry).toContainText("(");

  await page.screenshot({ path: "test-results/word-games-word-search.png" });
});

test("word search: diagonal words are findable and each found word gets a distinct highlight color", async ({ page }) => {
  // C1's densest rung (16x16, 16 words) — real content, not a synthetic
  // fixture, chosen because a dense grid is where the placement
  // algorithm's direction mix actually matters (a sparse grid can look
  // fine even with a cardinal-only bug).
  await page.goto("/es/word-games/WORD_SEARCH/C1/5");
  const grid = await readGrid(page);
  const words = await readWordList(page);
  expect(words.length).toBeGreaterThanOrEqual(3);

  for (const word of words.slice(0, 3)) {
    const path = findPath(grid, word);
    expect(path).not.toBeNull();
    if (!path) continue;
    await dragSelect(page, path);
    await expect(page.locator(`ul li[data-word="${word}"]`)).toHaveClass(/line-through/);
  }

  // Each found word's chip must carry a DIFFERENT color class — the bug
  // report was that every found word shared the same green, making the
  // grid unreadable once several words were found.
  const chipClasses = await page.locator("ul li[data-word]").evaluateAll((els) => els.slice(0, 3).map((el) => el.className));
  const hues = chipClasses.map((c) => c.match(/bg-(\w+)-500/)?.[1]);
  expect(new Set(hues).size).toBe(3);

  await page.screenshot({ path: "test-results/word-games-word-search-multicolor.png" });
});

test("word search: ★ expert puzzle can be solved by clicking through a bent word, and a wrong click can be canceled", async ({
  page,
}) => {
  // ★ puzzles are Premium-exclusive: the puzzle page redirects
  // curved/premiumOnly rows to /pricing for anything below the premium tier
  // (src/lib/entitlement.ts canAccessCurvedPuzzle). beforeEach's account is
  // standard-tier, so this test needs its own premium one — without it the
  // page below is /pricing and the word list is empty. It was, on every run
  // since the three-tier model shipped; nobody saw it because this file is
  // serial and the crossword test above it failed first.
  await loginWithSubscription(page, { tier: "premium" });

  // Discover the star tier's first sequence number from the picker UI
  // itself rather than hardcoding it — WORD_SEARCH_RUNGS.length (and so
  // where the star tier's numbering starts) has changed three times
  // already across content-expansion batches this session, breaking a
  // hardcoded sequence number every time. The picker is the actual
  // source of truth a real player would use, so it's also the more
  // faithful way to locate a ★ puzzle here.
  await page.goto("/es/word-games");
  const starTile = page.locator("a", { hasText: "★" }).first();
  await expect(starTile).toBeVisible();
  const href = await starTile.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);

  await expect(page.getByText("★")).toBeVisible();

  const grid = await readGrid(page);
  const words = await readWordList(page);
  expect(words.length).toBeGreaterThan(0);
  const targetWord = words[0];

  const path = findBentPath(grid, targetWord);
  expect(path).not.toBeNull();
  if (!path) return;
  // A genuinely curved puzzle's first word should need more than 2 cells
  // to even have a bend to click through; if this ever fires, the ★ tier
  // stopped being curved (a real regression, not just a flaky test).
  expect(path.length).toBeGreaterThanOrEqual(4);

  // Click a cell that is NOT the word's real first cell, then cancel via
  // the reset button — proves a wrong start doesn't get stuck.
  const wrongCell = path[0].row === 0 && path[0].col === 0 ? { row: 1, col: 1 } : { row: 0, col: 0 };
  await page.locator(`button[data-row="${wrongCell.row}"][data-col="${wrongCell.col}"]`).click();
  const resetButton = page.getByRole("button", { name: /cancelar selección/i });
  await expect(resetButton).toBeVisible();
  await resetButton.click();
  await expect(resetButton).toBeHidden();

  // Now click through the real path, one cell at a time — the click-to-
  // build desktop mechanic, distinct from the drag gesture the other
  // tests use.
  for (const cell of path) {
    await page.locator(`button[data-row="${cell.row}"][data-col="${cell.col}"]`).click();
  }

  await expect(page.locator(`ul li[data-word="${targetWord}"]`)).toHaveClass(/line-through/);

  await page.screenshot({ path: "test-results/word-games-word-search-curved-click.png" });
});

test("word search: finding every word shows exactly one completion dialog", async ({ page }) => {
  // Same regression this file's crossword test guards (5aa9e8d): the old
  // CelebrationModal + new GameResultPanel both live in the shared
  // WordGamePlayer, so this exact double-dialog bug applied to word
  // search too — just with no test that ever finished a whole puzzle to
  // catch it. A1/1 is small enough that every word is a straight line
  // (findPath, not the bent-path finder the ★ test needs).
  await page.goto("/es/word-games/WORD_SEARCH/A1/1");
  const grid = await readGrid(page);
  const words = await readWordList(page);
  expect(words.length).toBeGreaterThan(0);

  for (const word of words) {
    const path = findPath(grid, word);
    expect(path).not.toBeNull();
    if (!path) continue;
    await dragSelect(page, path);
  }

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("dialog")).toContainText("resuelto");

  // Статистика в панели, а не только «решено» и время: сколько слов
  // найдено из скольких. Число берётся из самого списка слов, чтобы
  // проверка не проходила вакуумно, если панель напечатает «0 из 0».
  await expect(page.getByRole("dialog")).toContainText(`${words.length}/${words.length}`);
  // И строка про выученные слова — та же, что под панелью режимов
  // словаря. Знаменатель у анонима — доступные слова, а не весь банк
  // (PROGRESS 7.76), поэтому проверяется наличие строки и то, что она
  // не рапортует пустой знаменатель.
  // Именно эта строка, а не любая со словом «palabra»: пилюля «Palabras
  // encontradas» выше содержит то же слово.
  const learned = page.getByRole("dialog").getByText(/(Has aprendido|Llevas) \d+ de \d+ palabra/);
  await expect(learned).toBeVisible();
  await expect(learned).not.toContainText(/de 0 palabra/);

  // "Play again" must actually restart the SAME puzzle, not just close the
  // dialog — confirm every word goes back to unfound and is findable again.
  await page.getByRole("button", { name: "Jugar otro puzle" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("ul li[data-word].line-through")).toHaveCount(0);
  const firstPath = findPath(grid, words[0]);
  expect(firstPath).not.toBeNull();
  if (firstPath) await dragSelect(page, firstPath);
  await expect(page.locator(`ul li[data-word="${words[0]}"]`)).toHaveClass(/line-through/);

  // "Next game" must navigate back to the word-games catalog.
  for (const word of words.slice(1)) {
    const path = findPath(grid, word);
    if (path) await dragSelect(page, path);
  }
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "← Volver a los juegos de palabras" }).click();
  await expect(page).toHaveURL(/\/es\/word-games$/);
});

/**
 * Every column of the widest puzzle must be ON SCREEN at a phone width —
 * not merely present in the DOM.
 *
 * The defect this closes, measured from the DOM in both engines before
 * the fix: a 16-column grid could shrink no further than its 22px column
 * floor (16 × 22 + gaps ≈ 394px), so inside the board's own horizontal
 * scroller only 10 of 16 columns were visible at 320px, 12 at 360 and 13
 * at 390 — which is exactly the "13 columns" a player counted on a phone
 * while the audit reported 16×16. Both numbers were right.
 *
 * It was not a scrolling inconvenience. Every cell carries `touch-none`
 * (it must: a horizontal drag IS how a horizontal word is selected), so a
 * finger on the board cannot pan that scroller, and a word ending in
 * column 14+ could not be selected at all.
 *
 * Asserted against the grid's own column count rather than a literal, so
 * the test still means something if the widest rung ever changes.
 *
 * The rung it opens is the WIDEST shape the bank actually holds, not the
 * common one. 16x16 is the usual grid, but four production rows are 18x18
 * (B2/10, C1/91, C1/141, C1/163 — counted over all 1738 WORD_SEARCH rows
 * on 2026-09-02; dev.db has eight of them, C1/91 among both). Pinning the
 * test to a 16-column puzzle left the two widest columns of the real
 * worst case unmeasured: 18 x 22px + gaps is ~40px wider than 16, which
 * is most of a 320px viewport's margin. So the fixture carries C1/91
 * (18x18, exported from dev.db the same way the other four rows were) and
 * the floor below is 18, the real maximum in the bank.
 */
test("word search: every column is on screen at a phone width, not just in the DOM", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es/word-games/WORD_SEARCH/C1/91");
  await page.waitForSelector('[role="grid"] button[data-row]');

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector('[role="grid"]')!;
    const cells = [...grid.querySelectorAll<HTMLElement>("button[data-row]")];
    const scroller = grid.parentElement!;
    const box = scroller.getBoundingClientRect();
    const visible = new Set(
      cells
        .filter((c) => {
          const r = c.getBoundingClientRect();
          return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
        })
        .map((c) => c.dataset.col),
    );
    return {
      cols: new Set(cells.map((c) => c.dataset.col)).size,
      visibleCols: visible.size,
      overflows: scroller.scrollWidth > scroller.clientWidth + 1,
      documentWidth: document.documentElement.scrollWidth,
    };
  });

  // The bank's widest puzzle is 18 columns; if this rung ever stops being
  // one of them the assertion below would pass vacuously on a narrow grid.
  expect(geometry.cols).toBeGreaterThanOrEqual(18);
  expect(geometry.visibleCols).toBe(geometry.cols);
  expect(geometry.overflows).toBe(false);
  expect(geometry.documentWidth).toBeLessThanOrEqual(390);
});

/**
 * Кроссворд на телефоне: доска НЕ помещается и помещаться не может — но
 * до каждой клетки можно дойти, и страница вбок не едет.
 *
 * Почему правило другое, чем у филворда. У филворда доска обязана
 * ПОМЕЩАТЬСЯ целиком (тест выше): каждая его клетка несёт `touch-none`,
 * потому что горизонтальный свайп там — это способ выделить слово, и
 * поэтому палец на доске скроллер не двигает. Кроссворд свайпом не
 * играют: буква вводится тапом и клавиатурой, `touch-action` у сетки
 * остаётся `auto`, и скроллер карточки прокручивается пальцем как
 * обычно.
 *
 * И помещаться кроссворд не может по арифметике. При 320px внутренняя
 * ширина карточки — 272px, а колонка не сжимается ниже 22px
 * (`minmax(22px, 2.5rem)`), то есть на экран влезает 11 столбцов из
 * 46 у самого широкого пазла банка. Опустить пол так, чтобы 46 колонок
 * поместились, значит сделать клетку 3,9px: в неё не попасть и в ней
 * ничего не прочитать. Замер по всему банку прода 02.09.2026: не
 * помещается 1071 кроссворд из 1262 при 320px, 978 при 360, 918 при 390
 * (PROGRESS.md 7.92).
 *
 * Поэтому проверяются три вещи, которые обязаны быть верны ИМЕННО
 * потому, что доска шире экрана:
 *
 *  1. Документ вбок не едет — прокручивается только карточка.
 *  2. Сетке не запрещено панорамирование (`touch-action` не `none`), а
 *     скроллеру есть что прокручивать.
 *  3. Клетка, до которой довела автопротяжка, оказывается видимой: слово
 *     длиннее видимой части доски всё равно можно набрать.
 *
 * Открывается B1/91 — 46×11, самая широкая строка банка (и в фикстуре,
 * и в dev.db). Пазл поуже сделал бы тест зелёным вакуумно.
 */
test("crossword: the board is wider than the phone on purpose — the page is not, and every cell is reachable", async ({
  page,
}) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/es/word-games/CROSSWORD/B1/91");
    await page.waitForSelector('[role="grid"] input');

    const geometry = await page.evaluate(() => {
      const grid = document.querySelector('[role="grid"]') as HTMLElement;
      const scroller = grid.parentElement as HTMLElement;
      const cells = [...grid.querySelectorAll<HTMLInputElement>("input")];
      const box = scroller.getBoundingClientRect();
      return {
        cols: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
        cellPx: Math.round((cells[0]?.getBoundingClientRect().width ?? 0) * 10) / 10,
        touchAction: getComputedStyle(grid).touchAction,
        scrollableBy: scroller.scrollWidth - scroller.clientWidth,
        visibleCells: cells.filter((c) => {
          const r = c.getBoundingClientRect();
          return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
        }).length,
        totalCells: cells.length,
        documentWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      };
    });

    // 1. Едет карточка, а не страница. Первым: это самый тяжёлый отказ
    // класса, и подсадка обязана сообщать именно о нём, а не о вакуумной
    // защите ниже, которая на той же подсадке тоже сработала бы.
    expect(geometry.documentWidth, `${width}px: страница поехала вбок`).toBeLessThanOrEqual(geometry.viewport);
    // Вакуумная защита: если банк когда-нибудь потеряет широкий пазл,
    // «всё видно» стало бы правдой по причине, к вёрстке отношения не
    // имеющей, и тест перестал бы что-либо утверждать.
    expect(geometry.cols, `${width}px: пазл должен быть широким`).toBeGreaterThanOrEqual(40);
    expect(geometry.visibleCells, `${width}px: доска шире экрана, часть клеток вне карточки`).toBeLessThan(
      geometry.totalCells
    );
    // 2. Пальцем доску можно провезти: панорамирование не запрещено и
    //    прокручивать есть что.
    expect(geometry.touchAction, `${width}px: сетке запрещено панорамирование`).not.toBe("none");
    expect(geometry.scrollableBy, `${width}px: скроллеру нечего прокручивать`).toBeGreaterThan(0);
    // 3. Клетка читаемого размера — пол 22px, а не сжатие в ничто.
    expect(geometry.cellPx, `${width}px: клетка сжалась ниже пола`).toBeGreaterThanOrEqual(22);
  }

  // 3 (продолжение). «полуостров» — строка 4, столбцы 7..16 — переходит
  // через правый край видимой части при 320px. Набираем его вслепую и
  // смотрим на КАЖДЫЙ шаг, а не только на последний.
  //
  // Почему на каждый. Прежняя редакция смотрела только на клетку в конце
  // слова, и была зелена локально по случайности: WebKit сам увозит доску
  // только тогда, когда клетка скрыта ЦЕЛИКОМ (столбец 12), и один такой
  // рывок затаскивал внутрь и весь остаток слова — с запасом 29px, то есть
  // 1,2 клетки. Столбец 11, скрытый ЧАСТИЧНО (277..299 при видимой части
  // 25..295), при этом оставался снаружи и там же и оставался: в частичном
  // случае WebKit не делает ничего. Утверждение о видимости было верно на
  // шаге 9 и ложно на шаге 4 — просто никто не смотрел на шаг 4. В CI на
  // Linux-сборке WebKit граница проходила иначе, и наружу выпадал уже
  // последний шаг: 88 из 89 зелёных, три попытки из трёх красные
  // (PROGRESS.md 7.92).
  //
  // Поэтому доводкой занят сам CrosswordBoard (revealCell), а тест требует
  // её на каждом шаге. Замер берётся не по таймеру, а по устоявшейся
  // геометрии — как в check:layout: прямоугольник подписывается на каждом
  // кадре, и годится только тот, что повторился три раза подряд. Это не
  // «щедрый таймаут»: ожидание кончается само, как только картинка встала.
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/es/word-games/CROSSWORD/B1/91");
  await page.waitForSelector('[role="grid"] input');
  await page.locator('[role="grid"] input[aria-label="row 4 col 7"]').scrollIntoViewIfNeeded();
  await page.locator('[role="grid"] input[aria-label="row 4 col 7"]').focus();

  const steps: { label: string | null; cellLeft: number; cellRight: number; boxLeft: number; boxRight: number; scrollLeft: number }[] = [];
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.type("а");
    steps.push(await settledFocusGeometry(page));
  }

  const last = steps[steps.length - 1];
  expect(last.label, "автопротяжка не дошла до правого края").toBe("row 4 col 16");
  expect(last.scrollLeft, "доска не поехала за фокусом").toBeGreaterThan(0);
  // Каждый шаг, а не только последний: слово длиннее видимой части доски
  // можно набрать только если клетка с фокусом видна ВСЮ дорогу.
  for (const s of steps) {
    expect(
      s.cellLeft >= s.boxLeft - 1 && s.cellRight <= s.boxRight + 1,
      `${s.label}: клетка ${s.cellLeft}..${s.cellRight} вне видимой части доски ${s.boxLeft}..${s.boxRight} при scrollLeft ${s.scrollLeft}`
    ).toBe(true);
  }
});

/**
 * Играбельность доски на 320px, замером: попадание пальца, видимость на
 * каждом шаге по СТОЛБЦУ и читаемость буквы.
 *
 * Что здесь нового против теста выше. Тот доказывает, что доска шире
 * экрана НАМЕРЕННО и что слово по СТРОКЕ можно набрать. Он ничего не
 * говорит ни о том, попадает ли палец в клетку 22px, ни о том, что
 * происходит при ходе ВНИЗ, ни о том, читается ли буква в такой клетке —
 * а это ровно те три величины, из которых складывается «в это можно
 * играть» (PROGRESS.md 7.94).
 *
 * Тап — настоящий `touchscreen.tap`, а не `click()` по координате: у
 * `click()` нет ни фазы касания, ни подгонки цели, и он отвечает на другой
 * вопрос. Прицел смещается по восьми направлениям на 10px — это половина
 * шага сетки без одного пикселя (шаг 24px = клетка 22 + зазор 2), то есть
 * самый большой промах, который ещё обязан попасть в свою клетку.
 *
 * ЧЕМ ЭТО КОНТРОЛИРУЕТСЯ (каждая подсадка — со своей прод-сборкой,
 * 03.09.2026):
 *
 *  — поле ввода ужато до 12px внутри клетки 22px → красный на ТАПЕ
 *    (Chromium, «прицел row 1 col 5 со смещением (0,-8) → никуда»);
 *  — `text-xs` заменён на `text-[6px]` → красный на ЧИТАЕМОСТИ в обоих
 *    движках (кегль 6px, «Ш» высотой 4,19px);
 *  — `revealCell` теряет положение доски (`scrollLeft = 0` на каждом
 *    шаге) → красный на ХОДЕ ВНИЗ (Chromium);
 *  — `sm:text-base` → `sm:text-2xl` (на 320px не действует) → всё
 *    остаётся зелёным, то есть проверка не красит что попало.
 *
 * Одна подсадка красным НЕ становится, и это записано, а не спрятано:
 * при полностью отключённом `revealCell` ход ВНИЗ остаётся зелёным. Так
 * и должно быть — вертикальное слово не двигает доску вбок, доводка ему
 * не нужна, — и горизонтальную доводку ловит отдельный тест выше,
 * который на той же подсадке краснеет.
 *
 * ОГОВОРКА, которую нашёл позитивный контроль. Подсадка «поле ввода
 * ужато до 12px внутри клетки 22px» краснеет в Chromium (280/320) и
 * остаётся ЗЕЛЁНОЙ в WebKit: WebKit подгоняет тап к ближайшей цели, и
 * размер поля перестаёт быть виден замеру. То есть чувствительна к этому
 * классу только половина прогона, и это записано здесь, а не забыто.
 */
// hasTouch включается ЗДЕСЬ, а не берётся из проекта: проект `chromium` —
// это Desktop Chrome, у него сенсора нет вовсе, и `touchscreen.tap` там
// падает. А именно Chromium с сенсором и оказался единственной половиной
// прогона, чувствительной к размеру цели (см. оговорку выше), так что
// выкинуть его нельзя — надо включить ему касание.
test.describe(() => {
  test.use({ hasTouch: true });

test("crossword: палец попадает в клетку 22px, буква читается, ход вниз не теряет клетку", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/es/word-games/CROSSWORD/B1/91");
  await page.waitForSelector('[role="grid"] input');

  // Вакуумная защита: пазл обязан быть широким, иначе клетка не 22px и
  // тест утверждает что-то другое.
  const grid = await page.evaluate(() => {
    const g = document.querySelector('[role="grid"]') as HTMLElement;
    // Меряется ДОРОЖКА сетки, а не поле ввода внутри неё: иначе подсадка
    // «поле ужато внутри клетки» валила бы вакуумную защиту вместо того,
    // чтобы дойти до проверки тапа, ради которой она и сажается.
    const cells = [...g.children].filter((el) => (el as HTMLElement).className.includes("aspect-square"));
    const first = cells[0].getBoundingClientRect();
    const second = cells[1].getBoundingClientRect();
    return {
      cols: getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length,
      cell: Math.round(first.width * 100) / 100,
      pitch: Math.round((second.left - first.left) * 100) / 100,
    };
  });
  expect(grid.cols, "пазл должен быть широким, иначе клетка не на полу 22px").toBeGreaterThanOrEqual(40);
  expect(grid.cell, "клетка должна стоять на полу 22px").toBeCloseTo(22, 1);
  expect(grid.pitch, "шаг сетки — клетка плюс зазор gap-0.5").toBeCloseTo(24, 1);

  // 1. ТАП. Восемь направлений на 10px вокруг центра — и центр.
  const targets = await page.evaluate(() => {
    const g = document.querySelector('[role="grid"]') as HTMLElement;
    const scroller = g.closest("[data-crossword-scroller]") as HTMLElement;
    const box = scroller.getBoundingClientRect();
    const portLeft = box.left + scroller.clientLeft;
    const portRight = portLeft + scroller.clientWidth;
    return [...g.querySelectorAll<HTMLInputElement>("input")]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { label: c.getAttribute("aria-label"), cx: r.left + r.width / 2, cy: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })
      .filter((c) => c.left >= portLeft - 0.5 && c.right <= portRight + 0.5 && c.top >= 0 && c.bottom <= 780)
      .slice(0, 5);
  });
  expect(targets.length, "не нашлось видимых клеток для тапа").toBe(5);
  // Не одно кольцо, а свип по радиусам. Одного кольца в 10px мало, и это
  // показала подсадка: при ужатом до 12px поле тап со смещением ровно 10px
  // всё равно попадал — Chromium подгонял его к ближайшей цели, — а
  // промахивался на 6 и 8px, у самой кромки ужатого поля. Кольцо, мимо
  // которого подсадка проходит, — это фильтр, выбрасывающий цель из
  // замера (правило 4.5).
  const D = 0.70710678;
  const OFFSETS: [number, number][] = [[0, 0]];
  for (const r of [4, 6, 8, 10]) {
    OFFSETS.push([r, 0], [-r, 0], [0, r], [0, -r], [r * D, r * D], [-r * D, -r * D], [r * D, -r * D], [-r * D, r * D]);
  }
  const misses: string[] = [];
  for (const t of targets) {
    for (const [dx, dy] of OFFSETS) {
      await page.touchscreen.tap(t.cx + dx, t.cy + dy);
      const got = await page.evaluate(() => document.activeElement?.getAttribute?.("aria-label") ?? null);
      if (got !== t.label) misses.push(`прицел ${t.label} со смещением (${Math.round(dx)},${Math.round(dy)}) → ${got ?? "никуда"}`);
    }
  }
  expect(misses, `тап промахнулся мимо своей клетки: ${misses.join("; ")}`).toEqual([]);

  // 2. ЧИТАЕМОСТЬ. Не заявленный класс, а вычисленный кегль и настоящая
  //    высота глифа кириллической заглавной в том же самом шрифте.
  const type = await page.evaluate(() => {
    const input = document.querySelector('[role="grid"] input') as HTMLInputElement;
    const cs = getComputedStyle(input);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
    const m = ctx.measureText("Ш");
    return {
      fontPx: parseFloat(cs.fontSize),
      transform: cs.textTransform,
      glyphHeight: Math.round((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 100) / 100,
      glyphWidth: Math.round(m.width * 100) / 100,
      // снова ДОРОЖКА, а не поле: читаемость — свойство клетки сетки
      cell: Math.round((input.parentElement as HTMLElement).getBoundingClientRect().width * 100) / 100,
    };
  });
  // Замер 03.09.2026 в обоих движках: 12px, «Ш» высотой 8,39–8,40px и
  // шириной 10,33px в клетке 22px. Нижние границы, а не равенства: шрифт
  // может смениться, но не имеет права стать нечитаемым.
  expect(type.fontPx, `кегль ${type.fontPx}px в клетке ${type.cell}px`).toBeGreaterThanOrEqual(12);
  expect(type.glyphHeight, `высота глифа «Ш» ${type.glyphHeight}px`).toBeGreaterThanOrEqual(8);
  expect(type.glyphWidth, `ширина глифа «Ш» ${type.glyphWidth}px не помещается в клетку`).toBeLessThan(type.cell - 2);

  // 3. ХОД ВНИЗ. Берём клетку без горизонтальных соседей — тогда
  //    направление S однозначно, — и идём вниз по слову, требуя видимости
  //    клетки с фокусом на КАЖДОМ шаге, как и для хода по строке.
  const down = await page.evaluate(() => {
    const has = (r: number, c: number) => !!document.querySelector(`[role="grid"] input[aria-label="row ${r} col ${c}"]`);
    const all = [...document.querySelectorAll('[role="grid"] input')].map((i) => {
      const m = /row (\d+) col (\d+)/.exec(i.getAttribute("aria-label") ?? "")!;
      return { r: Number(m[1]), c: Number(m[2]) };
    });
    let best: { r: number; c: number; len: number } | null = null;
    for (const { r, c } of all) {
      if (has(r, c - 1) || has(r, c + 1)) continue;
      if (has(r - 1, c)) continue;
      let len = 1;
      while (has(r + len, c)) len += 1;
      if (len >= 3 && (!best || len > best.len)) best = { r, c, len };
    }
    return best;
  });
  expect(down, "в пазле не нашлось однозначно вертикального хода").not.toBeNull();
  const sel = (r: number, c: number) => `[role="grid"] input[aria-label="row ${r} col ${c}"]`;
  await page.locator(sel(down!.r, down!.c)).scrollIntoViewIfNeeded();
  await page.locator(sel(down!.r, down!.c)).click();
  for (let i = 0; i < down!.len; i += 1) {
    await page.keyboard.type("а");
    const shot = await settledFocusGeometry(page);
    expect(
      shot.cellLeft >= shot.boxLeft - 1 && shot.cellRight <= shot.boxRight + 1,
      `ход вниз, шаг ${i + 1} (${shot.label}): клетка ${shot.cellLeft}..${shot.cellRight} вне видимой части доски ${shot.boxLeft}..${shot.boxRight}`
    ).toBe(true);
    if (shot.label !== `row ${down!.r + i + 1} col ${down!.c}` && i + 1 < down!.len) {
      await page.locator(sel(down!.r + i + 1, down!.c)).click();
    }
  }
});

});

/**
 * Слово, набираемое ВНИЗ, с открытой клавиатурой: клетка с фокусом обязана
 * остаться над её верхним краем — и обязана вставать ТУДА ЖЕ независимо от
 * того, увёз ли страницу движок сам (PROGRESS.md 7.96, было 7.95).
 *
 * Чего не мерил ни один тест до этого. Соседний тест 7.94 проходит слово
 * вниз и требует видимости на каждом шаге — но только ПО СТОЛБЦУ, то есть
 * по горизонтали. Клавиатуры в замере не было вовсе, а по вертикали
 * `revealCell` не делал ничего. Это записано числом ниже, в контроле на
 * слепоту.
 *
 * ДВЕ МОДЕЛИ, и правильным результат обязан быть при обеих — какая из них
 * описывает настоящий iPhone, отсюда не видно и здесь не решается:
 *
 *   `blind`  — окно 320×780, `visualViewport.height` подменён на 444.
 *              Форма iOS: клавиатура сжимает ВИЗУАЛЬНЫЙ вьюпорт, а
 *              layout-вьюпорт (`innerHeight`) остаётся 780, поэтому
 *              собственная доводка движка к фокусу считает клетку на
 *              экране и не делает ничего.
 *   `shrunk` — окно 320×444 по-настоящему. Форма Android: клавиатура
 *              ужимает и layout-вьюпорт, и движок про это знает.
 *
 * ПОЧЕМУ ЭТОТ ТЕСТ ПЕРЕПИСАН. Его первая редакция требовала от модели
 * `shrunk` ровно НОЛЬ прокруток страницы: там движок увозил её сам
 * (`scrollY` 0 → 235 на шаге 8), и доводке полагалось молчать. Локально это
 * было так в обоих движках; на Linux-сборке WebKit в CI тот же движок не
 * увёз НИЧЕГО, клетка осталась под сгибом, и требование видимости упало
 * (`word-games.spec.ts`, модель `shrunk`, `cellBottom <= viewBottom`).
 * Ошибка была не в числе, а в том, ЧТО им закреплено: тест закреплял
 * поведение движка. Теперь закреплено поведение продукта — `focusCell`
 * просит `focus({ preventScroll: true })`, и всё, что двигает страницу, —
 * это доводка.
 *
 * Отсюда главное утверждение ниже: таблицы двух моделей обязаны СОВПАСТЬ
 * по шагам. Совпадение и есть «результат не зависит от движка», записанное
 * числом, а не словами.
 *
 * ЧТО ИЗМЕРЕНО ЭТИМ ЖЕ СТЕНДОМ (03.09.2026, слово из 10 букв вниз по
 * столбцу 12 пазла B1/91):
 *
 *   до правки, blind:  шаги 8, 9, 10 на 446..492 при границе 444 — три
 *                      скрытых из одиннадцати, движок не двигал страницу;
 *   до правки, shrunk: скрытых 0, но всю работу сделал движок
 *                      (`scrollY` 0 → 235, наших вызовов 0);
 *   после правки:      обе модели, оба движка — `scrollY`
 *                      0,0,0,0,0,0,0,0,24,48,48, клетка 422..444, наших
 *                      вызовов 2, оба сдвинули.
 *
 * ЧЕМ ЭТО КОНТРОЛИРУЕТСЯ (каждая половина — со своей прод-сборкой):
 *
 *  — вертикальная ветка `revealCell` снята целиком → красный в обоих
 *    движках и в обеих моделях;
 *  — возвращена → зелёный;
 *  — возвращён `el.focus()` без `preventScroll` (то есть доводка снова
 *    делит работу с движком) → красный: таблицы моделей расходятся, в
 *    `shrunk` страницу увозит движок на 235 вместо наших 24.
 *
 * И контроль на слепоту, ради того чтобы «зелёный» соседнего теста не
 * приняли за покрытие вертикали: при снятой вертикальной доводке тест 7.94
 * обязан остаться ЗЕЛЁНЫМ. Он и остаётся — вертикали он не мерил.
 */
const KEYBOARD_BOTTOM = 444; // 780 минус клавиатура iOS ≈ 336px

test("crossword: слово вниз не уходит под клавиатуру, и встаёт туда же независимо от движка", async ({ page }) => {
  // Подмена `visualViewport.height` включается ПАРАМЕТРОМ АДРЕСА, а не
  // переменной: init-скрипт исполняется в свежем контексте на каждой
  // навигации, и обе модели живут в одном тесте.
  await page.addInitScript(`
    (() => {
      const want = new URLSearchParams(location.search).get("e2eKeyboardTop");
      const vv = window.visualViewport;
      if (!want || !vv) return;
      Object.defineProperty(vv, "height", { get: () => Number(want), configurable: true });
      Object.defineProperty(vv, "offsetTop", { get: () => 0, configurable: true });
    })();
  `);
  // Счётчик прокруток СТРАНИЦЫ. Ничто на этой странице, кроме доводки,
  // окно не прокручивает — что и подтверждается нулём в модели shrunk
  // ниже: будь тут посторонний прокручиватель, ноль был бы недостижим.
  await page.addInitScript(`
    (() => {
      window.__pageScrolls = [];
      const by = window.scrollBy.bind(window);
      window.scrollBy = (...a) => {
        const before = window.scrollY;
        by(...a);
        window.__pageScrolls.push({ before, after: window.scrollY });
      };
    })();
  `);

  const walkDown = async (model: "blind" | "shrunk") => {
    if (model === "blind") await page.setViewportSize({ width: 320, height: 780 });
    else await page.setViewportSize({ width: 320, height: KEYBOARD_BOTTOM });
    const query = model === "blind" ? `?e2eKeyboardTop=${KEYBOARD_BOTTOM}` : "";
    await page.goto(`/es/word-games/CROSSWORD/B1/91${query}`);
    await page.waitForSelector('[role="grid"] input');

    // Тот же выбор слова, что и в тесте 7.94: клетка без горизонтальных
    // соседей, чтобы направление S было однозначным.
    const down = await page.evaluate(() => {
      const has = (r: number, c: number) => !!document.querySelector(`[role="grid"] input[aria-label="row ${r} col ${c}"]`);
      const all = [...document.querySelectorAll('[role="grid"] input')].map((i) => {
        const m = /row (\d+) col (\d+)/.exec(i.getAttribute("aria-label") ?? "")!;
        return { r: Number(m[1]), c: Number(m[2]) };
      });
      let best: { r: number; c: number; len: number } | null = null;
      for (const { r, c } of all) {
        if (has(r, c - 1) || has(r, c + 1)) continue;
        if (has(r - 1, c)) continue;
        let len = 1;
        while (has(r + len, c)) len += 1;
        if (len >= 3 && (!best || len > best.len)) best = { r, c, len };
      }
      return best;
    });
    expect(down, `${model}: в пазле не нашлось однозначно вертикального хода`).not.toBeNull();
    // Вакуумная защита: короткое слово уместилось бы над клавиатурой само
    // собой, и «ничего не скрылось» стало бы правдой по причине, к доводке
    // отношения не имеющей.
    expect(down!.len, `${model}: слово вниз должно быть длинным`).toBeGreaterThanOrEqual(8);

    const sel = (r: number, c: number) => `[role="grid"] input[aria-label="row ${r} col ${c}"]`;
    await page.locator(sel(down!.r, down!.c)).scrollIntoViewIfNeeded();
    await page.locator(sel(down!.r, down!.c)).click();

    const steps = [await settledFocusGeometry(page)];
    for (let i = 0; i < down!.len; i += 1) {
      await page.keyboard.type("а");
      const shot = await settledFocusGeometry(page);
      steps.push(shot);
      if (shot.label !== `row ${down!.r + i + 1} col ${down!.c}` && i + 1 < down!.len) {
        await page.locator(sel(down!.r + i + 1, down!.c)).click();
      }
    }
    const scrolls = await page.evaluate(
      () => (window as unknown as { __pageScrolls: { before: number; after: number }[] }).__pageScrolls
    );
    return { steps, calls: scrolls.length, moved: scrolls.filter((s) => s.before !== s.after).length };
  };

  // МОДЕЛЬ 1 — движок о клавиатуре не знает. Видимость обязана держаться
  // доводкой, и только ею.
  const blind = await walkDown("blind");
  // Вакуумная защита самой модели: подмена обязана дать границу ВЫШЕ окна,
  // иначе «под клавиатурой» не наступает и проверка ниже пуста.
  expect(blind.steps[0].viewBottom, "модель blind: граница видимой области не поднялась").toBe(KEYBOARD_BOTTOM);
  expect(blind.steps[0].innerHeight, "модель blind: окно обязано остаться высоким").toBeGreaterThan(KEYBOARD_BOTTOM);

  // МОДЕЛЬ 2 — движок знает про клавиатуру и, вообще говоря, может увезти
  // страницу сам. Может — но результат обязан быть тем же самым.
  const shrunk = await walkDown("shrunk");
  expect(shrunk.steps[0].viewBottom, "модель shrunk: видимая область обязана совпасть с окном").toBe(
    shrunk.steps[0].innerHeight
  );

  for (const [model, run] of [
    ["blind", blind],
    ["shrunk", shrunk],
  ] as const) {
    for (const s of run.steps) {
      expect(
        s.cellBottom <= s.viewBottom + 0.5,
        `${model}, ${s.label}: клетка ${s.cellTop}..${s.cellBottom} ниже границы видимой области ${s.viewBottom} при scrollY ${s.scrollY}`
      ).toBe(true);
    }
    // Вакуумная защита к результату: если страница не сдвинулась ни разу,
    // значит слово целиком уместилось над клавиатурой и зелёный получен не
    // доводкой. Требуется в ОБЕИХ моделях — в этом и правка: страницу
    // двигаем мы, а не движок.
    expect(run.moved, `модель ${model}: доводка не сдвинула страницу ни разу`).toBeGreaterThan(0);
    expect(
      run.steps[run.steps.length - 1].scrollY,
      `модель ${model}: страница осталась на месте`
    ).toBeGreaterThan(0);
    // И лишних прокруток быть не должно: каждый вызов обязан был сдвинуть
    // страницу. Вызов, не сдвинувший ничего, — это либо просьба на ноль,
    // либо просьба, усечённая движком (так и выглядел дефект дробного
    // смещения в WebKit), и то и другое здесь дефект.
    expect(run.calls, `модель ${model}: доводка звала прокрутку впустую`).toBe(run.moved);
  }

  // ГЛАВНОЕ УТВЕРЖДЕНИЕ. Обе модели обязаны дать одну и ту же таблицу: тот
  // же шаг — та же клетка, тот же `scrollY`, то же число сдвигов. Пока это
  // так, ответ на вопрос «увёз ли движок сам» не входит в результат — а
  // именно на этом ответе первая редакция и сломалась в CI.
  expect(shrunk.moved, "модели разошлись числом сдвигов").toBe(blind.moved);
  for (let i = 0; i < blind.steps.length; i += 1) {
    const b = blind.steps[i];
    const k = shrunk.steps[i];
    expect(
      `${k.label} ${k.cellTop}..${k.cellBottom} scrollY ${k.scrollY}`,
      `шаг ${i}: модели разошлись — доводка снова зависит от движка`
    ).toBe(`${b.label} ${b.cellTop}..${b.cellBottom} scrollY ${b.scrollY}`);
  }
});

/**
 * Прямоугольник клетки с фокусом, снятый после того, как геометрия встала.
 *
 * Та же схема, что у `check:layout`: величина снимается на каждом кадре и
 * принимается только тогда, когда три подряд совпали. Ждать по таймеру
 * здесь нельзя — доводка до видимой области в WebKit откладывается до
 * следующего обновления отрисовки, и «подождать 300мс» отвечает на вопрос
 * «успело ли», а не на вопрос «куда встало».
 *
 * Потолок в 120 кадров — предохранитель от бесконечного ожидания на
 * странице, которая перерисовывается непрерывно; он не удлиняет ожидание в
 * нормальном случае (три кадра) и не делает проверку мягче: вернувшаяся по
 * потолку геометрия проверяется теми же неравенствами.
 */
async function settledFocusGeometry(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        label: string | null;
        cellLeft: number;
        cellRight: number;
        boxLeft: number;
        boxRight: number;
        scrollLeft: number;
        cellTop: number;
        cellBottom: number;
        // Нижняя граница ВИДИМОЙ области, а не окна: под клавиатурой это
        // разные величины, и в этом вся задача (PROGRESS.md 7.95).
        viewBottom: number;
        innerHeight: number;
        scrollY: number;
      }>(
        (resolve) => {
          const scroller = document.querySelector('[role="grid"]')!.parentElement as HTMLElement;
          let same = 0;
          let prev = "";
          let frames = 0;
          const sample = () => {
            frames += 1;
            const active = document.activeElement as HTMLElement;
            const r = active.getBoundingClientRect();
            const box = scroller.getBoundingClientRect();
            const vv = window.visualViewport;
            const shot = {
              label: active.getAttribute("aria-label"),
              cellLeft: Math.round(r.left * 10) / 10,
              cellRight: Math.round(r.right * 10) / 10,
              boxLeft: Math.round(box.left * 10) / 10,
              boxRight: Math.round(box.right * 10) / 10,
              scrollLeft: Math.round(scroller.scrollLeft),
              cellTop: Math.round(r.top * 10) / 10,
              cellBottom: Math.round(r.bottom * 10) / 10,
              viewBottom: vv ? Math.round((vv.offsetTop + vv.height) * 10) / 10 : window.innerHeight,
              innerHeight: window.innerHeight,
              scrollY: Math.round(window.scrollY),
            };
            const key = JSON.stringify(shot);
            if (key === prev) same += 1;
            else {
              same = 1;
              prev = key;
            }
            if (same >= 3 || frames > 120) {
              resolve(shot);
              return;
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }
      )
  );
}
