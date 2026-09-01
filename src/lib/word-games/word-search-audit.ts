// Solver-side audit of a generated WORD_SEARCH puzzle: does every word on
// the list ACTUALLY lie in the grid, and is the grid roomy enough for the
// list it was given?
//
// Why a solver and not a re-read of the generator's own coordinates. The
// puzzle rows carry `row`/`col`/`direction` per word, written by
// prisma/generate-word-games.ts — but the player never sees those. The
// only thing that decides whether a word can be found is what
// src/lib/word-games/word-search-select.ts reads off `gridData` along the
// dragged line. So this module deliberately ignores the stored
// coordinates and searches the grid from scratch, exactly the way
// matchSelection matches: uppercase-normalized letters, straight ray in
// one of the 8 directions (a reversed reading is just the opposite
// direction), and for a curved/★ puzzle a non-repeating 8-adjacent path.
//
// Ignoring the coordinates is the point: a puzzle whose stored placement
// disagrees with its own grid is precisely the defect this has to catch,
// and a check that trusts the coordinates cannot see it.
import type { WordGamePuzzle } from "./types";

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

/** Same normalization matchSelection() applies before comparing. */
function norm(value: string): string {
  return value.trim().toUpperCase();
}

/** A straight ray in one of the 8 directions spelling `word`. */
export function findStraight(grid: string[][], word: string): { row: number; col: number; dr: number; dc: number } | null {
  const target = norm(word);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (target.length === 0 || rows === 0 || cols === 0) return null;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (const [dr, dc] of DIRS) {
        const endRow = row + dr * (target.length - 1);
        const endCol = col + dc * (target.length - 1);
        if (endRow < 0 || endRow >= rows || endCol < 0 || endCol >= cols) continue;
        let ok = true;
        for (let i = 0; i < target.length; i++) {
          if (norm(grid[row + dr * i][col + dc * i] ?? "") !== target[i]) {
            ok = false;
            break;
          }
        }
        if (ok) return { row, col, dr, dc };
      }
    }
  }
  return null;
}

/** A non-repeating 8-adjacent path spelling `word` — the rule a curved/★
 * puzzle plays by (extendPath, not extendPathStraight). Bounded: a bent
 * search is exponential in principle, and one pathological grid must not
 * hang a check that runs over the whole catalog. Hitting the bound is
 * reported as "unknown", never as "found" and never as "missing". */
export function findCurved(
  grid: string[][],
  word: string,
  maxSteps = 2_000_000,
): { found: boolean; exhausted: boolean } {
  const target = norm(word);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (target.length === 0 || rows === 0 || cols === 0) return { found: false, exhausted: false };

  let steps = 0;
  const used = new Set<number>();

  function walk(row: number, col: number, index: number): boolean {
    if (index === target.length) return true;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    const key = row * cols + col;
    if (used.has(key)) return false;
    if (norm(grid[row][col] ?? "") !== target[index]) return false;
    if (++steps > maxSteps) return false;
    used.add(key);
    for (const [dr, dc] of DIRS) {
      if (walk(row + dr, col + dc, index + 1)) {
        used.delete(key);
        return true;
      }
    }
    used.delete(key);
    return false;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (steps > maxSteps) return { found: false, exhausted: true };
      if (walk(row, col, 0)) return { found: true, exhausted: false };
    }
  }
  return { found: false, exhausted: steps > maxSteps };
}

export interface PuzzleAudit {
  id: string;
  level: string;
  sequence: number;
  curved: boolean;
  rows: number;
  cols: number;
  cells: number;
  wordCount: number;
  letters: number;
  /** Sum of word lengths ÷ cells. Overlaps are counted once per word, so
   * this is "how much of the grid the list demands", not "how much of the
   * grid is non-filler" — it can exceed 1. */
  density: number;
  longestWord: string;
  longestLength: number;
  minSide: number;
  maxSide: number;
  /** longestLength ÷ minSide. Above 1 the longest word cannot run along
   * the short axis (nor on any diagonal, whose length is capped by the
   * short side) — only along the long one. */
  longestOverMinSide: number;
  /** Above the long side too: the word cannot be placed at all. */
  impossibleByLength: boolean;
  missing: string[];
  /** Words whose curved search hit the step bound — neither confirmed nor
   * refuted. Kept separate so they can never be silently counted clean. */
  undecided: string[];
}

export interface PuzzleInput {
  id: string;
  level: string;
  sequence: number;
  curved: boolean;
  grid: string[][];
  words: { word: string }[];
}

export function auditPuzzle(puzzle: PuzzleInput): PuzzleAudit {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const cells = rows * cols;
  const words = puzzle.words.map((w) => w.word);
  const letters = words.reduce((sum, w) => sum + norm(w).length, 0);
  const longest = words.reduce((a, b) => (norm(b).length > norm(a).length ? b : a), words[0] ?? "");

  const missing: string[] = [];
  const undecided: string[] = [];
  for (const word of words) {
    if (puzzle.curved) {
      const { found, exhausted } = findCurved(puzzle.grid, word);
      if (found) continue;
      if (exhausted) undecided.push(word);
      else missing.push(word);
      continue;
    }
    if (!findStraight(puzzle.grid, word)) missing.push(word);
  }

  const minSide = Math.min(rows, cols);
  const maxSide = Math.max(rows, cols);
  const longestLength = norm(longest).length;

  return {
    id: puzzle.id,
    level: puzzle.level,
    sequence: puzzle.sequence,
    curved: puzzle.curved,
    rows,
    cols,
    cells,
    wordCount: words.length,
    letters,
    density: cells > 0 ? letters / cells : Infinity,
    longestWord: longest,
    longestLength,
    minSide,
    maxSide,
    longestOverMinSide: minSide > 0 ? longestLength / minSide : Infinity,
    impossibleByLength: longestLength > maxSide,
    missing,
    undecided,
  };
}

/** Parses one WordGamePuzzle row's JSON columns into solver input.
 * `gridData.size` is NOT trusted for the shape — the real row/column
 * counts come from the array itself (a puzzle whose `size` disagrees with
 * its grid is exactly the kind of thing worth finding).
 *
 * Returns null for a row whose JSON will not parse, rather than throwing:
 * one unreadable row must not take down a sweep over the whole catalogue,
 * and "this row is unreadable" is itself a finding the caller reports by
 * name — never a row silently dropped from the count. Same guarded shape
 * as lib/word-games/data.ts's own read of these two columns. */
export function puzzleInputFromRow(row: {
  id: string;
  level: string;
  sequence: number;
  curved: boolean;
  gridData: string;
  words: string;
}): PuzzleInput | null {
  try {
    const gridData = JSON.parse(row.gridData) as Pick<WordGamePuzzle["gridData"], "grid">;
    const words = JSON.parse(row.words) as { word: string }[];
    if (!Array.isArray(gridData?.grid) || !Array.isArray(words)) return null;
    return {
      id: row.id,
      level: row.level,
      sequence: row.sequence,
      curved: row.curved,
      grid: gridData.grid,
      words,
    };
  } catch {
    return null;
  }
}
