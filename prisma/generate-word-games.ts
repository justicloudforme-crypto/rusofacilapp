/**
 * Offline generator for WORD_SEARCH (Sopa de Letras) puzzles — the only
 * thing that ever writes WordGamePuzzle rows. The app reads these back
 * verbatim at request time; it never runs a placement algorithm itself
 * (see docs/plan-2026-08-19-three-windows.md, Window 1).
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
 * CROSSWORD is not implemented here yet — word-intersection placement is a
 * substantially harder constraint problem and gets its own pass; see the
 * plan doc for the intended algorithm.
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

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

// One rung per level, growing in grid size + word count — the "simple to
// complex" progression the plan calls for. A student clears rung N before
// rung N+1 unlocks (enforced by the app reading WordGameProgress, not here).
const RUNGS: Array<{ size: number; wordCount: number }> = [
  { size: 8, wordCount: 8 },
  { size: 10, wordCount: 10 },
  { size: 12, wordCount: 12 },
  { size: 14, wordCount: 14 },
  { size: 16, wordCount: 16 },
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
const FILLER_LETTERS =
  "оооооееееаааанннниииттсрввлкмдпуяызбгчйхжюшцщэфъё".split("");

// mulberry32 — tiny deterministic PRNG so a given (type, level, sequence)
// always produces the same puzzle from the same word pool.
function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = h >>> 0;
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A word is grid-friendly if it's a single unbroken run of Cyrillic
// letters (no spaces/hyphens) and fits the smallest grid we generate.
const SINGLE_CYRILLIC_WORD = /^[а-яё]+$/i;

function candidateWords(cards: { russian: string; translationEs: string }[], maxLen: number) {
  const seen = new Set<string>();
  const out: { word: string; clue: string }[] = [];
  for (const card of cards) {
    const word = card.russian.trim().toLowerCase();
    if (!SINGLE_CYRILLIC_WORD.test(word)) continue;
    if (word.length < 3 || word.length > maxLen) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push({ word, clue: card.translationEs });
  }
  return out;
}

function tryPlaceWord(
  grid: string[][],
  size: number,
  word: string,
  rng: () => number
): { row: number; col: number; direction: WordSearchDirection } | null {
  const dirs = shuffle(DIRECTIONS, rng);
  const starts = shuffle(
    Array.from({ length: size * size }, (_, i) => ({ row: Math.floor(i / size), col: i % size })),
    rng
  );

  for (const dir of dirs) {
    for (const start of starts) {
      const endRow = start.row + dir.dr * (word.length - 1);
      const endCol = start.col + dir.dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = start.row + dir.dr * i;
        const c = start.col + dir.dc * i;
        const existing = grid[r][c];
        if (existing !== "" && existing !== word[i]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      for (let i = 0; i < word.length; i++) {
        const r = start.row + dir.dr * i;
        const c = start.col + dir.dc * i;
        grid[r][c] = word[i];
      }
      return { row: start.row, col: start.col, direction: dir.name };
    }
  }
  return null;
}

function buildWordSearch(
  pool: { word: string; clue: string }[],
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

  for (const entry of shuffled) {
    if (placements.length >= targetCount) break;
    if (entry.word.length > size) continue;
    const placed = tryPlaceWord(grid, size, entry.word, rng);
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

async function main() {
  let created = 0;
  let unchanged = 0;
  const problems: string[] = [];

  for (const level of LEVELS) {
    const cards = await db.flashcardCard.findMany({
      where: { level },
      select: { russian: true, translationEs: true },
    });

    for (let rungIndex = 0; rungIndex < RUNGS.length; rungIndex++) {
      const sequence = rungIndex + 1;
      const rung = RUNGS[rungIndex];
      const rng = makeRng(`WORD_SEARCH-${level}-${sequence}`);
      const pool = candidateWords(cards, rung.size);

      if (pool.length < 5) {
        problems.push(`${level} seq ${sequence}: only ${pool.length} eligible words (need >=5), skipped`);
        continue;
      }

      const built = buildWordSearch(pool, rung.size, rung.wordCount, rng);
      if (!built) {
        problems.push(`${level} seq ${sequence}: generator could not place enough words, skipped`);
        continue;
      }

      const gridData = JSON.stringify(built.grid);
      const words = JSON.stringify(built.words);

      const existing = await db.wordGamePuzzle.findUnique({
        where: { type_level_sequence: { type: "WORD_SEARCH", level, sequence } },
      });
      if (existing && existing.gridData === gridData && existing.words === words) {
        unchanged++;
        continue;
      }

      await db.wordGamePuzzle.upsert({
        where: { type_level_sequence: { type: "WORD_SEARCH", level, sequence } },
        create: { type: "WORD_SEARCH", level, sequence, gridData, words },
        update: { gridData, words },
      });
      created++;
      console.log(`  [WORD_SEARCH/${level}/${sequence}] ${built.words.length} words in a ${rung.size}x${rung.size} grid`);
    }
  }

  console.log(`\n${created} puzzle(s) written, ${unchanged} already up to date.`);
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
