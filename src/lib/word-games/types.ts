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

/** A single word placed in a generated grid. `number`/`clue` are only
 * meaningful for CROSSWORD — WORD_SEARCH highlights by `word` alone once
 * found, it has no visible clue list. */
export interface WordPlacement {
  word: string;
  clue?: string;
  row: number;
  col: number;
  direction: WordSearchDirection;
  number?: number;
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
