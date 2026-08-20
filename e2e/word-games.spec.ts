import { test, expect, type Page } from "@playwright/test";

// Narrow, iPhone-sized viewport, same convention as mobile-menu.spec.ts —
// this is the width the word-games UI actually needs to work at.
test.use({ viewport: { width: 390, height: 844 } });

// A1 crossword sequence 1's real seeded content (prisma/generate-word-games.ts
// is deterministic per (type, level, sequence), so this is stable across
// re-runs of `npm run generate:word-games` as long as the A1 word bank
// itself doesn't change). Row/col are 0-indexed to match the grid; the DOM
// exposes 1-indexed `row N col M` aria-labels (see CrosswordBoard.tsx).
const CROSSWORD_WORDS: { word: string; row: number; col: number; direction: "E" | "S" }[] = [
  { word: "завтра", row: 4, col: 4, direction: "E" },
  { word: "язык", row: 3, col: 4, direction: "S" },
  { word: "кухня", row: 3, col: 0, direction: "E" },
  { word: "огурец", row: 1, col: 1, direction: "S" },
  { word: "дождь", row: 1, col: 0, direction: "E" },
  { word: "один", row: 0, col: 3, direction: "S" },
];

async function fillCrossword(page: Page) {
  for (const { word, row, col, direction } of CROSSWORD_WORDS) {
    const [dr, dc] = direction === "S" ? [1, 0] : [0, 1];
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      await page.getByLabel(`row ${r + 1} col ${c + 1}`, { exact: true }).fill(word[i]);
    }
  }
}

test("crossword: full solve flow shows check feedback and the completion celebration", async ({ page }) => {
  await page.goto("/es/word-games/CROSSWORD/A1/1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Crucigrama");
  const cellCount = await page.locator("input[aria-label^='row']").count();
  expect(cellCount).toBeGreaterThan(0);

  // Type one wrong letter first — confirms the red incorrect-cell styling
  // actually round-trips through POST /check before we type the real
  // answers over it.
  // (0,3) 0-indexed — the start of "один" (row 0, col 3, direction S) in
  // the current seeded content; not (0,0), which isn't an active cell in
  // this grid (verified directly: filling it timed out waiting for a
  // cell that doesn't exist).
  const firstCell = page.getByLabel("row 1 col 4", { exact: true });
  await firstCell.fill("ю");
  await expect(firstCell).toHaveClass(/border-red-400/);

  await fillCrossword(page);

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("dialog")).toContainText("resuelto");

  await page.screenshot({ path: "test-results/word-games-crossword-solved.png" });
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
  // The star tier is appended right after WORD_SEARCH_RUNGS, so its first
  // sequence number is WORD_SEARCH_RUNGS.length + 1 (see
  // prisma/generate-word-games.ts) — currently 21.
  await page.goto("/es/word-games/WORD_SEARCH/A1/21");

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
