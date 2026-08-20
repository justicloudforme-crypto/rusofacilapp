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

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr !== 0 || dc !== 0) && dr <= 1 && dc <= 1;
}

/** The one rule both selection inputs share — a continuous drag and a
 * sequence of discrete clicks both just call this on every new cell the
 * player lands on. Handles a straight word as a degenerate case of a
 * general path, which is what makes one mechanism cover both the
 * original straight-line drag and a curved/"snake" word's bent path:
 *
 * - empty path: `next` becomes the sole first cell.
 * - `next` is the path's current last cell (hovering in place / a
 *   repeat click): no-op, returns the *same* array reference so a caller
 *   using this in a state updater doesn't trigger a pointless re-render.
 * - `next` is the path's second-to-last cell: the player backtracked —
 *   pop the last cell.
 * - `next` is 8-adjacent to the last cell and not already anywhere else
 *   in the path: extend.
 * - anything else (a jump, or revisiting a non-tail cell): ignored,
 *   returns the path unchanged. */
export function extendPath(path: Cell[], next: Cell): Cell[] {
  if (path.length === 0) return [next];

  const last = path[path.length - 1];
  if (sameCell(last, next)) return path;

  if (path.length >= 2 && sameCell(path[path.length - 2], next)) {
    return path.slice(0, -1);
  }

  if (isAdjacent(last, next) && !path.some((c) => sameCell(c, next))) {
    return [...path, next];
  }

  return path;
}

/** Same three interactions as extendPath (start, backtrack, extend) but
 * for a word that can only ever be a single straight ray (every non-★
 * puzzle): once the path has 2 cells, the direction between them is
 * locked, and every further cell must be exactly `last + direction` or
 * it's ignored outright rather than accepted.
 *
 * This is the fix for a real reported bug: dragging the mouse along a
 * diagonal, the pointer's actual pixel path routinely strays onto a
 * neighboring row or column for a sample or two — plain extendPath
 * accepts that stray cell (it's still 8-adjacent to the path's last
 * cell) and the selection visibly zigzags off the word the player is
 * tracing. Locking the ray after the first step means a stray sample
 * off that ray is simply ignored — the selection holds steady on the
 * intended line and only resumes growing once the pointer comes back
 * onto it, instead of derailing.
 *
 * Deliberately NOT used for curved/★ puzzles, whose whole point is
 * bending mid-word — those keep using plain extendPath (see
 * WordSearchBoard, which picks one or the other based on
 * `puzzle.curved`). */
export function extendPathStraight(path: Cell[], next: Cell): Cell[] {
  if (path.length === 0) return [next];

  const last = path[path.length - 1];
  if (sameCell(last, next)) return path;

  if (path.length >= 2 && sameCell(path[path.length - 2], next)) {
    return path.slice(0, -1);
  }

  if (path.length === 1) {
    // The second cell is what picks the ray's direction — any adjacent
    // cell is still a valid choice here, same as extendPath.
    return isAdjacent(last, next) ? [...path, next] : path;
  }

  const dirRow = Math.sign(path[1].row - path[0].row);
  const dirCol = Math.sign(path[1].col - path[0].col);
  const expected: Cell = { row: last.row + dirRow, col: last.col + dirCol };
  return sameCell(expected, next) ? [...path, next] : path;
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
