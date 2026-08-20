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
import type { WordGameGrid, WordPlacement } from "../src/lib/word-games/types";
import { candidateWords, makeRng } from "../src/lib/word-games/generation";
import { buildCrossword } from "../src/lib/word-games/crossword";
import { buildWordSearchWithGrowth } from "../src/lib/word-games/word-search";
import { buildSnakeWordSearchWithGrowth } from "../src/lib/word-games/snake-word-search";
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
// Rungs 11-20 are a second "lap" at the 16x16 ceiling — each still draws a
// fresh, independently-seeded random subset of the level's word pool (see
// generation.ts's makeRng, keyed on `${type}-${level}-${sequence}`), so
// these aren't reruns of rungs 1-10 with a new number slapped on; they're
// genuinely different puzzles. wordCount deliberately doesn't just keep
// climbing past rung 10 (real replay content shouldn't feel like an
// infinite grind toward a bigger number) — it varies non-monotonically so
// consecutive rungs feel distinct rather than a flat continuation.
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
  { size: 16, wordCount: 17 },
  { size: 16, wordCount: 25 },
  { size: 16, wordCount: 19 },
  { size: 16, wordCount: 23 },
  { size: 16, wordCount: 21 },
  { size: 16, wordCount: 18 },
  { size: 16, wordCount: 26 },
  { size: 16, wordCount: 20 },
  { size: 16, wordCount: 24 },
  { size: 16, wordCount: 22 },
  // Third lap (21-30) — same rationale, another independently-seeded
  // random draw per rung.
  { size: 16, wordCount: 16 },
  { size: 16, wordCount: 23 },
  { size: 16, wordCount: 19 },
  { size: 16, wordCount: 26 },
  { size: 16, wordCount: 21 },
  { size: 16, wordCount: 17 },
  { size: 16, wordCount: 25 },
  { size: 16, wordCount: 18 },
  { size: 16, wordCount: 24 },
  { size: 16, wordCount: 20 },
];

// Expert/★ tier, appended right after WORD_SEARCH_RUNGS (currently
// starting at sequence 31) — same picker grid, just badged, not a separate
// type/tab (see the plan this shipped from). Kept smaller than the
// straight rungs' word counts:
// a bending path uses more of its own "personal space" (can't run
// adjacent to itself) than a straight line does, so packing as many
// curved words into one grid is inherently harder.
const WORD_SEARCH_STAR_RUNGS: Array<{ size: number; wordCount: number }> = [
  { size: 10, wordCount: 6 },
  { size: 12, wordCount: 8 },
  { size: 14, wordCount: 10 },
  { size: 10, wordCount: 7 },
  { size: 12, wordCount: 9 },
  { size: 14, wordCount: 11 },
  { size: 16, wordCount: 12 },
  { size: 16, wordCount: 14 },
  { size: 10, wordCount: 6 },
  { size: 12, wordCount: 8 },
  { size: 14, wordCount: 10 },
  { size: 16, wordCount: 13 },
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
// Rungs 11-20, same "second lap" rationale as WORD_SEARCH_RUNGS above —
// fresh seeded word subsets, non-monotonic wordCount/maxLen so each rung
// reads as its own puzzle rather than a mechanical continuation of 1-10.
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
  { wordCount: 16, maxLen: 8 },
  { wordCount: 26, maxLen: 12 },
  { wordCount: 18, maxLen: 9 },
  { wordCount: 28, maxLen: 12 },
  { wordCount: 20, maxLen: 10 },
  { wordCount: 22, maxLen: 11 },
  { wordCount: 14, maxLen: 7 },
  { wordCount: 25, maxLen: 12 },
  { wordCount: 21, maxLen: 10 },
  { wordCount: 24, maxLen: 11 },
  // Third lap (21-30) — same rationale, wordCount deliberately stays
  // within the range already established above rather than climbing
  // further, since a longer target list means a sprawlier grid (the
  // algorithm optimizes for intersections, not squareness) and rungs
  // past ~24 words already produce a distinctly wide/tall board.
  { wordCount: 8, maxLen: 6 },
  { wordCount: 12, maxLen: 9 },
  { wordCount: 17, maxLen: 12 },
  { wordCount: 22, maxLen: 10 },
  { wordCount: 15, maxLen: 8 },
  { wordCount: 26, maxLen: 12 },
  { wordCount: 10, maxLen: 7 },
  { wordCount: 19, maxLen: 11 },
  { wordCount: 23, maxLen: 12 },
  { wordCount: 13, maxLen: 9 },
];

async function upsertPuzzle(
  type: "WORD_SEARCH" | "CROSSWORD",
  level: string,
  sequence: number,
  curved: boolean,
  built: { grid: WordGameGrid; words: WordPlacement[] },
  counters: { created: number; unchanged: number }
): Promise<void> {
  const gridData = JSON.stringify(built.grid);
  const words = JSON.stringify(built.words);

  const existing = await db.wordGamePuzzle.findUnique({
    where: { type_level_sequence: { type, level, sequence } },
  });
  if (existing && existing.curved === curved && existing.gridData === gridData && existing.words === words) {
    counters.unchanged++;
    return;
  }

  await db.wordGamePuzzle.upsert({
    where: { type_level_sequence: { type, level, sequence } },
    create: { type, level, sequence, curved, gridData, words },
    update: { curved, gridData, words },
  });
  counters.created++;
}

