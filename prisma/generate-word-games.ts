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
 *
 * Scoping and safety flags:
 *   --dry-run    report every row that WOULD be written, write nothing
 *   --only=free  restrict the run to the 80 free puzzles (A1-B2, rungs
 *                1-10, both types) — the only ones this project themes
 *
 * Against production, always --dry-run first, then --only=. A full
 * unscoped production run rewrites all ~3000 rows and is not what a
 * content change to the free tier needs.
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
import { categoryForTopic, topicForPuzzle } from "../src/lib/word-games/topics";
import { WORD_GAME_FREE_RUNGS_PER_LEVEL, isFreeWordGamePuzzle } from "../src/lib/word-games/free-tier";
import { densityTailCount, isDensityOwnedRung } from "../src/lib/word-games/density-rungs";

import { isEntryPoint } from "../src/lib/entry-point";
const DRY_RUN = process.argv.includes("--dry-run");
/**
 * Rewrite rows that already exist but whose content differs from what this
 * run built. OFF by default, and that default is the safety property this
 * script leans on.
 *
 * Before the `orderBy` fix above, "already up to date" was true only by
 * luck: the generator compared content and quietly UPDATED any row that no
 * longer matched. Pinning the card order changes what a rung builds, so a
 * plain rerun would have rewritten 2979 of 3000 rows — including every
 * puzzle players already hold progress on, and including the production
 * bank, which is the reference copy (PROGRESS.md 7.83). Missing rows are
 * still created: that is what the script is for. Replacing an existing
 * puzzle is a deliberate act and now needs this flag.
 */
const REWRITE = process.argv.includes("--rewrite");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
// Argument validation exits the process, so it must not run on import
// either — see src/lib/entry-point.ts.
if (isEntryPoint(import.meta.url) && ONLY !== null && ONLY !== "free") {
  console.error(`Unknown --only=${ONLY}. Supported: --only=free`);
  process.exit(1);
}
const FREE_ONLY = ONLY === "free";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type Level = (typeof LEVELS)[number];

// Real eligible single-word Cyrillic candidate counts per level (measured
// directly against FlashcardCard: length 3-16, no spaces/hyphens — see
// generation.ts's SINGLE_CYRILLIC_WORD filter). A1's word bank is ~3x
// smaller than B1's, so splitting a puzzle-count target evenly across
// levels would force A1 to reuse its words far more heavily than B1 ever
// would at parity count — the opposite of the "no cyclic repetition, use
// the ~5500-word base appropriately per level" requirement this content
// scaling has been built around. LEVEL_TARGETS below instead allocates
// TOTAL_TARGET proportionally to each level's own pool size, keeping the
// average reuse ratio roughly EQUAL across levels instead of
// disproportionately punishing the smallest one.
const LEVEL_POOL_SIZE: Record<Level, number> = { A1: 444, A2: 931, B1: 1268, B2: 739, C1: 543 };

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
  // Beyond this point (rung 31+), hand-curating hundreds more literal
  // entries adds no real value: actual word *content* diversity comes
  // entirely from word-search.ts's per-seed randomized selection window
  // (see its own doc comment), not from this number — a formula that
  // keeps producing a varied, non-monotonic wordCount is exactly as good
  // as another wall of literal objects, and far less error-prone to
  // extend further later. Sized with headroom past every level's actual
  // LEVEL_TARGETS allocation (B1's is the largest, currently 407) rather
  // than trimmed to exactly match it — the per-level loops below slice
  // this array to LEVEL_TARGETS[level].straight, so a comfortable margin
  // here means LEVEL_POOL_SIZE/TOTAL_TARGET can both grow later without
  // also having to remember to extend this call. See extraWordSearchRungs.
  ...extraWordSearchRungs(420),
];

