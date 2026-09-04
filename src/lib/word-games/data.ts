import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "@/lib/ttl-cache";
import type { WordGameGrid, WordGameType, WordPlacement } from "./types";
import { isWordGameType } from "./types";
import { GENERIC_SOPA_PUZZLE } from "./topic-landings";
import { freeWordGameWhere, isPubliclyOpenableWordGamePuzzle } from "./free-tier";

export interface PuzzleRow {
  id: string;
  type: WordGameType;
  level: string;
  sequence: number;
  curved: boolean;
  premiumOnly: boolean;
  /** Vocabulary-category slug the words came from, or null for a puzzle
   * built from the level-wide mixed pool. Read from the row rather than
   * looked up, so a page describes the words it actually has. */
  topic: string | null;
  grid: WordGameGrid;
  words: WordPlacement[];
}

function parseRow(row: {
  id: string;
  type: string;
  level: string;
  sequence: number;
  curved: boolean;
  premiumOnly: boolean;
  topic: string | null;
  gridData: string;
  words: string;
}): PuzzleRow | null {
  if (!isWordGameType(row.type)) throw new Error(`invalid word game type in DB: ${row.type}`);
  // Unlike the story offsets (see the stories page), these two are not
  // decoration — a puzzle without its grid and words IS NOT A PUZZLE, and
  // rendering an empty board would be a silent lie. So this degrades to
  // `null`, which every caller already handles by showing 404: "this puzzle
  // does not exist" is wrong but harmless, "here is a blank puzzle" is not.
  // What it must not do is what it did before — throw a bare SyntaxError
  // mid-render and take the page down with no indication of which row.
  // parseRow is only ever called for a single puzzle (getPuzzle,
  // getPuzzleById, and the random pick), never over a list, so one bad row
  // cannot affect any other puzzle. Same class as incident №1, PROGRESS.md 7.40.
  let grid: WordGameGrid;
  let words: WordPlacement[];
  try {
    grid = JSON.parse(row.gridData) as WordGameGrid;
    words = JSON.parse(row.words) as WordPlacement[];
  } catch (error) {
    console.error(`[word-games] puzzle ${row.id} has unparseable gridData/words — treated as missing`, error);
    return null;
  }
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    sequence: row.sequence,
    curved: row.curved,
    premiumOnly: row.premiumOnly,
    topic: row.topic,
    grid,
    words,
  };
}

/** React-cached: the puzzle page now reads the row twice per request —
 * once in generateMetadata (the title says how many words the puzzle
 * actually holds) and once in the component. cache() collapses that back
 * to a single query per render, which matters here because every Turso
 * round trip is cross-region (see the load-test notes in
 * PROJECT_SUMMARY.md; this section was already the worst offender once).
 * The cache is per-render, so two visitors never share a result. */
export const getPuzzle = cache(
  async (type: WordGameType, level: string, sequence: number): Promise<PuzzleRow | null> => {
    const row = await db.wordGamePuzzle.findUnique({ where: { type_level_sequence: { type, level, sequence } } });
    return row ? parseRow(row) : null;
  },
);

export async function getPuzzleById(id: string): Promise<PuzzleRow | null> {
  const row = await db.wordGamePuzzle.findUnique({ where: { id } });
  return row ? parseRow(row) : null;
}

/** `${type}:${level}` — the picker needs data broken down per (type,
 * level) pair, but fetching each pair separately means one DB round trip
 * per pair; this key lets a single query's results be grouped in memory
 * instead. */
function pairKey(type: string, level: string): string {
  return `${type}:${level}`;
}

/** How many rungs exist for every (type, level) pair at once — one query
 * instead of one per pair. Used to know whether "sequence + 1" is a real
 * next puzzle or the end of that level's ladder, and to size the picker
 * grid. Cross-region Turso round trips (see PROJECT_SUMMARY.md's regional
 * latency note) made the old per-pair version genuinely slow: the picker
 * page loops over every (type, level) combination, so 10 pairs meant 10
 * sequential round trips just for this one piece of data. */
export async function countAllSequences(): Promise<Map<string, number>> {
  const rows = await db.wordGamePuzzle.groupBy({ by: ["type", "level"], _count: true });
  return new Map(rows.map((r) => [pairKey(r.type, r.level), r._count]));
}

