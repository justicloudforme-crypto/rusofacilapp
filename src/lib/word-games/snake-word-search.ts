// Curved ("snake") WORD_SEARCH placement — the expert/★ tier. Unlike the
// straight-line placer (word-search.ts), a word here is an ordered path of
// 8-adjacent cells that's free to change direction mid-word. Built as a
// randomized backtracking walk: extend one adjacent, non-conflicting,
// not-yet-used-by-this-word cell at a time, backtrack on dead ends.
import type { WordGameGrid, WordPlacement, WordSearchDirection } from "./types";
import { makeRng, shuffle, type WordCandidate } from "./generation";
import { DIRECTIONS, FILLER_LETTERS } from "./word-search";

export interface Cell {
  row: number;
  col: number;
}

// A path with fewer bends than this is indistinguishable from (or barely
// different than) a straight word, which defeats the point of a "curved"
// puzzle — reject it and keep searching for a genuinely bending one.
export const MIN_BENDS = 2;

/** Number of direction changes along a path. */
export function countBends(path: Cell[]): number {
  if (path.length < 3) return 0;
  let bends = 0;
  let prevDelta: [number, number] | null = null;
  for (let i = 1; i < path.length; i++) {
    const delta: [number, number] = [path[i].row - path[i - 1].row, path[i].col - path[i - 1].col];
    if (prevDelta && (delta[0] !== prevDelta[0] || delta[1] !== prevDelta[1])) bends++;
    prevDelta = delta;
  }
  return bends;
}

/** True if every consecutive pair of cells is one of the 8 neighbors
 * (never a jump, never the same cell twice in a row) — the structural
 * invariant every curved placement must satisfy. */
export function isAdjacentPath(path: Cell[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const dr = path[i].row - path[i - 1].row;
    const dc = path[i].col - path[i - 1].col;
    if (dr === 0 && dc === 0) return false;
    if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return false;
  }
  return true;
}

function directionOf(dr: number, dc: number): WordSearchDirection {
  const match = DIRECTIONS.find((d) => d.dr === dr && d.dc === dc);
  return match?.name ?? "E";
}

/** One bounded backtracking search for a single word: tries every starting
 * cell (shuffled) and, from each, walks one adjacent cell at a time
 * (shuffled direction order at every step), backtracking whenever a step
 * conflicts with another word's letter, revisits a cell already used by
 * this same word, or leaves the grid. A complete path that doesn't clear
 * MIN_BENDS is treated as a dead end too — the search keeps looking for a
 * curvier alternative rather than settling for a straight-ish walk. The
 * call budget bounds total work so a hard word/crowded grid can't hang the
 * generator; exceeding it just means this word doesn't fit right now, same
 * tolerance as the straight placer skipping a word that won't fit. */
function attemptWalk(grid: string[][], size: number, word: string, rng: () => number, maxCalls = 20000): Cell[] | null {
  let calls = 0;

  function backtrack(path: Cell[], visited: Set<string>): Cell[] | null {
    calls++;
    if (calls > maxCalls) return null;

    if (path.length === word.length) {
      return countBends(path) >= MIN_BENDS ? path : null;
    }

    const last = path[path.length - 1];
    const nextLetter = word[path.length];
    for (const dir of shuffle(DIRECTIONS, rng)) {
      const r = last.row + dir.dr;
      const c = last.col + dir.dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      const existing = grid[r][c];
      if (existing !== "" && existing !== nextLetter) continue;

      path.push({ row: r, col: c });
      visited.add(key);
      const result = backtrack(path, visited);
      if (result) return result;
      path.pop();
      visited.delete(key);
      if (calls > maxCalls) return null;
    }
    return null;
  }

  const starts = shuffle(
    Array.from({ length: size * size }, (_, i) => ({ row: Math.floor(i / size), col: i % size })),
    rng
  );
  for (const start of starts) {
    if (calls > maxCalls) break;
    const existing0 = grid[start.row][start.col];
    if (existing0 !== "" && existing0 !== word[0]) continue;
    const path = backtrack([start], new Set([`${start.row},${start.col}`]));
    if (path) return path;
  }
  return null;
}

export function buildSnakeWordSearch(
  pool: WordCandidate[],
  size: number,
  targetCount: number,
  rng: () => number,
  usage?: Map<string, number>
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  // Longest-first, same reasoning as the straight placer: a long word has
  // fewer valid paths, so it should claim space before short ones compete.
  // Windowed the same way word-search.ts's buildWordSearch is, and for the
  // identical reason: sorting the whole pool by length made a level's few
  // longest words win a slot in nearly every puzzle regardless of seed.
  // `usage` (optional, tracked across a whole level's rungs by the caller)
  // deprioritizes already-overused words the same way — see
  // buildWordSearch's doc comment for the full story and why an omitted
  // usage map is a no-op that preserves prior behavior exactly.
  const shuffledPool = shuffle(pool, rng);
  const byUsage = usage
    ? shuffledPool.slice().sort((a, b) => (usage.get(a.word) ?? 0) - (usage.get(b.word) ?? 0))
    : shuffledPool;
  const windowSize = Math.min(byUsage.length, targetCount * 4);
  const primary = byUsage.slice(0, windowSize).sort((a, b) => b.word.length - a.word.length);
  const rest = byUsage.slice(windowSize).sort((a, b) => b.word.length - a.word.length);
  const shuffled = [...primary, ...rest];

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placements: WordPlacement[] = [];

  for (const entry of shuffled) {
    if (placements.length >= targetCount) break;
    if (entry.word.length > size * size) continue;
    // A word of length N has only N-2 possible bend points (N-1 straight
    // segments, N-2 seams between them) — shorter than MIN_BENDS+2 and no
    // path through it can ever clear MIN_BENDS, so attemptWalk would just
    // burn its whole budget for a guaranteed null. Skip it outright.
    if (entry.word.length < MIN_BENDS + 2) continue;
    const path = attemptWalk(grid, size, entry.word, rng);
    if (!path) continue;

    for (let i = 0; i < entry.word.length; i++) grid[path[i].row][path[i].col] = entry.word[i];
    placements.push({
      word: entry.word,
      clue: entry.clue,
      row: path[0].row,
      col: path[0].col,
      // Only meaningful as "the first step's direction" — curved-word
      // consumers must read `path`, not this, for the real shape.
      direction: directionOf(path[1].row - path[0].row, path[1].col - path[0].col),
      path,
    });
  }

  if (placements.length < Math.min(targetCount, 5)) return null; // degenerate puzzle, reject

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = FILLER_LETTERS[Math.floor(rng() * FILLER_LETTERS.length)];
      }
    }
  }

  return { grid: { size, grid }, words: placements };
}

/** Same growth-retry shape as buildWordSearchWithGrowth — a fixed grid can
 * run out of room for the target word count, more so here since curved
 * paths use more cells per word on average (bending wastes some straight-
 * line efficiency) than a tight straight placement. */
export function buildSnakeWordSearchWithGrowth(
  pool: WordCandidate[],
  baseSize: number,
  targetCount: number,
  seedPrefix: string,
  usage?: Map<string, number>
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  const maxSize = baseSize + 10;
  let best: { grid: WordGameGrid; words: WordPlacement[] } | null = null;
  for (let size = baseSize; size <= maxSize; size += 2) {
    const rng = makeRng(`${seedPrefix}-grow${size}`);
    const built = buildSnakeWordSearch(pool, size, targetCount, rng, usage);
    if (built && (!best || built.words.length > best.words.length)) best = built;
    if (built && built.words.length >= targetCount) return built;
  }
  return best;
}
