"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicWordSearchPuzzle } from "@/lib/word-games/data";
import { extendPath, extendPathStraight, matchSelection, type Cell } from "@/lib/word-games/word-search-select";
import { playCorrectTone } from "@/lib/sound";
import { hapticSuccess } from "@/lib/haptics";

interface Dict {
  wordsFoundLabel: string;
  /** Accessible name of the letter grid. Was the English literal "word
   * search" on a site with no English interface at all. */
  wordSearchGridLabel: string;
  resetSelectionButton: string;
  expertModeLabel: string;
}

function cellKey(c: Cell): string {
  return `${c.row},${c.col}`;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

// Each found word gets its own hue, cycling through this palette by
// discovery order — cell highlight and word-list chip share the same
// index so a word's cells and its label are visibly the same color.
// Picked for mutual contrast (not adjacent hues) and legibility in both
// themes; loops if a puzzle has more words than colors (rungs top out
// around 26, so a handful of repeats is fine — still far better than the
// single shared green this replaces).
const WORD_COLORS = [
  "bg-emerald-500/25 text-emerald-800 dark:text-emerald-300",
  "bg-sky-500/25 text-sky-800 dark:text-sky-300",
  "bg-rose-500/25 text-rose-800 dark:text-rose-300",
  "bg-amber-500/30 text-amber-800 dark:text-amber-300",
  "bg-violet-500/25 text-violet-800 dark:text-violet-300",
  "bg-lime-500/30 text-lime-800 dark:text-lime-300",
  "bg-cyan-500/25 text-cyan-800 dark:text-cyan-300",
  "bg-pink-500/25 text-pink-800 dark:text-pink-300",
  "bg-orange-500/25 text-orange-800 dark:text-orange-300",
  "bg-indigo-500/25 text-indigo-800 dark:text-indigo-300",
  "bg-teal-500/25 text-teal-800 dark:text-teal-300",
  "bg-fuchsia-500/25 text-fuchsia-800 dark:text-fuchsia-300",
];
const CHIP_COLORS = [
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  "border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-400",
  "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-400",
  "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
];

/** Maps a client (viewport) point to the nearest grid cell by measuring
 * real rendered cell positions — not by hit-testing which element is
 * under the pointer (elementFromPoint / native mouseenter, the original
 * approach: it silently lost the drag whenever the pointer strayed even
 * slightly outside a cell's button), and not by naively dividing the
 * grid's total bounding-box width by the column count either (tried
 * that first here: it ignores the CSS grid's `gap` between cells, which
 * accumulates into a systematic drift — wrong by a full column near the
 * far edge of a wide grid, confirmed by instrumenting a real drag that
 * silently landed one column short of the true target). Deriving the
 * actual column/row pitch from two real cells is correct regardless of
 * gap size, cell shrinkage, or any future layout tweak. */
function cellFromPoint(gridEl: HTMLElement, clientX: number, clientY: number, rows: number, cols: number): Cell {
  const origin = gridEl.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')?.getBoundingClientRect();
  if (!origin) return { row: 0, col: 0 };

  const colNeighbor = cols > 1 ? gridEl.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')?.getBoundingClientRect() : null;
  const rowNeighbor = rows > 1 ? gridEl.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')?.getBoundingClientRect() : null;
  const colPitch = colNeighbor ? colNeighbor.left - origin.left : origin.width;
  const rowPitch = rowNeighbor ? rowNeighbor.top - origin.top : origin.height;

  const col = Math.min(cols - 1, Math.max(0, Math.floor((clientX - origin.left) / colPitch)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((clientY - origin.top) / rowPitch)));
  return { row, col };
}

/** Applied on a fresh pointerdown/click (not on drag-move): if the tapped
 * cell doesn't continue the in-progress path (extend, backtrack, or
 * re-tap the same last cell), treat it as "start a new selection here"
 * instead of silently ignoring the tap — a desktop player clicking a
 * completely different word mid-build should just start that word, not
 * have the click swallowed. Drag-move uses extendPath directly instead
 * (see handlePointerMove) so a stray off-path sample during a continuous
 * gesture doesn't reset it. */
function startOrExtend(extend: (path: Cell[], next: Cell) => Cell[], path: Cell[], cell: Cell): Cell[] {
  if (path.length > 0 && sameCell(path[path.length - 1], cell)) return path;
  const extended = extend(path, cell);
  if (extended !== path) return extended;
  return [cell];
}

export default function WordSearchBoard({
  puzzle,
  dict,
  onSolved,
}: {
  puzzle: PublicWordSearchPuzzle;
  dict: Dict;
  onSolved: () => void;
}) {
  const [path, setPath] = useState<Cell[]>([]);
  // Mirrors `path`, updated synchronously on every mutation. Needed
  // because pointermove fires several times per animation frame during a
  // real drag — React can batch/coalesce those `setPath` calls before a
  // re-render happens, so reading `path` (the render-closure value) from
  // one pointermove handler call to the next can see a stale value and
  // silently drop intermediate steps of the drag. Reading this ref
  // instead always sees the true latest path.
  const pathRef = useRef<Cell[]>([]);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  // word -> its index in WORD_COLORS/CHIP_COLORS, assigned in discovery
  // order so the Nth word found always gets the Nth palette color.
  const [wordColor, setWordColor] = useState<Map<string, number>>(new Map());
  const [foundCells, setFoundCells] = useState<Map<string, number>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const solvedReported = useRef(false);
  // True once real pointer *movement* extended the path during the
  // current down-to-up gesture — distinguishes a drag (which always
  // clears the selection on release, matched or not) from a discrete
  // click (which leaves the path standing for the next click to
  // continue), without needing two separate interaction "modes".
  const draggedRef = useRef(false);
  // True only between an actual pointerdown and its matching pointerup/
  // cancel — guards handlePointerMove so it only ever extends the path
  // while a button/touch is actually held. Without this, a REAL reported
  // bug: the Pointer Events API fires pointermove on plain hover too, not
  // only while a button is pressed, so merely moving the mouse across the
  // grid (no click at all) was silently building a selection on its own,
  // and once a click-built word was in progress, so much as passing the
  // cursor back over the grid kept extending it further.
  const isDraggingRef = useRef(false);

  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const selectionKeys = new Set(path.map(cellKey));
  // Curved/★ puzzles keep the free adjacency-only rule (bending is the
  // whole point); every other puzzle locks to a single ray after the
  // first step so a drag can't zigzag off the intended line — see
  // extendPathStraight's doc comment for the real bug this fixes.
  const extend = puzzle.curved ? extendPath : extendPathStraight;

  // The single point every path mutation (drag or click alike) funnels
  // through: checks the new path against the still-unfound words and
  // either commits a match (marking it found, coloring it, resetting)
  // or just stores the in-progress path. Called directly from the
  // pointer handlers below rather than from an effect reacting to `path`
  // — setting state synchronously inside an effect causes an avoidable
  // extra render, and there's no external system to synchronize with
  // here, so a plain function is the right tool.
  function updatePath(next: Cell[]) {
    pathRef.current = next;
    setPath(next);
  }

  function commitPath(next: Cell[]) {
    const unfound = puzzle.words.map((w) => w.word).filter((w) => !foundWords.has(w));
    const match = matchSelection(puzzle.grid, next, unfound);
    if (!match) {
      updatePath(next);
      return;
    }

    const colorIndex = foundWords.size % WORD_COLORS.length;
    const nextFound = new Set(foundWords);
    nextFound.add(match);
    setFoundWords(nextFound);
    setWordColor((prev) => new Map(prev).set(match, colorIndex));
    setFoundCells((prev) => {
      const copy = new Map(prev);
      for (const c of next) copy.set(cellKey(c), colorIndex);
      return copy;
    });
    playCorrectTone();
    hapticSuccess();
    updatePath([]);
    if (nextFound.size === puzzle.words.length && !solvedReported.current) {
      solvedReported.current = true;
      onSolved();
    }
  }

  // Cancels a pending click-built selection when the player clicks
  // anywhere outside the grid — the explicit "cancel by clicking outside"
  // affordance, alongside the reset button and re-tapping the last cell.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (pathRef.current.length === 0) return;
      if (gridRef.current?.contains(e.target as Node)) return;
      updatePath([]);
    }
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, cell: Cell) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggedRef.current = false;
    isDraggingRef.current = true;
    commitPath(startOrExtend(extend, pathRef.current, cell));
  }

  // Pointer capture (set on the cell the drag started on) keeps this
  // firing on that same element for the whole gesture regardless of
  // where the pointer physically is, so geometry — not hit-testing — is
  // what resolves the cell underneath it. Works identically for mouse,
  // touch, and pen. Reads pathRef (not the `path` state) because several
  // pointermove events can land within one React batch, and only the ref
  // is guaranteed up to date between them (see pathRef's own comment).
  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    // Guards against the Pointer Events API firing pointermove on plain
    // hover, not just while a button/touch is actually held — without
    // this check, moving the mouse over the grid with no click at all
    // would silently build a selection (see isDraggingRef's comment).
    if (!isDraggingRef.current) return;
    if (!gridRef.current) return;
    const cell = cellFromPoint(gridRef.current, e.clientX, e.clientY, rows, cols);
    const next = extend(pathRef.current, cell);
    if (next !== pathRef.current) {
      draggedRef.current = true;
      commitPath(next);
    }
  }

  function handlePointerUp() {
    isDraggingRef.current = false;
    // A drag always clears on release, matched or not (matches the
    // original swipe-to-select feel); a discrete click leaves the path
    // standing so the next click can continue building it.
    if (draggedRef.current) updatePath([]);
  }

  return (
    /* From `md` up this is two COLUMNS that share the row, not two
       intrinsically-sized boxes centred as a pair. Measured before the
       change: the board card and the clue/word list came to 668–696px
       inside a 720px container and stood centred with the leftover split
       into two dead margins, and the pair stayed exactly that wide as the
       page grew — the list is capped at max-w-sm (384px) and the board is
       fit-content, so neither followed the container. `flex-1 min-w-0`
       gives each half the column, and the board keeps its own card
       centred inside its half so a small puzzle does not stretch. */
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-6">
      {/* max-w-full/min-w-0 is what makes the scroller below actually work,
          and it is not decoration. This wrapper is a flex ITEM of the
          column above (align-items: center), so its cross-axis width is
          fit-content and it is allowed to grow past the container — which
          it did: a 16-column grid can shrink no further than its 22px
          floor (16 × 22 + 15 gaps + 2 × 13px card padding = 408px), so the
          wrapper became 408px inside a 312px column. The scroller's own
          `max-w-full` then resolved against THAT 408px and never engaged,
          and the whole document went 25px wide of a 360px viewport.
          Measured on production 30.08.2026: /es/sopa-de-letras-ruso,
          -clima, -comida, -compras (16 columns) failed at 360/375/390/393
          in both engines; -ciudad, -familia, -ropa (12 columns) fit and
          did not. Bounding this wrapper to the column gives the scroller a
          real limit, so a too-wide puzzle scrolls inside its own card —
          which is what the card was for. */}
      <div className="flex min-w-0 max-w-full flex-col items-center gap-2 md:flex-1">
        {puzzle.curved && (
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-text dark:bg-primary-400/15 dark:text-primary-400">
            ★ {dict.expertModeLabel}
          </span>
        )}
        {/* No lower bound on the column track, and that is the fix, not a
            tidy-up. With `minmax(22px, …)` a 16-column grid could shrink no
            further than 16 × 22 + gaps ≈ 394px, so inside a 340px scroller
            at a 390px viewport only THIRTEEN columns were on screen —
            measured from the DOM, both engines: 10 of 16 at 320px, 12 at
            360px, 13 at 390px. The remaining columns were not merely
            awkward, they were unreachable: every cell carries
            `touch-none` (it has to — a horizontal drag IS how you select a
            horizontal word), so a finger on the board cannot pan the
            scroller, and a horizontal word ending in column 14+ could not
            be selected at all on a phone.

            Panning and horizontal selection cannot share one surface —
            `touch-action: pan-x` would hand every horizontal drag to the
            scroller and break selection outright — so the board has to
            FIT instead. `minmax(0, …)` plus the tighter gap and card
            padding below `sm` puts all 16 columns on screen at 320/360/390
            (cells ≈ 15/17/19px there, still 36px from `sm` up). The
            scroller stays as the backstop for a future grid wider than 16.

            The columns still shrink together with the container, which was
            the original reason for minmax at all: fixed-size buttons used
            to overlap instead of shrinking (same bug as CrosswordBoard's,
            fixed the same way — see its comment). Framed in a card,
            matching CrosswordBoard, so the puzzle reads as one bounded
            object instead of loose letters on the page. */}
        <div className="max-w-full overflow-x-auto rounded-2xl border border-primary/15 bg-background p-2 shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.18)] sm:p-4">
          <div
            ref={gridRef}
            className="grid touch-none select-none gap-px sm:gap-0.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.25rem))` }}
            role="grid"
            aria-label={dict.wordSearchGridLabel}
          >
            {puzzle.grid.map((rowCells, row) =>
              rowCells.map((letter, col) => {
                const key = cellKey({ row, col });
                const foundColorIndex = foundCells.get(key);
                const isSelecting = selectionKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    data-row={row}
                    data-col={col}
                    onPointerDown={(e) => handlePointerDown(e, { row, col })}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={`flex aspect-square w-full items-center justify-center rounded text-[11px] font-semibold uppercase leading-none transition-colors sm:text-base ${
                      foundColorIndex !== undefined
                        ? WORD_COLORS[foundColorIndex]
                        : isSelecting
                          ? "bg-primary/20"
                          : "hover:bg-primary/5"
                    }`}
                  >
                    {letter}
                  </button>
                );
              }),
            )}
          </div>
        </div>
        {path.length > 0 && (
          <button
            type="button"
            onClick={() => updatePath([])}
            className="w-fit rounded-full border border-primary/20 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:border-primary hover:text-primary-text"
          >
            ✕ {dict.resetSelectionButton}
          </button>
        )}
      </div>

      <div className="w-full max-w-sm md:min-w-0 md:max-w-none md:flex-1">
        <p className="text-sm font-medium text-foreground/60">
          {dict.wordsFoundLabel.replace("{found}", String(foundWords.size)).replace("{total}", String(puzzle.words.length))}
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
          {puzzle.words.map((w) => {
            const colorIndex = wordColor.get(w.word);
            return (
              <li
                key={w.word}
                data-word={w.word}
                className={`rounded-full border px-3 py-1 text-sm ${
                  colorIndex !== undefined
                    ? `${CHIP_COLORS[colorIndex]} line-through`
                    : "border-black/10 dark:border-white/15"
                }`}
              >
                {w.word}
                {w.clue && <span className="opacity-70"> ({w.clue})</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