// 5 minutes. The themed-puzzle map changes only when the offline
// generator runs — a rare, deliberate act — so this could be cached far
// longer; it is kept short so that the first thing anyone does after a
// production regeneration (reload a vocabulary page to see the links
// appear) does not look like a failed deploy for an hour.
const themedPuzzleCache = getOrCreateGlobalSingleton(
  "themedPuzzleCache",
  () => new TtlCache<Array<{ topic: string; type: string; level: string; sequence: number }>>(300_000, "themedPuzzles", Array.isArray),
);

/**
 * Every puzzle that ACTUALLY carries a topic, grouped by topic slug.
 *
 * Read from the database, deliberately, even though
 * word-games/topics.ts already holds the frozen rung -> category table and
 * answering from it would need no query at all.
 *
 * The reason is a real defect this replaced. The table says which rungs
 * are MEANT to be themed; the rows say which ones ARE. Between the code
 * deploying and the generator being run against production those two
 * disagree, and for that whole window every vocabulary page told visitors
 * "6 puzles gratis hechos solo con vocabulario de este tema" and linked to
 * six puzzles still built from a level-wide mix. Measured on the live site
 * 02.09.2026, when it had been true for every one of the 16 pages.
 *
 * The puzzle side of the link already followed the row rather than the
 * table (see puzzleTitle's `topic` argument). This is the same rule
 * applied to the other side: a page may only claim a theme the stored
 * puzzle actually has.
 */
export async function getThemedPuzzlesByTopic(): Promise<Map<string, Array<{ type: WordGameType; level: string; sequence: number }>>> {
  // Degrades to "no themed puzzles" instead of throwing (29.08.2026).
  //
  // The callers are the 23 /es/vocabulary/[categoria] pages — 8 355 to
  // 42 209 characters of real content each — and the six themed landings,
  // where this only feeds the "Más puzles de este tema" list. On every one
  // of them the block is an extra, and an empty map is a state the callers
  // already handle correctly: no themed puzzle in the data means no block
  // and no promise, which is exactly the rule established on 02.09.2026
  // when these pages were advertising themes the rows did not have.
  //
  // So a failure here costs the link block, not 29 pages. It does NOT
  // cover getLandingPuzzleForTopic below: there the puzzle IS the page,
  // and a landing with no grid should 404 rather than pretend.
  let rows: Array<{ topic: string; type: string; level: string; sequence: number }> = [];
  try {
    rows = await cached(themedPuzzleCache, "all", async () =>
      db.wordGamePuzzle.findMany({
        where: { topic: { not: null } },
        select: { topic: true, type: true, level: true, sequence: true },
        orderBy: [{ level: "asc" }, { type: "asc" }, { sequence: "asc" }],
      }).then((found) =>
        found.map((r) => ({ topic: r.topic as string, type: r.type, level: r.level, sequence: r.sequence })),
      ),
    );
  } catch (error) {
    console.error("[word-games] could not read themed puzzles; serving pages without the puzzle block", error);
  }

  const byTopic = new Map<string, Array<{ type: WordGameType; level: string; sequence: number }>>();
  for (const row of rows) {
    if (!isWordGameType(row.type)) continue;
    const list = byTopic.get(row.topic);
    const entry = { type: row.type, level: row.level, sequence: row.sequence };
    if (list) list.push(entry);
    else byTopic.set(row.topic, [entry]);
  }
  return byTopic;
}

/**
 * The WORD_SEARCH puzzle a `/es/sopa-de-letras-ruso-<tema>` landing
 * embeds: lowest level first, then lowest rung, and never the one the
 * generic `/es/sopa-de-letras-ruso` already shows.
 *
 * Selected by querying `topic`, not by hardcoding a coordinate. The point
 * of the page is that its puzzle IS the theme, so the puzzle has to be
 * found by the theme; a hardcoded rung would keep claiming a topic after
 * a regeneration moved it, which is the same defect the vocabulary pages
 * had before 02.09.2026.
 *
 * Returns null when the theme has no themed WORD_SEARCH left — the page
 * then 404s rather than embedding an unrelated grid under a themed title.
 */
