// Straight-line WORD_SEARCH placement — one of two placement algorithms
// (see snake-word-search.ts for the curved/"star" tier). Extracted out of
// prisma/generate-word-games.ts so it's directly unit-testable, mirroring
// crossword.ts's existing split from the same script.
import type { WordGameGrid, WordPlacement, WordSearchDirection } from "./types";
import { makeRng, shuffle, type WordCandidate } from "./generation";

export const DIRECTIONS: Array<{ name: WordSearchDirection; dr: number; dc: number }> = [
  { name: "E", dr: 0, dc: 1 },
  { name: "W", dr: 0, dc: -1 },
  { name: "S", dr: 1, dc: 0 },
  { name: "N", dr: -1, dc: 0 },
  { name: "SE", dr: 1, dc: 1 },
  { name: "SW", dr: 1, dc: -1 },
  { name: "NE", dr: -1, dc: 1 },
  { name: "NW", dr: -1, dc: -1 },
];

// Approximate Russian letter frequency (relative weights, not exact corpus
// stats) — filler letters that "look Russian" instead of a flat uniform
// distribution, which reads as visibly wrong to a Russian-literate eye
// (too many rare letters like Ъ, Ё, Ц clustering together).
export const FILLER_LETTERS = "оооооееееаааанннниииттсрввлкмдпуяызбгчйхжюшцщэфъё".split("");

/** All valid (conflict-free, in-bounds) starting cells for `word` placed
 * in one specific direction. */
export function validStartsForDirection(
  grid: string[][],
  size: number,
  word: string,
  dir: { dr: number; dc: number }
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const endRow = row + dir.dr * (word.length - 1);
      const endCol = col + dir.dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + dir.dr * i;
        const c = col + dir.dc * i;
        const existing = grid[r][c];
        if (existing !== "" && existing !== word[i]) {
          fits = false;
          break;
        }
      }
      if (fits) out.push({ row, col });
    }
  }
  return out;
}

/** Picks a direction among the ones that have at least one legal spot for
 * this word, preferring whichever direction(s) this puzzle has used
 * *least so far* (ties broken randomly), then a random spot within it.
 *
 * Weighting every available direction equally per word (an earlier
 * version of this function) still came out cardinal-heavy in practice:
 * on a square grid, a cardinal direction (E/W/S/N) has roughly `size`
 * candidate starts for a given word length, while a diagonal has roughly
 * `(size - word.length + 1)²` — quadratically fewer as the word gets
 * longer relative to the grid. As the grid fills up over the course of
 * placing a puzzle's words, diagonals are the first to run out of valid
 * starts entirely (dropping out of contention), while cardinals still
 * have room — so later words default to cardinal not by unfair
 * weighting but by diagonals genuinely having nothing left. Actively
 * tracking usage and favoring the least-used direction corrects for
 * that: once a direction has been used a few times, it stops competing
 * for the earliest, roomiest slots and leaves them to whichever
 * direction is behind. */
export function tryPlaceWord(
  grid: string[][],
  size: number,
  word: string,
  rng: () => number,
  directionUsage: Record<WordSearchDirection, number>
): { row: number; col: number; direction: WordSearchDirection } | null {
  const dirs = shuffle(DIRECTIONS, rng);
  const candidates: { dir: (typeof DIRECTIONS)[number]; starts: { row: number; col: number }[] }[] = [];
  for (const dir of dirs) {
    const starts = validStartsForDirection(grid, size, word, dir);
    if (starts.length > 0) candidates.push({ dir, starts });
  }
  if (candidates.length === 0) return null;

  const minUsage = Math.min(...candidates.map((c) => directionUsage[c.dir.name]));
  const leastUsed = candidates.filter((c) => directionUsage[c.dir.name] === minUsage);
  const { dir, starts } = leastUsed[Math.floor(rng() * leastUsed.length)];
  const start = starts[Math.floor(rng() * starts.length)];

  for (let i = 0; i < word.length; i++) {
    const r = start.row + dir.dr * i;
    const c = start.col + dir.dc * i;
    grid[r][c] = word[i];
  }
  directionUsage[dir.name]++;
  return { row: start.row, col: start.col, direction: dir.name };
}

export function buildWordSearch(
  pool: WordCandidate[],
  size: number,
  targetCount: number,
  rng: () => number
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  // Longest-first placement is far more likely to succeed than random
  // order — a long word has fewer valid positions, so it should claim
  // grid space before the short, easy-to-fit ones compete for it. But
  // sorting the *entire* pool by length before picking is what a real
  // content-diversity bug turned out to hinge on: the handful of longest
  // words in a level's whole bank (e.g. A1 has only ~12 words at 11-12
  // letters) would then win a placement slot in nearly every puzzle that
  // needs long words, regardless of seed — verified directly, one word
  // ("здравствуйте") appeared in 17 of 20 A1 rungs. Restricting the
  // length-sort to a randomly-shuffled *window* (a few times targetCount)
  // keeps the placement-order heuristic locally while letting which long
  // words show up vary puzzle to puzzle; the untouched remainder is still
  // appended (also length-sorted) as a fallback so a small/thin pool still
  // reaches targetCount exactly as before.
  const shuffledPool = shuffle(pool, rng);
  const windowSize = Math.min(shuffledPool.length, targetCount * 4);
  const primary = shuffledPool.slice(0, windowSize).sort((a, b) => b.word.length - a.word.length);
  const rest = shuffledPool.slice(windowSize).sort((a, b) => b.word.length - a.word.length);
  const shuffled = [...primary, ...rest];

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placements: WordPlacement[] = [];
  const directionUsage: Record<WordSearchDirection, number> = { E: 0, W: 0, S: 0, N: 0, SE: 0, SW: 0, NE: 0, NW: 0 };

  for (const entry of shuffled) {
    if (placements.length >= targetCount) break;
    if (entry.word.length > size) continue;
    const placed = tryPlaceWord(grid, size, entry.word, rng, directionUsage);
    if (placed) {
      placements.push({ word: entry.word, clue: entry.clue, ...placed });
    }
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

/** Retries buildWordSearch at progressively larger grid sizes until the
 * full target word count actually fits, instead of silently shipping a
 * puzzle that's short of its advertised word list — a fixed grid area
 * can only hold so many (especially long, C1-length) words before
 * running out of room, no matter how large the candidate pool is. Caps
 * growth at baseSize+10 so a puzzle can't balloon indefinitely; if even
 * that can't fit the target, returns the largest attempt reached (still
 * self-consistent — every word in `words` really is in the grid — just
 * short of the intended count, which the caller reports as a problem). */
export function buildWordSearchWithGrowth(
  pool: WordCandidate[],
  baseSize: number,
  targetCount: number,
  seedPrefix: string
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  const maxSize = baseSize + 10;
  let best: { grid: WordGameGrid; words: WordPlacement[] } | null = null;
  for (let size = baseSize; size <= maxSize; size += 2) {
    const rng = makeRng(`${seedPrefix}-grow${size}`);
    const built = buildWordSearch(pool, size, targetCount, rng);
    if (built && (!best || built.words.length > best.words.length)) best = built;
    if (built && built.words.length >= targetCount) return built;
  }
  return best;
}
