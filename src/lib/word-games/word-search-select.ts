// Pure client-side Sopa de Letras selection logic. Unlike the crossword,
// the word-search public puzzle ships the FULL letter grid (see
// src/lib/word-games/data.ts's comment on why that's safe for this genre)
// but never word positions — so "is this selection a real word" is
// answered entirely on the client by reading letters off the grid along
// the dragged line and comparing against the word list, not by trusting
// server-sent coordinates.

export interface Cell {
  row: number;
  col: number;
}

/** The straight-line path of cells between two endpoints (inclusive), in
 * one of the 8 word-search directions, or null if the two cells aren't
 * aligned on any of them (e.g. a knight's-move drag). */
export function lineBetween(start: Cell, end: Cell): Cell[] | null {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  if (dr === 0 && dc === 0) return [{ ...start }];

  const isStraight = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
  if (!isStraight) return null;

  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  return Array.from({ length: steps + 1 }, (_, i) => ({ row: start.row + stepR * i, col: start.col + stepC * i }));
}

export function readWord(grid: string[][], cells: Cell[]): string {
  return cells.map((c) => grid[c.row]?.[c.col] ?? "").join("");
}

function normalize(word: string): string {
  return word.trim().toUpperCase();
}

/** Whether a selected path spells one of the target words, forwards or
 * backwards (word search entries can be placed in either reading
 * direction along their line — e.g. "W" is just "E" read backwards).
 * Returns the matched word (in its canonical/listed casing) or null. */
export function matchSelection(grid: string[][], cells: Cell[], words: string[]): string | null {
  const forward = normalize(readWord(grid, cells));
  const backward = [...forward].reverse().join("");
  return words.find((w) => normalize(w) === forward || normalize(w) === backward) ?? null;
}