export const getLandingPuzzleForTopic = cache(async (topic: string): Promise<PuzzleRow | null> => {
  const rows = await db.wordGamePuzzle.findMany({
    where: { topic, type: "WORD_SEARCH" },
    orderBy: [{ level: "asc" }, { sequence: "asc" }],
  });
  const usable = rows.filter(
    (r) =>
      !(
        r.type === GENERIC_SOPA_PUZZLE.type &&
        r.level === GENERIC_SOPA_PUZZLE.level &&
        r.sequence === GENERIC_SOPA_PUZZLE.sequence
      ),
  );
  const chosen = usable[0] ?? null;
  return chosen ? parseRow(chosen) : null;
});

/**
 * Which of the free rungs REALLY exist, for every (type, level) pair at
 * once — the row numbers, not a count.
 *
 * countAllSequences answers "how many", and the picker treats that as
 * 1..total; that is safe only while no ladder has a gap, which is what the
 * `ladderGaps` guard exists to keep true (PROGRESS.md 7.79). The free
 * index rendered on the hub is read by crawlers, so it asks the stronger
 * question and lists the sequences the bank actually holds — a link to a
 * missing rung would be a 404 handed to Googlebot on purpose.
 *
 * One query, bounded to the free window, so it costs a fraction of the
 * page's existing reads.
 */
export async function getFreeSequences(): Promise<Map<string, Set<number>>> {
  const rows = await db.wordGamePuzzle.findMany({
    // Надмножество бесплатных, а не «первые N номеров»: точный ответ
    // ниже даёт isPubliclyOpenableWordGamePuzzle по прочитанной строке,
    // и запрос обязан лишь не потерять ни одной подходящей (free-tier.ts).
    where: freeWordGameWhere(),
    // curved and premiumOnly are read, not assumed: a rung that carries
    // either answers an anonymous visitor with a 307 into /pricing even
    // though the free rule accepts it, so publishing its link would be
    // handing a crawler a redirect. See isPubliclyOpenableWordGamePuzzle.
    select: { type: true, level: true, sequence: true, curved: true, premiumOnly: true },
  });
  const byPair = new Map<string, Set<number>>();
  for (const row of rows) {
    if (!isPubliclyOpenableWordGamePuzzle(row)) continue;
    const key = pairKey(row.type, row.level);
    const existing = byPair.get(key);
    if (existing) existing.add(row.sequence);
    else byPair.set(key, new Set([row.sequence]));
  }
  return byPair;
}

/** Which sequences are the curved/★ expert tier, for every (type, level)
 * pair at once — powers the picker's star badge without parsing every
 * puzzle's `words` JSON just to check. See countAllSequences for why this
 * is batched instead of one query per pair. */
export async function getAllCurvedSequences(): Promise<Map<string, Set<number>>> {
  // Degrades to "no stars" (29.08.2026). The ★ badge is a hint about
  // difficulty; /es/word-games is in the sitemap and hands a crawler 196
  // links, and losing all of them because a decorative badge could not be
  // computed is the sitemap outage in miniature.
  //
  // Its two neighbours below and above deliberately do NOT degrade — see
  // db-read-resilience.test.ts for which, and why.
  let rows: Array<{ type: string; level: string; sequence: number }> = [];
  try {
    rows = await db.wordGamePuzzle.findMany({
      where: { curved: true },
      select: { type: true, level: true, sequence: true },
    });
  } catch (error) {
    console.error("[word-games] could not read curved rungs; serving the picker without ★ badges", error);
  }
  const byPair = new Map<string, Set<number>>();
  for (const row of rows) {
    const key = pairKey(row.type, row.level);
    const existing = byPair.get(key);
    if (existing) existing.add(row.sequence);
    else byPair.set(key, new Set([row.sequence]));
  }
  return byPair;
}

