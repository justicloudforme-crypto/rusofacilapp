/**
 * Offline generator for WORD_SEARCH (Sopa de Letras) and CROSSWORD puzzles
 * — the only thing that ever writes WordGamePuzzle rows. The app reads
 * these back verbatim at request time; it never runs a placement
 * algorithm itself (see docs/plan-2026-08-19-three-windows.md, Window 1).
 *
 * Source words come straight from the existing FlashcardCard bank — no new
 * content, no LLM calls, nothing that costs money to (re)run.
 *
 * Deterministic: every puzzle's word selection and letter placement is
 * seeded from `${type}-${level}-${sequence}`, so re-running this script
 * without any FlashcardCard changes reproduces byte-identical puzzles
 * (upsert is then a no-op). Only a change to the word bank for a level
 * shifts that level's puzzles.
 *
 * Usage (against local dev.db, the default):
 *   npm run generate:word-games
 *
 * Usage (against production — same Turso credentials src/lib/db.ts uses):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run generate:word-games
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { WordGameGrid, WordPlacement, WordSearchDirection } from "../src/lib/word-games/types";
import { candidateWords, makeRng, shuffle, type WordCandidate } from "../src/lib/word-games/generation";
import { buildCrossword } from "../src/lib/word-games/crossword";
import { buildClue } from "../src/lib/word-games/clue";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

// One rung per level, growing in grid size + word count — the "simple to
// complex" progression the plan calls for. Self-paced like the rest of the
// app (see src/lib/flashcards/level-progress.ts): every rung stays
// playable, WordGameProgress only drives a completed-checkmark badge.
//
// Grid size is capped at 16x16 (rung 5) rather than growing indefinitely —
// CrosswordBoard/WordSearchBoard render with CSS grid's minmax(0,1fr), so a
// bigger grid never overflows the mobile viewport, but past ~16 columns the
// per-cell touch target gets uncomfortably small on a 390px-wide screen.
// Rungs 6-10 instead keep growing difficulty through word DENSITY (more
// words packed into the same 16x16 grid) — real replay content, not just a
// visual re-skin of rung 5, and still comfortable to play.
const WORD_SEARCH_RUNGS: Array<{ size: number; wordCount: number }> = [
  { size: 8, wordCount: 8 },
  { size: 10, wordCount: 10 },
  { size: 12, wordCount: 12 },
  { size: 14, wordCount: 14 },
  { size: 16, wordCount: 16 },
  { size: 16, wordCount: 18 },
  { size: 16, wordCount: 20 },
  { size: 16, wordCount: 22 },
  { size: 16, wordCount: 24 },
  { size: 16, wordCount: 26 },
];

// Crosswords need more candidate words per target than word search does
// (many candidates never find a valid intersection and get dropped), so
// the rungs stay smaller — a 12-word crossword is already a substantial
// puzzle, unlike a 12-word word-search grid. maxLen grows with sequence:
// shorter words share letters more densely (more intersection chances per
// letter), which keeps the easiest puzzles compact — a 6-word grid built
// from 12-letter words spans far more cells than one built from 5-letter
// words, even with the same intersection count.
//
// maxLen is capped at 12 (rung 5) for the same mobile-layout reason as
// WORD_SEARCH_RUNGS above — an individual word much longer than that
// would force a very wide/tall grid on its own. Rungs 6-10 grow difficulty
// through word count instead (more intersecting entries, same per-word
// length ceiling), which grows the grid gradually rather than in one leap.
const CROSSWORD_RUNGS: Array<{ wordCount: number; maxLen: number }> = [
  { wordCount: 6, maxLen: 6 },
  { wordCount: 8, maxLen: 7 },
  { wordCount: 10, maxLen: 8 },
  { wordCount: 12, maxLen: 10 },
  { wordCount: 14, maxLen: 12 },
  { wordCount: 16, maxLen: 12 },
  { wordCount: 18, maxLen: 12 },
  { wordCount: 20, maxLen: 12 },
  { wordCount: 22, maxLen: 12 },
  { wordCount: 24, maxLen: 12 },
];

const DIRECTIONS: Array<{ name: WordSearchDirection; dr: number; dc: number }> = [
  { name: "E", dr: 0, dc: 1 },
  { name: "W", dr: 0, dc: -1 },
  { name: "S", dr: 1, dc: 0 },
  { name: "N", dr: -1, dc: 0 },
  { name: "SE", dr: 1, dc: 1 },
  { name: "SW", dr: 1, dc: -1 },
  { name: "NE", dr: -1, dc: 1 },
  { name: "NW", dr: -1, dc: -1 },
];

// Approximate Russian letter frequency (relative weights, not exact
// corpus stats) — filler letters that "look Russian" instead of a flat
// uniform distribution, which reads as visibly wrong to a Russian-literate
// eye (too many rare letters like Ъ, Ё, Ц clustering together).
const FILLER_LETTERS = "оооооееееаааанннниииттсрввлкмдпуяызбгчйхжюшцщэфъё".split("");

/** All valid (conflict-free, in-bounds) starting cells for `word` placed
 * in one specific direction. */