// Expert/★ tier, appended right after WORD_SEARCH_RUNGS — same picker
// grid, just badged, not a separate type/tab (see the plan this shipped
// from). Kept smaller than the straight rungs' word counts: a bending
// path uses more of its own "personal space" (can't run adjacent to
// itself) than a straight line does, so packing as many curved words
// into one grid is inherently harder.
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
  // See extraStarRungs — same "formula beats another wall of literals"
  // and headroom-not-exact-fit reasoning as extraWordSearchRungs above
  // (B1's actual LEVEL_TARGETS star allocation is currently 155).
  ...extraStarRungs(168),
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
  // See extraCrosswordRungs — same reasoning as the two functions above
  // (B1's actual LEVEL_TARGETS crossword allocation is currently 407).
  ...extraCrosswordRungs(420),
];

/** Generates additional straight-tier word-search rungs beyond the
 * hand-curated ramp above, all at the 16x16 mobile-comfortable ceiling
 * (see WORD_SEARCH_RUNGS's own doc comment for why grid size stops
 * growing there). wordCount cycles in a triangle wave between 16 and 28
 * so consecutive generated rungs still read as distinct puzzles instead
 * of repeating one flat target count. */
function extraWordSearchRungs(count: number): Array<{ size: number; wordCount: number }> {
  const min = 16;
  const max = 28;
  const period = (max - min) * 2;
  const rungs: Array<{ size: number; wordCount: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i % period;
    const wordCount = t <= max - min ? min + t : min + (period - t);
    rungs.push({ size: 16, wordCount });
  }
  return rungs;
}

/** Same idea for the curved/★ tier — cycles through the size band the
 * hand-curated entries already established, with wordCount kept in the
 * same "size-4 to size-2" density this tier has used throughout (a
 * bending path needs more of its own personal space than a straight
 * line, so it can't pack as densely as the straight rungs). */
function extraStarRungs(count: number): Array<{ size: number; wordCount: number }> {
  const sizes = [10, 12, 14, 16, 16];
  const rungs: Array<{ size: number; wordCount: number }> = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i % sizes.length];
    const wordCount = Math.max(6, size - 4 + (i % 3));
    rungs.push({ size, wordCount });
  }
  return rungs;
}

/** Same idea for crossword — wordCount cycles in a triangle wave (kept
 * within the range the hand-curated rungs already established, see the
 * comment on the third lap above for why it doesn't climb past ~28:
 * more words means a sprawlier, not squarer, grid), maxLen cycles
 * through the same 6-12 band independently so the two don't move in
 * lockstep. */
function extraCrosswordRungs(count: number): Array<{ wordCount: number; maxLen: number }> {
  const wcMin = 8;
  const wcMax = 28;
  const wcPeriod = (wcMax - wcMin) * 2;
  const maxLens = [6, 7, 8, 9, 10, 11, 12];
  const rungs: Array<{ wordCount: number; maxLen: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i % wcPeriod;
    const wordCount = t <= wcMax - wcMin ? wcMin + t : wcMin + (wcPeriod - t);
    const maxLen = maxLens[i % maxLens.length];
    rungs.push({ wordCount, maxLen });
  }
  return rungs;
}

// Total puzzles across all levels/tiers, and the straight:star:crossword
// split within each level's own allocation — kept at the same 21:8:21
// ratio the hand-curated rungs originally established (84:32:84 at the
// first 1000-puzzle milestone), just scaled up each time this target grows.
const TOTAL_TARGET = 3000;

// CEFR order, low to high — used only to find "one level down" for the
// short-word supplementation below.
const LEVEL_ORDER: readonly Level[] = ["A1", "A2", "B1", "B2", "C1"];
function lowerLevel(level: Level): Level | null {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx > 0 ? LEVEL_ORDER[idx - 1] : null;
}
const TIER_RATIO = { straight: 21, star: 8, crossword: 21 };

interface LevelTarget {
  straight: number;
  star: number;
  crossword: number;
}

/** Splits TOTAL_TARGET across levels proportional to each one's own word-
 * bank size (LEVEL_POOL_SIZE), then splits each level's share across the
 * three tiers at TIER_RATIO. `crossword` absorbs each level's rounding
 * remainder so straight+star+crossword always sums to exactly that
 * level's rounded total — the grand total across all 5 levels lands
 * within rounding distance of TOTAL_TARGET for the actual measured pool
 * sizes here, but isn't forced to match it exactly by fiat; a future
 * change to LEVEL_POOL_SIZE just redistributes rather than silently
 * drifting off-target. */
