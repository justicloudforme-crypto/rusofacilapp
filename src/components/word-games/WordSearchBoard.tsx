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

function cellFromElement(el: Element | null): Cell | null {
  const target = el?.closest<HTMLElement>("[data-row]");
  if (!target) return null;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
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
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const solvedReported = useRef(false);

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
          const nextFound = new Set(foundWords);
          nextFound.add(match);
          setFoundWords(nextFound);
          setFoundCells((prev) => {
            const next = new Set(prev);
            for (const c of path) next.add(cellKey(c));
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

  function handlePointerDown(cell: Cell) {
    setStart(cell);
    setCurrent(cell);
  }

  function handlePointerEnter(cell: Cell) {
    if (start) setCurrent(cell);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!start) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = cellFromElement(el);
    if (cell) setCurrent(cell);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div
        ref={gridRef}
        className="grid w-fit touch-none select-none gap-0.5"
        style={{ gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 0}, minmax(0, 1fr))` }}
        onMouseUp={finalizeSelection}
        onMouseLeave={() => start && finalizeSelection()}
        onTouchEnd={finalizeSelection}
        onTouchMove={handleTouchMove}
        role="grid"
        aria-label="word search"
      >
        {puzzle.grid.map((rowCells, row) =>
          rowCells.map((letter, col) => {
            const key = cellKey({ row, col });
            const isFound = foundCells.has(key);
            const isSelecting = selectionKeys.has(key);
            return (
              <button
                key={key}
                type="button"
                data-row={row}
                data-col={col}
                onMouseDown={() => handlePointerDown({ row, col })}
                onMouseEnter={() => handlePointerEnter({ row, col })}
                onTouchStart={() => handlePointerDown({ row, col })}
                className={`flex h-8 w-8 items-center justify-center rounded text-sm font-semibold uppercase transition-colors sm:h-9 sm:w-9 ${
                  isFound
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
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

      <div className="flex-1">
        <p className="text-sm font-medium text-foreground/60">
          {dict.wordsFoundLabel.replace("{found}", String(foundWords.size)).replace("{total}", String(puzzle.words.length))}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {puzzle.words.map((w) => {
            const isFound = foundWords.has(w.word);
            return (
              <li
                key={w.word}
                className={`rounded-full border px-3 py-1 text-sm ${
                  isFound
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 line-through dark:text-emerald-400"
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