function validStartsForDirection(
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
function tryPlaceWord(
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

function buildWordSearch(
  pool: WordCandidate[],
  size: number,
  targetCount: number,
  rng: () => number
): { grid: WordGameGrid; words: WordPlacement[] } | null {
  // Longest-first placement is far more likely to succeed than random
  // order — a long word has fewer valid positions, so it should claim
  // grid space before the short, easy-to-fit ones compete for it.
  const shuffled = shuffle(pool, rng).sort((a, b) => b.word.length - a.word.length);

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
function buildWordSearchWithGrowth(
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

async function upsertPuzzle(
  type: "WORD_SEARCH" | "CROSSWORD",
  level: string,
  sequence: number,
  built: { grid: WordGameGrid; words: WordPlacement[] },
  counters: { created: number; unchanged: number }
): Promise<void> {
  const gridData = JSON.stringify(built.grid);
  const words = JSON.stringify(built.words);

  const existing = await db.wordGamePuzzle.findUnique({
    where: { type_level_sequence: { type, level, sequence } },
  });
  if (existing && existing.gridData === gridData && existing.words === words) {
    counters.unchanged++;
    return;
  }

  await db.wordGamePuzzle.upsert({
    where: { type_level_sequence: { type, level, sequence } },
    create: { type, level, sequence, gridData, words },
    update: { gridData, words },
  });
  counters.created++;
}

async function main() {
  const counters = { created: 0, unchanged: 0 };
  const problems: string[] = [];

  for (const level of LEVELS) {
    const cards = await db.flashcardCard.findMany({
      where: { level },
      select: { russian: true, translationEs: true, exampleEs: true },
    });
    const clueForLevel = (card: { translationEs: string; exampleEs: string }) => buildClue(level, card);

    for (let rungIndex = 0; rungIndex < WORD_SEARCH_RUNGS.length; rungIndex++) {
      const sequence = rungIndex + 1;
      const rung = WORD_SEARCH_RUNGS[rungIndex];
      // Capped at size-2 (not size) so a word can never span the grid's
      // full row/column/diagonal on its own — a word exactly as long as
      // the grid claims an entire line with zero conflict risk against
      // parallel same-orientation words, which crowds out every other
      // orientation almost entirely (verified: A1's word bank is full of
      // exactly-8-letter words, and an 8x8 grid made rung 1 come out
      // nearly all-horizontal for exactly this reason). A couple of
      // cells of slack is enough for real crossing to become possible.
      const wordSearchMaxLen = Math.max(rung.size - 2, 4);
      const pool = candidateWords(cards, wordSearchMaxLen, clueForLevel);

      if (pool.length < 5) {
        problems.push(`WORD_SEARCH ${level} seq ${sequence}: only ${pool.length} eligible words (need >=5), skipped`);
        continue;
      }

      const built = buildWordSearchWithGrowth(pool, rung.size, rung.wordCount, `WORD_SEARCH-${level}-${sequence}`);
      if (!built) {
        problems.push(`WORD_SEARCH ${level} seq ${sequence}: generator could not place enough words, skipped`);
        continue;
      }
      if (built.words.length < rung.wordCount) {
        problems.push(
          `WORD_SEARCH ${level} seq ${sequence}: only fit ${built.words.length}/${rung.wordCount} target words even after growing to ${built.grid.size}x${built.grid.size} (word list itself is still fully consistent with the grid)`
        );
      }

      await upsertPuzzle("WORD_SEARCH", level, sequence, built, counters);
      console.log(`  [WORD_SEARCH/${level}/${sequence}] ${built.words.length} words in a ${built.grid.size}x${built.grid.size} grid`);
    }

    for (let rungIndex = 0; rungIndex < CROSSWORD_RUNGS.length; rungIndex++) {
      const sequence = rungIndex + 1;
      const rung = CROSSWORD_RUNGS[rungIndex];
      const rng = makeRng(`CROSSWORD-${level}-${sequence}`);
      const pool = candidateWords(cards, rung.maxLen, clueForLevel);

      if (pool.length < rung.wordCount) {
        problems.push(`CROSSWORD ${level} seq ${sequence}: only ${pool.length} eligible words (need >=${rung.wordCount}), skipped`);
        continue;
      }

      const minWords = Math.min(rung.wordCount, 6);
      const built = buildCrossword(pool, rung.wordCount, minWords, rng);
      if (!built) {
        problems.push(`CROSSWORD ${level} seq ${sequence}: generator could not reach ${minWords} intersecting words, skipped`);
        continue;
      }

      await upsertPuzzle("CROSSWORD", level, sequence, built, counters);
      console.log(
        `  [CROSSWORD/${level}/${sequence}] ${built.words.length} words in a ${built.grid.grid.length}x${built.grid.grid[0].length} grid`
      );
    }
  }

  console.log(`\n${counters.created} puzzle(s) written, ${counters.unchanged} already up to date.`);
  if (problems.length > 0) {
    console.log(`\n${problems.length} rung(s) skipped:`);
    for (const p of problems) console.log(`  - ${p}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