/** Which sequences require the Premium plan specifically, for every
 * (type, level) pair at once — always a superset of getAllCurvedSequences
 * (every curved puzzle is also premiumOnly, see schema.prisma), plus the
 * hardest non-curved rungs. Powers the picker's crown/lock badge the same
 * way getAllCurvedSequences powers the star.
 *
 * Deliberately NOT wrapped in try/catch, unlike its neighbour. Degrading
 * this to an empty map would mark every paid rung as free in the picker —
 * a read that decides what is behind the paywall has to fail closed. The
 * page 500ing is the correct outcome here, and db-read-resilience.test.ts
 * asserts it stays that way. */
export async function getAllPremiumOnlySequences(): Promise<Map<string, Set<number>>> {
  const rows = await db.wordGamePuzzle.findMany({
    where: { premiumOnly: true },
    select: { type: true, level: true, sequence: true },
  });
  const byPair = new Map<string, Set<number>>();
  for (const row of rows) {
    const key = pairKey(row.type, row.level);
    const existing = byPair.get(key);
    if (existing) existing.add(row.sequence);
    else byPair.set(key, new Set([row.sequence]));
  }
  return byPair;
}

// --- Public (answer-free) shapes sent to the client ---------------------
//
// CROSSWORD's whole gameplay loop is "recall the letter from memory" — if
// the API response contained the actual letters, opening the Network tab
// would hand over the solution. So the public shape below carries the
// grid's SHAPE (which cells are active) and each word's clue/length/
// position, but never a letter. The real letters stay server-side and are
// only ever compared (POST check) or individually revealed (POST hint).
//
// WORD_SEARCH is different: the whole grid of letters is inherently
// visible to a player (that's the genre — find the word among visible
// letters), so those ARE sent. What stays secret there is each word's
// row/col/direction — otherwise "search" would just be "read the
// coordinates off the network tab".

export interface PublicCrosswordWord {
  number: number;
  row: number;
  col: number;
  direction: WordPlacement["direction"];
  length: number;
  clue: string;
}

export interface PublicCrosswordPuzzle {
  id: string;
  type: "CROSSWORD";
  level: string;
  sequence: number;
  rows: number;
  cols: number;
  blocked: boolean[][];
  words: PublicCrosswordWord[];
}

export interface PublicWordSearchPuzzle {
  id: string;
  type: "WORD_SEARCH";
  level: string;
  sequence: number;
  // Expert tier: words bend mid-path instead of running straight. Safe to
  // expose — it doesn't reveal any word's actual path, just tells the UI
  // to show the ★ badge and enable click-sequence selection hints.
  curved: boolean;
  grid: string[][];
  words: { word: string; clue?: string }[];
}

export type PublicPuzzle = PublicCrosswordPuzzle | PublicWordSearchPuzzle;

export function toPublicPuzzle(row: PuzzleRow): PublicPuzzle {
  if (row.type === "WORD_SEARCH") {
    return {
      id: row.id,
      type: "WORD_SEARCH",
      level: row.level,
      sequence: row.sequence,
      curved: row.curved,
      grid: row.grid.grid,
      // Deliberately never sends `path`/`row`/`col`/`direction` — same
      // secrecy model as straight words today: the grid is public, exact
      // positions aren't, so "search" stays a real search even for a
      // curved word.
      words: row.words.map((w) => ({ word: w.word, clue: w.clue })),
    };
  }

  const blocked = row.grid.grid.map((line) => line.map((cell) => cell === ""));
  return {
    id: row.id,
    type: "CROSSWORD",
    level: row.level,
    sequence: row.sequence,
    rows: row.grid.grid.length,
    cols: row.grid.grid[0]?.length ?? 0,
    blocked,
    words: row.words.map((w) => ({
      number: w.number ?? 0,
      row: w.row,
      col: w.col,
      direction: w.direction,
      length: w.word.length,
      clue: w.clue ?? "",
    })),
  };
}

/** Authoritative letter lookup for CROSSWORD check/hint — never sent to
 * the client as a whole, only queried cell by cell. */
export function crosswordLetterMap(row: PuzzleRow): Map<string, string> {
  const map = new Map<string, string>();
  for (const w of row.words) {
    const [dr, dc] = w.direction === "S" ? [1, 0] : [0, 1];
    for (let i = 0; i < w.word.length; i++) {
      map.set(`${w.row + dr * i},${w.col + dc * i}`, w.word[i]);
    }
  }
  return map;
}
