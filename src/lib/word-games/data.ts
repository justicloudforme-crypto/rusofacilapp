import "server-only";
import { db } from "@/lib/db";
import type { WordGameGrid, WordGameType, WordPlacement } from "./types";
import { isWordGameType } from "./types";

export interface PuzzleRow {
  id: string;
  type: WordGameType;
  level: string;
  sequence: number;
  grid: WordGameGrid;
  words: WordPlacement[];
}

function parseRow(row: { id: string; type: string; level: string; sequence: number; gridData: string; words: string }): PuzzleRow {
  if (!isWordGameType(row.type)) throw new Error(`invalid word game type in DB: ${row.type}`);
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    sequence: row.sequence,
    grid: JSON.parse(row.gridData) as WordGameGrid,
    words: JSON.parse(row.words) as WordPlacement[],
  };
}

export async function getPuzzle(type: WordGameType, level: string, sequence: number): Promise<PuzzleRow | null> {
  const row = await db.wordGamePuzzle.findUnique({ where: { type_level_sequence: { type, level, sequence } } });
  return row ? parseRow(row) : null;
}

export async function getPuzzleById(id: string): Promise<PuzzleRow | null> {
  const row = await db.wordGamePuzzle.findUnique({ where: { id } });
  return row ? parseRow(row) : null;
}

/** How many rungs exist for a (type, level) — used to know whether
 * "sequence + 1" is a real next puzzle or the end of that level's ladder. */
export async function countSequences(type: WordGameType, level: string): Promise<number> {
  return db.wordGamePuzzle.count({ where: { type, level } });
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
      grid: row.grid.grid,
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
