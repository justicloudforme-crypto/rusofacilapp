// Pure client-side crossword input logic — no DOM, no fetch — so it's
// testable head-on with Vitest. WordGamePlayer/CrosswordBoard call these
// functions; they hold no state themselves.
import type { PublicCrosswordPuzzle, PublicCrosswordWord } from "./data";

export type Direction = "E" | "S";

export interface CellWordRef {
  word: PublicCrosswordWord;
  indexInWord: number;
}

/** Every crossword word that covers a given cell, keyed by "row,col" — a
 * cell at a crossing point maps to two entries (one E, one S). Built once
 * per puzzle and reused for direction-toggling, next-cell, and
 * solved-word checks. */
export function buildCellWordMap(words: PublicCrosswordWord[]): Map<string, CellWordRef[]> {
  const map = new Map<string, CellWordRef[]>();
  for (const word of words) {
    const [dr, dc] = word.direction === "S" ? [1, 0] : [0, 1];
    for (let i = 0; i < word.length; i++) {
      const key = `${word.row + dr * i},${word.col + dc * i}`;
      const refs = map.get(key) ?? [];
      refs.push({ word, indexInWord: i });
      map.set(key, refs);
    }
  }
  return map;
}

/** The word (in the given direction) that owns a cell, or null if that
 * direction doesn't pass through this cell at all. */
export function wordAt(
  cellWordMap: Map<string, CellWordRef[]>,
  row: number,
  col: number,
  direction: Direction,
): CellWordRef | null {
  const refs = cellWordMap.get(`${row},${col}`) ?? [];
  return refs.find((r) => r.word.direction === direction) ?? null;
}

/** Clicking a cell picks a direction: keep the current one if this cell
 * still belongs to a word in it; otherwise fall back to whichever
 * direction the cell actually supports. A second click on an
 * intersection cell (where both directions are valid) flips to the other
 * one — that's the "click again to switch across/down" behavior. */
export function resolveDirectionOnClick(
  cellWordMap: Map<string, CellWordRef[]>,
  row: number,
  col: number,
  previousDirection: Direction | null,
  previousCell: { row: number; col: number } | null,
): Direction | null {
  const refs = cellWordMap.get(`${row},${col}`) ?? [];
  if (refs.length === 0) return null;

  const sameCellAsBefore = previousCell?.row === row && previousCell?.col === col;
  if (sameCellAsBefore && previousDirection) {
    const other = previousDirection === "E" ? "S" : "E";
    if (refs.some((r) => r.word.direction === other)) return other;
    return previousDirection;
  }

  if (previousDirection && refs.some((r) => r.word.direction === previousDirection)) {
    return previousDirection;
  }
  // Crossword words only ever use "E"/"S" (see PublicCrosswordWord's
  // producer, toPublicPuzzle) even though the field's static type is the
  // full 8-direction WordSearchDirection shared with word search.
  return refs[0].word.direction as Direction;
}

/** The next cell in a word after (row,col), or null at the word's end. */
export function nextCellInWord(word: PublicCrosswordWord, row: number, col: number): { row: number; col: number } | null {
  const [dr, dc] = word.direction === "S" ? [1, 0] : [0, 1];
  const index = word.direction === "S" ? row - word.row : col - word.col;
  if (index < 0 || index >= word.length - 1) return null;
  return { row: row + dr, col: col + dc };
}

/** The previous cell in a word before (row,col), or null at the word's start. */
export function prevCellInWord(word: PublicCrosswordWord, row: number, col: number): { row: number; col: number } | null {
  const [dr, dc] = word.direction === "S" ? [1, 0] : [0, 1];
  const index = word.direction === "S" ? row - word.row : col - word.col;
  if (index <= 0) return null;
  return { row: row - dr, col: col - dc };
}

/** First empty cell in a word, scanning from its start — used both to
 * focus a word when its clue is clicked, and to pick which cell a "Hint"
 * tap should reveal. Returns null if every cell already has a guess. */
export function firstEmptyCellInWord(
  word: PublicCrosswordWord,
  guesses: Map<string, string>,
): { row: number; col: number } | null {
  const [dr, dc] = word.direction === "S" ? [1, 0] : [0, 1];
  for (let i = 0; i < word.length; i++) {
    const row = word.row + dr * i;
    const col = word.col + dc * i;
    if (!guesses.get(`${row},${col}`)) return { row, col };
  }
  return null;
}

/** All cells a word occupies, in order. */
export function cellsOfWord(word: PublicCrosswordWord): { row: number; col: number }[] {
  const [dr, dc] = word.direction === "S" ? [1, 0] : [0, 1];
  return Array.from({ length: word.length }, (_, i) => ({ row: word.row + dr * i, col: word.col + dc * i }));
}

/** A word counts as solved once every one of its cells has been confirmed
 * correct via POST /check — `correctCells` is the running set of "row,col"
 * keys the server has ever confirmed, so a word solved in an earlier
 * check call stays solved even if guesses map is only appended to. */
export function isWordSolved(word: PublicCrosswordWord, correctCells: Set<string>): boolean {
  return cellsOfWord(word).every((c) => correctCells.has(`${c.row},${c.col}`));
}

/** Whole puzzle solved once every word is. */
export function isPuzzleSolved(puzzle: Pick<PublicCrosswordPuzzle, "words">, correctCells: Set<string>): boolean {
  return puzzle.words.every((w) => isWordSolved(w, correctCells));
}

/** Clue list order — by number ascending, not generation/placement order
 * (a real bug: two words placed in the same pass can land in either
 * order, so the raw array wasn't reliably 1,2,3,... top to bottom). Takes
 * an already-direction-filtered list (across/down are rendered as two
 * separate lists) and returns a new sorted array. */
export function sortClues(words: PublicCrosswordWord[]): PublicCrosswordWord[] {
  return [...words].sort((a, b) => a.number - b.number);
}

/** Whether a check result should count as a mistake toward the round's
 * error tally. Only a keystroke on a specific cell (soundCell set) can
 * produce a countable error — the manual "Check" button re-validates the
 * whole grid without targeting one cell, and must never move the error
 * counter no matter how many still-wrong cells it reveals. Pulled out as
 * its own named, tested function rather than left as an inline `if
 * (soundCell && ...)` at the call site, which would silently break the
 * very first time someone passes a soundCell from a new call path. */
export function shouldCountAsError(soundCell: unknown, incorrect: boolean): boolean {
  return Boolean(soundCell) && incorrect;
}
