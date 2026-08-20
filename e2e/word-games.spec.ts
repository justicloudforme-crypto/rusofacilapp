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
  { word: "завтра", row: 3, col: 4, direction: "E" },
  { word: "бумага", row: 0, col: 5, direction: "S" },
  { word: "жёлтый", row: 0, col: 7, direction: "S" },
  { word: "январь", row: 0, col: 9, direction: "S" },
  { word: "сестра", row: 5, col: 0, direction: "E" },
  { word: "вопрос", row: 0, col: 0, direction: "S" },
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
  const firstCell = page.getByLabel("row 1 col 1", { exact: true });
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

function findPath(
  grid: string[][],
  word: string,
): { start: { row: number; col: number }; end: { row: number; col: number }; dir: readonly [number, number] } | null {
  const upper = word.toUpperCase();
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      for (const dir of DIRS) {
        const [dr, dc] = dir;
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
        if (matches) return { start: { row, col }, end: { row: endRow, col: endCol }, dir };
      }
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

async function dragSelect(page: Page, start: { row: number; col: number }, end: { row: number; col: number }) {
  const startBox = await page.locator(`button[data-row="${start.row}"][data-col="${start.col}"]`).boundingBox();
  const endBox = await page.locator(`button[data-row="${end.row}"][data-col="${end.col}"]`).boundingBox();
  if (!startBox || !endBox) throw new Error("missing cell bounding box");
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("word search: select a real word and see it struck through in the word list", async ({ page }) => {
  await page.goto("/es/word-games/WORD_SEARCH/A1/1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sopa de letras");

  const cellCount = await page.locator("button[data-row]").count();
  expect(cellCount).toBeGreaterThan(0);

  const grid = await readGrid(page);
  const words = await page.locator("ul li").allTextContents();
  expect(words.length).toBeGreaterThan(0);
  const targetWord = words[0].trim();

  const path = findPath(grid, targetWord);
  expect(path).not.toBeNull();
  if (!path) return;
  await dragSelect(page, path.start, path.end);

  const foundEntry = page.locator("ul li", { hasText: targetWord });
  await expect(foundEntry).toHaveClass(/line-through/);

  await page.screenshot({ path: "test-results/word-games-word-search.png" });
});

test("word search: diagonal words are findable and each found word gets a distinct highlight color", async ({ page }) => {
  // C1's densest rung (16x16, 16 words) — real content, not a synthetic
  // fixture, chosen because a dense grid is where the placement
  // algorithm's direction mix actually matters (a sparse grid can look
  // fine even with a cardinal-only bug).
  await page.goto("/es/word-games/WORD_SEARCH/C1/5");
  const grid = await readGrid(page);
  const words = await page.locator("ul li").allTextContents();
  expect(words.length).toBeGreaterThanOrEqual(3);

  for (const word of words.slice(0, 3)) {
    const trimmed = word.trim();
    const path = findPath(grid, trimmed);
    expect(path).not.toBeNull();
    if (!path) continue;
    await dragSelect(page, path.start, path.end);
    // Exact match, not `hasText` (substring) — this puzzle's word list can
    // contain one word inside another (e.g. "материальность" inside
    // "нематериальность"), which `hasText` would match ambiguously.
    await expect(page.locator("ul li").filter({ hasText: new RegExp(`^${trimmed}$`) })).toHaveClass(/line-through/);
  }

  // Each found word's chip must carry a DIFFERENT color class — the bug
  // report was that every found word shared the same green, making the
  // grid unreadable once several words were found.
  const chipClasses = await page.locator("ul li").evaluateAll((els) => els.slice(0, 3).map((el) => el.className));
  const hues = chipClasses.map((c) => c.match(/bg-(\w+)-500/)?.[1]);
  expect(new Set(hues).size).toBe(3);

  await page.screenshot({ path: "test-results/word-games-word-search-multicolor.png" });
});
