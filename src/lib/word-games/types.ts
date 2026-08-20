import type { FlashcardLevel } from "@/lib/flashcards/types";

export type WordGameType = "WORD_SEARCH" | "CROSSWORD";

export const wordGameTypes: WordGameType[] = ["WORD_SEARCH", "CROSSWORD"];

export function isWordGameType(value: string): value is WordGameType {
  return (wordGameTypes as readonly string[]).includes(value);
}

export type WordSearchDirection =
  | "E"
  | "W"
  | "N"
  | "S"
  | "NE"
  | "NW"
  | "SE"
  | "SW";

/** A single word placed in a generated grid. `number` is only meaningful
 * for CROSSWORD (the clue-list index). `path` is only set for a curved
 * ("snake") WORD_SEARCH word — the ordered list of cells it bends through,
 * one per letter; `row`/`col` still equal `path[0]` for type uniformity,
 * but `direction` is meaningless for these (a bent word has no single
 * direction) and consumers must check `path` first. Every other placement
 * (straight WORD_SEARCH, all CROSSWORD) has no `path` and is fully
 * described by row/col/direction as before. */
export interface WordPlacement {
  word: string;
  clue?: string;
  row: number;
  col: number;
  direction: WordSearchDirection;
  number?: number;
  path?: { row: number; col: number }[];
}

export interface WordGameGrid {
  size: number;
  grid: string[][];
}

/** Parsed shape of WordGamePuzzle.gridData/words after JSON.parse — see
 * prisma/generate-word-games.ts, the only writer of these columns. */
export interface WordGamePuzzle {
  id: string;
  type: WordGameType;
  level: FlashcardLevel;
  sequence: number;
  gridData: WordGameGrid;
  words: WordPlacement[];
}
