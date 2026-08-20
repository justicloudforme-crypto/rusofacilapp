import type { WordGameGrid, WordPlacement, WordSearchDirection } from "./types";
import { shuffle, type WordCandidate } from "./generation";

// Crossword placement only ever runs across (E) or down (S) — reusing
// WordSearchDirection's 8-way union since WordPlacement.direction is
// shared between both puzzle types, but only these two values ever appear
// in a CROSSWORD's `words`.
const ACROSS: WordSearchDirection = "E";
const DOWN: WordSearchDirection = "S";

interface Cell {
  letter: string;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function delta(dir: WordSearchDirection): { dr: number; dc: number } {
  return dir === ACROSS ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 };
}

/** True if placing `word` at (row,col) in `dir` is legal against the cells
 * already occupied: every overlapping cell must match letter-for-letter,
 * every cell immediately before/after the word (in its own direction)
 * must be empty (words can't run into each other end-to-end), and every
 * non-overlap cell's PERPENDICULAR neighbors must be empty (prevents two
 * parallel words sitting flush against each other with no crossing —
 * unreadable in a real crossword). Returns the intersection count, or -1
 * if illegal. */
function checkPlacement(
  word: string,
  row: number,
  col: number,
  dir: WordSearchDirection,
  occupied: Map<string, Cell>
): number {
  const { dr, dc } = delta(dir);
  let intersections = 0;

  const beforeKey = key(row - dr, col - dc);
  const afterKey = key(row + dr * word.length, col + dc * word.length);
  if (occupied.has(beforeKey) || occupied.has(afterKey)) return -1;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = occupied.get(key(r, c));

    if (existing) {
      if (existing.letter !== word[i]) return -1;
      intersections++;
      continue;
    }

    // Not an intersection here — the two cells perpendicular to travel
    // direction must be free, or a second word would sit flush alongside
    // this one without actually crossing it.
    const [p1r, p1c] = dir === ACROSS ? [r - 1, c] : [r, c - 1];
    const [p2r, p2c] = dir === ACROSS ? [r + 1, c] : [r, c + 1];
    if (occupied.has(key(p1r, p1c)) || occupied.has(key(p2r, p2c))) return -1;
  }

  return intersections;
}

function place(word: string, row: number, col: number, dir: WordSearchDirection, occupied: Map<string, Cell>): void {
  const { dr, dc } = delta(dir);
  for (let i = 0; i < word.length; i++) {
    occupied.set(key(row + dr * i, col + dc * i), { letter: word[i] });
  }
}

/** One attempt at building a crossword from `pool`, given a fixed word
 * order (already shuffled/sorted by the caller). Returns however many
 * words it managed to place — a single greedy pass, no backtracking
 * across words (retrying with a different order is the caller's job). */
/** Best-first builder: at every step, scores EVERY remaining candidate
 * word against EVERY currently-placed word's cells, and commits to
 * whichever single (word, placement) pair scores best overall — not just
 * the first workable spot for whichever word happens to be processed
 * next. Trying words in a fixed order (process word N, place it wherever
 * it fits, move to word N+1) reliably produced sparse, scattered grids
 * (observed: 14 words spanning 31x36) because a word with only one poor
 * placement option still got committed before a much better-fitting word
 * further down the list got a chance. Scoring: intersection count first,
 * then bounding-box growth (smaller wins) so the grid stays compact. */
function attemptBuild(
  words: WordCandidate[],
  rng: () => number
): { placements: (WordPlacement & { row: number; col: number })[]; occupied: Map<string, Cell> } {
  const occupied = new Map<string, Cell>();
  const placements: (WordPlacement & { row: number; col: number })[] = [];

  const [first, ...rest] = shuffle(words, rng);
  place(first.word, 0, 0, ACROSS, occupied);
  placements.push({ word: first.word, clue: first.clue, row: 0, col: 0, direction: ACROSS });

  let bbox = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
  function bboxGrowth(word: string, row: number, col: number, dir: WordSearchDirection): number {
    const { dr, dc } = delta(dir);
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    const newMinRow = Math.min(bbox.minRow, row, endRow);
    const newMaxRow = Math.max(bbox.maxRow, row, endRow);
    const newMinCol = Math.min(bbox.minCol, col, endCol);
    const newMaxCol = Math.max(bbox.maxCol, col, endCol);
    const oldArea = (bbox.maxRow - bbox.minRow + 1) * (bbox.maxCol - bbox.minCol + 1);
    const newArea = (newMaxRow - newMinRow + 1) * (newMaxCol - newMinCol + 1);
    return newArea - oldArea;
  }

  let remaining = rest;

  while (remaining.length > 0) {
    let best:
      | { candidateIdx: number; row: number; col: number; dir: WordSearchDirection; intersections: number; growth: number }
      | null = null;

    for (const [candidateIdx, candidate] of remaining.entries()) {
      for (const placed of placements) {
        const { dr, dc } = delta(placed.direction);
        const perpDir: WordSearchDirection = placed.direction === ACROSS ? DOWN : ACROSS;

        for (let j = 0; j < placed.word.length; j++) {
          const cellRow = placed.row + dr * j;
          const cellCol = placed.col + dc * j;
          const letter = placed.word[j];

          for (let i = 0; i < candidate.word.length; i++) {
            if (candidate.word[i] !== letter) continue;
            const startRow = perpDir === DOWN ? cellRow - i : cellRow;
            const startCol = perpDir === ACROSS ? cellCol - i : cellCol;
            const intersections = checkPlacement(candidate.word, startRow, startCol, perpDir, occupied);
            if (intersections <= 0) continue;
            const growth = bboxGrowth(candidate.word, startRow, startCol, perpDir);
            const better =
              !best ||
              intersections > best.intersections ||
              (intersections === best.intersections && growth < best.growth);
            if (better) {
              best = { candidateIdx, row: startRow, col: startCol, dir: perpDir, intersections, growth };
            }
          }
        }
      }
    }

    if (!best) break; // no remaining word can cross anything currently placed

    const candidate = remaining[best.candidateIdx];
    place(candidate.word, best.row, best.col, best.dir, occupied);
    placements.push({ word: candidate.word, clue: candidate.clue, row: best.row, col: best.col, direction: best.dir });
    const { dr, dc } = delta(best.dir);
    const endRow = best.row + dr * (candidate.word.length - 1);
    const endCol = best.col + dc * (candidate.word.length - 1);
    bbox = {
      minRow: Math.min(bbox.minRow, best.row, endRow),
      maxRow: Math.max(bbox.maxRow, best.row, endRow),
      minCol: Math.min(bbox.minCol, best.col, endCol),
      maxCol: Math.max(bbox.maxCol, best.col, endCol),
    };
    remaining = remaining.filter((_, idx) => idx !== best.candidateIdx);
  }

  return { placements, occupied };
}