function computeLevelTargets(): Record<Level, LevelTarget> {
  const poolTotal = LEVELS.reduce((sum, l) => sum + LEVEL_POOL_SIZE[l], 0);
  const ratioSum = TIER_RATIO.straight + TIER_RATIO.star + TIER_RATIO.crossword;
  const targets = {} as Record<Level, LevelTarget>;
  for (const level of LEVELS) {
    const levelTotal = Math.round((LEVEL_POOL_SIZE[level] / poolTotal) * TOTAL_TARGET);
    const straight = Math.round((levelTotal * TIER_RATIO.straight) / ratioSum);
    const star = Math.round((levelTotal * TIER_RATIO.star) / ratioSum);
    const crossword = levelTotal - straight - star;
    targets[level] = { straight, star, crossword };
  }
  return targets;
}
const LEVEL_TARGETS = computeLevelTargets();

/**
 * Writes one puzzle.
 *
 * Always an UPDATE of the existing row when there is one — never a delete
 * and recreate. WordGameProgress.puzzleId is a foreign key with
 * `onDelete: Cascade` and `@@unique([userId, puzzleId])`, so recreating a
 * row to change its words would silently erase every player's completion
 * of that puzzle. The row's id, and therefore all progress attached to it,
 * survives a regeneration; only `topic`, `gridData` and `words` change.
 */
async function upsertPuzzle(
  type: "WORD_SEARCH" | "CROSSWORD",
  level: string,
  sequence: number,
  curved: boolean,
  topic: string | null,
  built: { grid: WordGameGrid; words: WordPlacement[] },
  counters: { created: number; unchanged: number; kept: string[]; wouldWrite: string[] }
): Promise<void> {
  const gridData = JSON.stringify(built.grid);
  const words = JSON.stringify(built.words);

  const existing = await db.wordGamePuzzle.findUnique({
    where: { type_level_sequence: { type, level, sequence } },
  });
  if (
    existing &&
    existing.curved === curved &&
    existing.topic === topic &&
    existing.gridData === gridData &&
    existing.words === words
  ) {
    counters.unchanged++;
    return;
  }

  // The row is there and holds something else. Without --rewrite that is
  // not a job for this script: the existing puzzle is live content with
  // player progress attached, and this run's version of it is merely
  // "what today's card order builds", not a correction of anything. It is
  // counted and listed, never silently skipped.
  if (existing && !REWRITE) {
    counters.unchanged++;
    counters.kept.push(`${type}/${level}/${sequence}`);
    return;
  }

  if (DRY_RUN) {
    counters.wouldWrite.push(
      `${type}/${level}/${sequence}` +
        (existing
          ? ` (update, id ${existing.id}, topic ${existing.topic ?? "—"} -> ${topic ?? "—"})`
          : " (create)")
    );
    counters.created++;
    return;
  }

  await db.wordGamePuzzle.upsert({
    where: { type_level_sequence: { type, level, sequence } },
    create: { type, level, sequence, curved, topic, gridData, words },
    update: { curved, topic, gridData, words },
  });
  counters.created++;
}

// Highest sequence number this script will ever write for each
// (type, level) — the straight rungs plus (for WORD_SEARCH only) the star
// tier appended after them, per that level's own LEVEL_TARGETS allocation
// (levels no longer share one flat count — see LEVEL_TARGETS' doc
// comment). Used purely for the cleanup pass below.
function maxWordSearchSequence(level: Level): number {
  // Plus the tail the density redistribution appended (density-rungs.ts).
  // Those rungs are past everything this script writes, which is exactly
  // what cleanupStaleSequences() below is built to delete — so without
  // this term, the first full regeneration after the redistribution would
  // quietly wipe the puzzles the leftover words live in, and the words
  // would be gone from the level for good.
  return LEVEL_TARGETS[level].straight + LEVEL_TARGETS[level].star + densityTailCount(level);
}
function maxCrosswordSequence(level: Level): number {
  return LEVEL_TARGETS[level].crossword;
}