// Highest sequence number this script will ever write for each type — the
// straight rungs plus (for WORD_SEARCH only) the star tier appended after
// them. Used purely for the cleanup pass below.
const MAX_WORD_SEARCH_SEQUENCE = WORD_SEARCH_RUNGS.length + WORD_SEARCH_STAR_RUNGS.length;
const MAX_CROSSWORD_SEQUENCE = CROSSWORD_RUNGS.length;

/** Deletes any WordGamePuzzle row past the current max sequence for its
 * type/level — rows `upsertPuzzle` above can never touch since it only
 * ever writes sequences 1..max. Without this, shrinking a rungs array (or
 * — the way this bit us once already — changing WORD_SEARCH_RUNGS.length,
 * which shifts where the star tier's sequence numbers start) leaves
 * stale rows sitting in the DB forever, since `upsert` only ever
 * creates/updates, never deletes. Those orphans are silently invisible
 * in the picker today only because `countSequences` is a raw row COUNT
 * and the picker assumes sequences are contiguous 1..count — an orphan
 * gap would make that assumption false and hand a player a tile that
 * links to a puzzle sequence nothing ever generated (a 404, at best).
 * Run every time so the DB can never drift out of sync with what these
 * rung tables currently define, regardless of how they're edited later. */
async function cleanupStaleSequences(): Promise<number> {
  const [ws, cw] = await Promise.all([
    db.wordGamePuzzle.deleteMany({ where: { type: "WORD_SEARCH", sequence: { gt: MAX_WORD_SEARCH_SEQUENCE } } }),
    db.wordGamePuzzle.deleteMany({ where: { type: "CROSSWORD", sequence: { gt: MAX_CROSSWORD_SEQUENCE } } }),
  ]);
  return ws.count + cw.count;
}

async function main() {
  const counters = { created: 0, unchanged: 0 };
  const problems: string[] = [];

  for (const level of LEVELS) {
    const cards = await db.flashcardCard.findMany({
      where: { level },
      select: { russian: true, translationEs: true, exampleEs: true },
    });
    const crosswordClueForLevel = (card: { translationEs: string; exampleEs: string }) => buildClue(level, card);
    // WORD_SEARCH never masks — unlike a crossword, there's no blank to
    // spoil (the letters are already fully visible in the grid), so a
    // masked example sentence there is just confusing, not protective.
    // Direct translation is a straightforward vocabulary aid instead.
    const wordSearchClue = (card: { translationEs: string }) => card.translationEs;

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
      const pool = candidateWords(cards, wordSearchMaxLen, wordSearchClue);

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

      await upsertPuzzle("WORD_SEARCH", level, sequence, false, built, counters);
      console.log(`  [WORD_SEARCH/${level}/${sequence}] ${built.words.length} words in a ${built.grid.size}x${built.grid.size} grid`);
    }

    for (let starIndex = 0; starIndex < WORD_SEARCH_STAR_RUNGS.length; starIndex++) {
      const sequence = WORD_SEARCH_RUNGS.length + starIndex + 1;
      const rung = WORD_SEARCH_STAR_RUNGS[starIndex];
      // Curved words need real segments to bend through — a word shorter
      // than 5 letters is too cramped to produce an interesting curve
      // even though 4 is the hard geometric floor (see
      // buildSnakeWordSearch's own length guard for the floor itself).
      const wordSearchMaxLen = Math.max(rung.size - 2, 5);
      const pool = candidateWords(cards, wordSearchMaxLen, wordSearchClue, 5);

      if (pool.length < 5) {
        problems.push(`WORD_SEARCH★ ${level} seq ${sequence}: only ${pool.length} eligible words (need >=5), skipped`);
        continue;
      }

      const built = buildSnakeWordSearchWithGrowth(pool, rung.size, rung.wordCount, `WORD_SEARCH_STAR-${level}-${sequence}`);
      if (!built) {
        problems.push(`WORD_SEARCH★ ${level} seq ${sequence}: generator could not place enough curved words, skipped`);
        continue;
      }
      if (built.words.length < rung.wordCount) {
        problems.push(
          `WORD_SEARCH★ ${level} seq ${sequence}: only fit ${built.words.length}/${rung.wordCount} target words even after growing to ${built.grid.size}x${built.grid.size}`
        );
      }

      await upsertPuzzle("WORD_SEARCH", level, sequence, true, built, counters);
      console.log(`  [WORD_SEARCH★/${level}/${sequence}] ${built.words.length} curved words in a ${built.grid.size}x${built.grid.size} grid`);
    }

    for (let rungIndex = 0; rungIndex < CROSSWORD_RUNGS.length; rungIndex++) {
      const sequence = rungIndex + 1;
      const rung = CROSSWORD_RUNGS[rungIndex];
      const rng = makeRng(`CROSSWORD-${level}-${sequence}`);
      const pool = candidateWords(cards, rung.maxLen, crosswordClueForLevel);

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

      await upsertPuzzle("CROSSWORD", level, sequence, false, built, counters);
      console.log(
        `  [CROSSWORD/${level}/${sequence}] ${built.words.length} words in a ${built.grid.grid.length}x${built.grid.grid[0].length} grid`
      );
    }
  }

  const deleted = await cleanupStaleSequences();
  if (deleted > 0) console.log(`\nDeleted ${deleted} stale puzzle row(s) past the current rung tables' range.`);

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