/** Assigns standard crossword numbering: a cell gets a number if it starts
 * an across run (no letter immediately to its left, but one to the
 * right) or a down run (none above, one below) — the same cell gets one
 * shared number if it starts both. Mutates `placements` in place. */
function numberPlacements(placements: (WordPlacement & { row: number; col: number })[]): void {
  const startCells = new Set<string>();
  for (const p of placements) startCells.add(key(p.row, p.col));

  const sortedStarts = Array.from(startCells)
    .map((k) => k.split(",").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const numberByKey = new Map<string, number>();
  sortedStarts.forEach(([r, c], i) => numberByKey.set(key(r, c), i + 1));

  for (const p of placements) {
    p.number = numberByKey.get(key(p.row, p.col));
  }
}

/** Builds one crossword puzzle from `pool`, retrying with a reshuffled
 * word order up to `attempts` times and keeping the attempt that placed
 * the most words. Returns null if even the best attempt fell short of
 * `minWords` — the caller should treat that as a rejected puzzle, not
 * silently ship a sparse grid. */
export function buildCrossword(
  pool: WordCandidate[],
  targetWordCount: number,
  minWords: number,
  rng: () => number,
  attempts = 6
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  let bestResult: ReturnType<typeof attemptBuild> | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const ordered = shuffle(pool, rng).sort((a, b) => b.word.length - a.word.length);
    const trimmedPool = ordered.slice(0, Math.max(targetWordCount * 3, targetWordCount + 10));
    const result = attemptBuild(trimmedPool, rng);
    const capped = { ...result, placements: result.placements.slice(0, targetWordCount) };
    if (!bestResult || capped.placements.length > bestResult.placements.length) {
      bestResult = capped;
    }
    if (capped.placements.length >= targetWordCount) break;
  }

  if (!bestResult || bestResult.placements.length < minWords) return null;

  const { placements } = bestResult;
  // Only keep cells belonging to the placements we actually kept (an
  // over-generated attempt trimmed down to targetWordCount can leave
  // orphan letters from words that got cut) — rebuild `occupied` fresh
  // from the final placement list instead of trusting the build-time map.
  const finalOccupied = new Map<string, Cell>();
  for (const p of placements) {
    const { dr, dc } = delta(p.direction);
    for (let i = 0; i < p.word.length; i++) {
      finalOccupied.set(key(p.row + dr * i, p.col + dc * i), { letter: p.word[i] });
    }
  }

  numberPlacements(placements);

  const rows = placements.flatMap((p) => {
    const { dr } = delta(p.direction);
    return [p.row, p.row + dr * (p.word.length - 1)];
  });
  const cols = placements.flatMap((p) => {
    const { dc } = delta(p.direction);
    return [p.col, p.col + dc * (p.word.length - 1)];
  });
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);
  const height = Math.max(...rows) - minRow + 1;
  const width = Math.max(...cols) - minCol + 1;

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(""));
  for (const [k, cell] of finalOccupied) {
    const [r, c] = k.split(",").map(Number);
    grid[r - minRow][c - minCol] = cell.letter;
  }

  const normalizedWords: WordPlacement[] = placements.map((p) => ({
    word: p.word,
    clue: p.clue,
    row: p.row - minRow,
    col: p.col - minCol,
    direction: p.direction,
    number: p.number,
  }));

  return { grid: { size: Math.max(height, width), grid }, words: normalizedWords };
}