/** Deletes any WordGamePuzzle row past the current max sequence for its
 * (type, level) — rows `upsertPuzzle` above can never touch since it only
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
  let deleted = 0;
  for (const level of LEVELS) {
    const [ws, cw] = await Promise.all([
      db.wordGamePuzzle.deleteMany({ where: { type: "WORD_SEARCH", level, sequence: { gt: maxWordSearchSequence(level) } } }),
      db.wordGamePuzzle.deleteMany({ where: { type: "CROSSWORD", level, sequence: { gt: maxCrosswordSequence(level) } } }),
    ]);
    deleted += ws.count + cw.count;
  }
  return deleted;
}

async function main() {
  const counters = { created: 0, unchanged: 0, kept: [] as string[], wouldWrite: [] as string[] };
  if (DRY_RUN) console.log("--dry-run: nothing will be written.\n");
  if (FREE_ONLY) console.log(`--only=free: restricted to the ${WORD_GAME_FREE_RUNGS_PER_LEVEL} free rungs of each ladder, A1-B2, both types.\n`);
  const problems: string[] = [];

  for (const level of LEVELS) {
    const target = LEVEL_TARGETS[level];
    // orderBy is NOT decoration. Without it SQLite hands rows back in
    // storage (rowid) order, which is an artefact of the order rows
    // happened to be inserted into THIS file — and `candidateWords()`
    // dedupes first-wins over that order while `buildWordSearch` /
    // `buildCrossword` shuffle the pool with a seeded RNG. A seeded
    // shuffle is a permutation OF THE INPUT ARRAY: the same seed over a
    // differently ordered pool picks different words. That is the whole
    // reason production and dev.db hold two different banks under the
    // same rung numbers (PROGRESS.md 7.82/7.83) — the generator's
    // "re-running reproduces byte-identical puzzles" promise silently
    // held only within one database file. `id` is a stable human slug
    // ("v6-fridge"), identical on both databases, so ordering by it makes
    // the pool — and therefore the puzzle — the same everywhere.
    const cards = await db.flashcardCard.findMany({
      where: { level },
      select: { russian: true, translationEs: true, exampleEs: true, category: true },
      orderBy: { id: "asc" },
    });
    // Real content gap found by direct measurement (not assumption): C1's
    // own word bank has only 3 eligible 4-letter words and ZERO 3-letter
    // ones (vocabulary that advanced skews long/technical), so any
    // short-maxLen rung — which every crossword ladder needs, short words
    // being what makes intersections possible at all — is forced into
    // heavy reuse purely by pool scarcity, independent of how good the
    // selection algorithm is. A word this short is also, structurally,
    // never an advanced/technical one — it's exactly the kind of word a
    // C1 learner (who has necessarily already mastered every level below)
    // already knows. `lowerCards` is fetched once per level and only
    // pulled into a rung's pool when that rung's own-level pool is
    // actually thin (see poolWithSupplement below) — a healthy maxLen
    // band never touches it, so this only ever kicks in for the specific
    // bands that need it.
    const lower = lowerLevel(level);
    const lowerCards = lower
      ? await db.flashcardCard.findMany({
          where: { level: lower },
          select: { russian: true, translationEs: true, exampleEs: true },
          orderBy: { id: "asc" },
        })
      : [];

    const crosswordClueForLevel = (card: { translationEs: string; exampleEs: string }, word: string) => buildClue(level, card, word);
    // WORD_SEARCH never masks — unlike a crossword, there's no blank to
    // spoil (the letters are already fully visible in the grid), so a
    // masked example sentence there is just confusing, not protective.
    // Direct translation is a straightforward vocabulary aid instead.
    const wordSearchClue = (card: { translationEs: string }) => card.translationEs;

    // Floor a rung's own-level pool must clear before skipping
    // supplementation — sized so the windowed-random selection (see
    // word-search.ts/crossword.ts's own doc comments, windowSize is
    // roughly targetCount*3-4) still has real room to pick from, not just
    // barely enough to hit targetCount once. Scales with the rung's own
    // wordCount so a dense high-count rung still gets a proportionally
    // bigger pool floor, with 60 as an absolute minimum for small rungs.
    function poolWithSupplement(
      maxLen: number,
      clueFn: (card: { translationEs: string; exampleEs: string }, word: string) => string | null,
      wordCount: number,
      minLen = 3
    ) {
      const pool = candidateWords(cards, maxLen, clueFn, minLen);
      const floor = Math.max(60, wordCount * 4);
      if (pool.length >= floor || lowerCards.length === 0) return pool;
      const seen = new Set(pool.map((c) => c.word));
      for (const c of candidateWords(lowerCards, maxLen, clueFn, minLen)) {
        if (!seen.has(c.word)) {
          pool.push(c);
          seen.add(c.word);
        }
      }
      return pool;
    }

    /**
     * The pool for a THEMED rung: one category, and no supplementation
     * from a lower level.
     *
     * Supplementation exists to rescue a thin length band by borrowing
     * words from the level below. Borrowing here would quietly break the
     * promise the title makes — a "sopa de letras de comida, nivel B1"
     * padded with A2 words is no longer a B1 puzzle. A themed rung that
     * cannot fill itself from its own category at its own level is not
     * eligible in the first place; topics.ts decides that by building the
     * puzzle for real, so reaching this function with too few words means
     * the word bank has changed since the table was frozen, and the run
     * falls back to the mixed pool rather than shipping a short puzzle.
     */
    function topicPool(
      topic: string,
      maxLen: number,
      clueFn: (card: { translationEs: string; exampleEs: string }, word: string) => string | null,
      minLen = 3
    ) {
      const category = categoryForTopic(topic);
      if (!category) return [];
      return candidateWords(cards.filter((c) => c.category === category), maxLen, clueFn, minLen);
    }

    // Tracks how many times each word has already been placed across this
    // level's rungs so far — shared between the straight and star tiers
    // (both draw from the same word-search word bank) but a separate map
    // per level, and a separate one again for crossword below (a word
    // being overused in one game type says nothing about the other, since
    // each has its own eligible pool per rung). Threaded into every
    // build*() call so their windowed-random selection can deprioritize
    // an already-overused word instead of drawing on it again with no
    // memory of prior rungs — see word-search.ts's buildWordSearch doc
    // comment for why the windowing fix alone wasn't enough at this scale.
    const wordSearchUsage = new Map<string, number>();
    const crosswordUsage = new Map<string, number>();
    function recordUsage(usage: Map<string, number>, words: { word: string }[]) {
      for (const w of words) usage.set(w.word, (usage.get(w.word) ?? 0) + 1);
    }

    for (let rungIndex = 0; rungIndex < target.straight; rungIndex++) {
      const sequence = rungIndex + 1;
      if (FREE_ONLY && !isFreeWordGamePuzzle({ type: "WORD_SEARCH", level, sequence })) continue;
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
      const pool = poolWithSupplement(wordSearchMaxLen, wordSearchClue, rung.wordCount);

      if (pool.length < 5) {
        problems.push(`WORD_SEARCH ${level} seq ${sequence}: only ${pool.length} eligible words (need >=5), skipped`);
        continue;
      }

      const mixed = buildWordSearchWithGrowth(pool, rung.size, rung.wordCount, `WORD_SEARCH-${level}-${sequence}`, wordSearchUsage);
      if (!mixed) {
        problems.push(`WORD_SEARCH ${level} seq ${sequence}: generator could not place enough words, skipped`);
        continue;
      }

      // The mixed build always happens, and it is always what feeds the
      // usage map — even when the rung ships a themed puzzle instead.
      //
      // This is what keeps the ~5900 paid puzzles byte-identical. The
      // usage map is shared across a level's whole ladder so later rungs
      // can avoid words the earlier ones already used; if the themed
      // rungs 1-10 wrote their own (much narrower) word sets into it,
      // every paid rung from 11 up would draw a different selection and a
      // full rerun would silently rewrite thousands of rows nobody asked
      // to change. Feeding the map the words rung 1-10 WOULD have used
      // leaves the paid ladder exactly where it was. Verified by
      // generating the whole ladder before and after and diffing.
      recordUsage(wordSearchUsage, mixed.words);

      const topic = topicForPuzzle("WORD_SEARCH", level, sequence);
      let built = mixed;
      let appliedTopic: string | null = null;
      if (topic) {
        const themedPool = topicPool(topic, wordSearchMaxLen, wordSearchClue);
        // A themed rung uses its own empty usage map: each category is
        // used at most once per (type, level), so there is no earlier rung
        // of the same topic to remember, and inheriting the mixed map's
        // history would make the themed output depend on a pipeline it has
        // nothing to do with.
        const themed =
          themedPool.length >= rung.wordCount
            ? buildWordSearchWithGrowth(themedPool, rung.size, rung.wordCount, `WORD_SEARCH-${level}-${sequence}`, new Map())
            : null;
        if (themed && themed.words.length >= rung.wordCount) {
          built = themed;
          appliedTopic = topic;
        } else {
          problems.push(
            `WORD_SEARCH ${level} seq ${sequence}: topic "${topic}" no longer fills this rung (pool ${themedPool.length}, placed ${themed?.words.length ?? 0}/${rung.wordCount}) — shipped the mixed puzzle instead`
          );
        }
      }

      if (built.words.length < rung.wordCount) {
        problems.push(
          `WORD_SEARCH ${level} seq ${sequence}: only fit ${built.words.length}/${rung.wordCount} target words even after growing to ${built.grid.size}x${built.grid.size} (word list itself is still fully consistent with the grid)`
        );
      }

      // Owned by the density redistribution (density-rungs.ts): this
      // rung's words were spread across several grids, and rebuilding it
      // from the rung table would pack them all back into one. The build
      // above still ran, and recordUsage() above still consumed it, so
      // every LATER rung draws exactly the words it drew before — the
      // skip changes this row and nothing else.
      if (isDensityOwnedRung("WORD_SEARCH", level, sequence)) {
        counters.unchanged++;
        console.log(`  [WORD_SEARCH/${level}/${sequence}] skipped — owned by the density redistribution`);
        continue;
      }

      await upsertPuzzle("WORD_SEARCH", level, sequence, false, appliedTopic, built, counters);
      console.log(
        `  [WORD_SEARCH/${level}/${sequence}] ${built.words.length} words in a ${built.grid.size}x${built.grid.size} grid${appliedTopic ? ` · ${appliedTopic}` : ""}`
      );
    }

    for (let starIndex = 0; starIndex < target.star; starIndex++) {
      const sequence = target.straight + starIndex + 1;
      // The star tier is always paid (its sequences start well past the
      // free rungs), so --only=free skips it entirely.
      if (FREE_ONLY) continue;
      const rung = WORD_SEARCH_STAR_RUNGS[starIndex];
      // Curved words need real segments to bend through — a word shorter
      // than 5 letters is too cramped to produce an interesting curve
      // even though 4 is the hard geometric floor (see
      // buildSnakeWordSearch's own length guard for the floor itself).
      const wordSearchMaxLen = Math.max(rung.size - 2, 5);
      const pool = poolWithSupplement(wordSearchMaxLen, wordSearchClue, rung.wordCount, 5);

      if (pool.length < 5) {
        problems.push(`WORD_SEARCH★ ${level} seq ${sequence}: only ${pool.length} eligible words (need >=5), skipped`);
        continue;
      }

      const built = buildSnakeWordSearchWithGrowth(
        pool,
        rung.size,
        rung.wordCount,
        `WORD_SEARCH_STAR-${level}-${sequence}`,
        wordSearchUsage
      );
      if (!built) {
        problems.push(`WORD_SEARCH★ ${level} seq ${sequence}: generator could not place enough curved words, skipped`);
        continue;
      }
      if (built.words.length < rung.wordCount) {
        problems.push(
          `WORD_SEARCH★ ${level} seq ${sequence}: only fit ${built.words.length}/${rung.wordCount} target words even after growing to ${built.grid.size}x${built.grid.size}`
        );
      }

      recordUsage(wordSearchUsage, built.words);
      await upsertPuzzle("WORD_SEARCH", level, sequence, true, null, built, counters);
      console.log(`  [WORD_SEARCH★/${level}/${sequence}] ${built.words.length} curved words in a ${built.grid.size}x${built.grid.size} grid`);
    }

    for (let rungIndex = 0; rungIndex < target.crossword; rungIndex++) {
      const sequence = rungIndex + 1;
      if (FREE_ONLY && !isFreeWordGamePuzzle({ type: "CROSSWORD", level, sequence })) continue;
      const rung = CROSSWORD_RUNGS[rungIndex];
      const rng = makeRng(`CROSSWORD-${level}-${sequence}`);
      const pool = poolWithSupplement(rung.maxLen, crosswordClueForLevel, rung.wordCount);

      if (pool.length < rung.wordCount) {
        problems.push(`CROSSWORD ${level} seq ${sequence}: only ${pool.length} eligible words (need >=${rung.wordCount}), skipped`);
        continue;
      }

      const minWords = Math.min(rung.wordCount, 6);
      const mixed = buildCrossword(pool, rung.wordCount, minWords, rng, 6, crosswordUsage);
      if (!mixed) {
        problems.push(`CROSSWORD ${level} seq ${sequence}: generator could not reach ${minWords} intersecting words, skipped`);
        continue;
      }

      // Same rule as WORD_SEARCH above: the mixed build is what feeds the
      // usage map, so the paid rungs draw exactly what they drew before.
      recordUsage(crosswordUsage, mixed.words);

      const topic = topicForPuzzle("CROSSWORD", level, sequence);
      let built = mixed;
      let appliedTopic: string | null = null;
      if (topic) {
        const themedPool = topicPool(topic, rung.maxLen, crosswordClueForLevel);
        const themed =
          themedPool.length >= rung.wordCount
            ? buildCrossword(themedPool, rung.wordCount, minWords, makeRng(`CROSSWORD-${level}-${sequence}`), 6, new Map())
            : null;
        if (themed && themed.words.length >= rung.wordCount) {
          built = themed;
          appliedTopic = topic;
        } else {
          problems.push(
            `CROSSWORD ${level} seq ${sequence}: topic "${topic}" no longer fills this rung (pool ${themedPool.length}, placed ${themed?.words.length ?? 0}/${rung.wordCount}) — shipped the mixed puzzle instead`
          );
        }
      }

      await upsertPuzzle("CROSSWORD", level, sequence, false, appliedTopic, built, counters);
      console.log(
        `  [CROSSWORD/${level}/${sequence}] ${built.words.length} words in a ${built.grid.grid.length}x${built.grid.grid[0].length} grid${appliedTopic ? ` · ${appliedTopic}` : ""}`
      );
    }
  }

  // Never in a scoped or dry run: the cleanup pass reasons about the FULL
  // ladder, and deleting "everything past the last sequence I wrote" while
  // only the first ten were generated would wipe every paid puzzle.
  if (FREE_ONLY || DRY_RUN) {
    console.log("\nSkipping the stale-sequence cleanup (only valid for a full, non-dry run).");
  } else {
    const deleted = await cleanupStaleSequences();
    if (deleted > 0) console.log(`\nDeleted ${deleted} stale puzzle row(s) past the current rung tables' range.`);
  }

  if (DRY_RUN) {
    console.log(`\n${counters.created} puzzle(s) WOULD be written, ${counters.unchanged} already up to date. Nothing was written.`);
    for (const w of counters.wouldWrite) console.log(`  - ${w}`);
  } else {
    console.log(`\n${counters.created} puzzle(s) written, ${counters.unchanged} already up to date.`);
  }
  if (counters.kept.length > 0) {
    console.log(
      `\n${counters.kept.length} existing puzzle(s) left as they are — this run would build them differently. ` +
        `Pass --rewrite to replace them (this rewrites live content; see the flag's comment).`
    );
    for (const k of counters.kept.slice(0, 20)) console.log(`  - ${k}`);
    if (counters.kept.length > 20) console.log(`  … и ещё ${counters.kept.length - 20}`);
  }
  if (problems.length > 0) {
    console.log(`\n${problems.length} rung(s) skipped:`);
    for (const p of problems) console.log(`  - ${p}`);
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
