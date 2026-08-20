"use client";

import { useCallback, useRef, useState } from "react";
import type { PublicWordSearchPuzzle } from "@/lib/word-games/data";
import { lineBetween, matchSelection, type Cell } from "@/lib/word-games/word-search-select";
import { playCorrectTone } from "@/lib/sound";

interface Dict {
  wordsFoundLabel: string;
}

function cellKey(c: Cell): string {
  return `${c.row},${c.col}`;
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

/** Maps a client (viewport) point to the nearest grid cell by position
 * within the grid's bounding box, clamped in-bounds — not by hit-testing
 * which element is under the pointer. Hit-testing was the previous
 * approach (elementFromPoint / native mouseenter) and it silently lost
 * the drag whenever the pointer strayed even slightly outside a cell's
 * button (e.g. a long diagonal drag toward a corner, or fast touch
 * movement outrunning intermediate mouseenter events) — this is
 * geometry-based instead, so it can't "miss" a cell. */
function cellFromPoint(gridEl: HTMLElement, clientX: number, clientY: number, rows: number, cols: number): Cell {
  const rect = gridEl.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((relX / rect.width) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((relY / rect.height) * rows)));
  return { row, col };
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
  const [start, setStart] = useState<Cell | null>(null);
  const [current, setCurrent] = useState<Cell | null>(null);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  // word -> its index in WORD_COLORS/CHIP_COLORS, assigned in discovery
  // order so the Nth word found always gets the Nth palette color.
  const [wordColor, setWordColor] = useState<Map<string, number>>(new Map());
  const [foundCells, setFoundCells] = useState<Map<string, number>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);
  const solvedReported = useRef(false);

  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;

  const selectionPath = start && current ? lineBetween(start, current) : null;
  const selectionKeys = new Set((selectionPath ?? []).map(cellKey));

  const finalizeSelection = useCallback(() => {
    if (start && current) {
      const path = lineBetween(start, current);
      if (path) {
        const match = matchSelection(
          puzzle.grid,
          path,
          puzzle.words.map((w) => w.word),
        );
        if (match && !foundWords.has(match)) {
          const colorIndex = foundWords.size % WORD_COLORS.length;
          const nextFound = new Set(foundWords);
          nextFound.add(match);
          setFoundWords(nextFound);
          setWordColor((prev) => new Map(prev).set(match, colorIndex));
          setFoundCells((prev) => {
            const next = new Map(prev);
            for (const c of path) next.set(cellKey(c), colorIndex);
            return next;
          });
          playCorrectTone();
          if (nextFound.size === puzzle.words.length && !solvedReported.current) {
            solvedReported.current = true;
            onSolved();
          }
        }
      }
    }
    setStart(null);
    setCurrent(null);
  }, [start, current, foundWords, puzzle.grid, puzzle.words, onSolved]);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, cell: Cell) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setStart(cell);
    setCurrent(cell);
  }

  // Pointer capture (set on the cell the drag started on) keeps this
  // firing on that same element for the whole gesture regardless of
  // where the pointer physically is, so geometry — not hit-testing — is
  // what resolves the cell underneath it. Works identically for mouse,
  // touch, and pen.
  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!start || !gridRef.current) return;
    setCurrent(cellFromPoint(gridRef.current, e.clientX, e.clientY, rows, cols));
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* minmax(18px, 2rem) columns shrink together with the container
          (fixed-size buttons previously overlapped instead of shrinking —
          invisible here since these cells are borderless, but the same
          bug as CrosswordBoard's, fixed the same way; see its comment). */}
      <div className="max-w-full overflow-x-auto">
        <div
          ref={gridRef}
          className="grid touch-none select-none gap-0.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(18px, 2rem))` }}
          role="grid"
          aria-label="word search"
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
                  onPointerUp={finalizeSelection}
                  onPointerCancel={finalizeSelection}
                  className={`flex aspect-square w-full items-center justify-center rounded text-[10px] font-semibold uppercase transition-colors sm:text-sm ${
                    foundColorIndex !== undefined
                      ? WORD_COLORS[foundColorIndex]
                      : isSelecting
                        ? "bg-foreground/15"
                        : "hover:bg-foreground/5"
                  }`}
                >
                  {letter}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium text-foreground/60">
          {dict.wordsFoundLabel.replace("{found}", String(foundWords.size)).replace("{total}", String(puzzle.words.length))}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {puzzle.words.map((w) => {
            const colorIndex = wordColor.get(w.word);
            return (
              <li
                key={w.word}
                className={`rounded-full border px-3 py-1 text-sm ${
                  colorIndex !== undefined
                    ? `${CHIP_COLORS[colorIndex]} line-through`
                    : "border-black/10 dark:border-white/15"
                }`}
              >
                {w.word}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
