"use client";

import { useMemo, useRef, useState } from "react";
import type { PublicCrosswordPuzzle, PublicCrosswordWord } from "@/lib/word-games/data";
import {
  buildCellWordMap,
  cellsOfWord,
  firstEmptyCellInWord,
  isWordSolved,
  nextCellInWord,
  prevCellInWord,
  resolveDirectionOnClick,
  shouldCountAsError,
  sortClues,
  wordAt,
  type Direction,
} from "@/lib/word-games/crossword-input";
import { playCorrectTone, playIncorrectTone } from "@/lib/sound";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface Dict {
  hintButton: string;
  cluesTitle: string;
  acrossLabel: string;
  downLabel: string;
  wrongCellHint: string;
  checkButton: string;
  filledCountLabel: string; // template, contains literal "{filled}" and "{total}"
}

type CellStatus = "correct" | "incorrect" | undefined;

export default function CrosswordBoard({
  puzzle,
  dict,
  onHintUsed,
  onSolved,
  onErrorCountChange,
}: {
  puzzle: PublicCrosswordPuzzle;
  dict: Dict;
  onHintUsed: () => void;
  onSolved: () => void;
  /** Fires with the running mistake tally — every wrong letter typed into
   * a cell counts once; the manual "Check" button never does, however
   * many wrong cells it reveals (see shouldCountAsError). Optional: only
   * WordGamePlayer's result screen needs this. */
  onErrorCountChange?: (count: number) => void;
}) {
  const cellWordMap = useMemo(() => buildCellWordMap(puzzle.words), [puzzle.words]);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const solvedReported = useRef(false);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const errorCountRef = useRef(0);

  function focusCell(row: number, col: number) {
    inputRefs.current.get(`${row},${col}`)?.focus();
  }

  async function runCheck(nextGuesses: Record<string, string>, soundCell?: { row: number; col: number }) {
    const guessList = Object.entries(nextGuesses).map(([key, letter]) => {
      const [row, col] = key.split(",").map(Number);
      return { row, col, letter };
    });
    if (guessList.length === 0) return;

    const res = await fetch("/api/word-games/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: puzzle.id, guesses: guessList }),
    }).catch(() => null);
    if (!res || !res.ok) return;
    const data = (await res.json()) as { results: { row: number; col: number; correct: boolean }[]; solved: boolean };

    const nextStatus: Record<string, CellStatus> = {};
    for (const r of data.results) nextStatus[`${r.row},${r.col}`] = r.correct ? "correct" : "incorrect";
    setCellStatus(nextStatus);

    if (soundCell) {
      const status = nextStatus[`${soundCell.row},${soundCell.col}`];
      if (status === "correct") {
        playCorrectTone();
        hapticSuccess();
      } else if (status === "incorrect") {
        playIncorrectTone();
        hapticError();
      }
      if (shouldCountAsError(soundCell, status === "incorrect")) {
        errorCountRef.current += 1;
        onErrorCountChange?.(errorCountRef.current);
      }
    }

    if (data.solved && !solvedReported.current) {
      solvedReported.current = true;
      onSolved();
    }
  }

  function updateGuess(row: number, col: number, letter: string | undefined, soundCell?: { row: number; col: number }) {
    setGuesses((prev) => {
      const next = { ...prev };
      const key = `${row},${col}`;
      if (letter) next[key] = letter;
      else delete next[key];
      void runCheck(next, soundCell);
      return next;
    });
  }

  function activateCell(row: number, col: number) {
    const direction = resolveDirectionOnClick(cellWordMap, row, col, activeDirection, activeCell);
    setActiveCell({ row, col });
    setActiveDirection(direction);
  }

  function handleCellClick(row: number, col: number) {
    if (puzzle.blocked[row]?.[col]) return;
    activateCell(row, col);
    focusCell(row, col);
  }

  function handleChange(row: number, col: number, rawValue: string) {
    const letter = rawValue.slice(-1);
    if (!letter) return;
    updateGuess(row, col, letter.toLowerCase(), { row, col });

    const word = activeDirection ? wordAt(cellWordMap, row, col, activeDirection)?.word : null;
    if (word) {
      const next = nextCellInWord(word, row, col);
      if (next) {
        setActiveCell(next);
        focusCell(next.row, next.col);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key !== "Backspace") return;
    e.preventDefault();
    const key = `${row},${col}`;
    if (guesses[key]) {
      updateGuess(row, col, undefined);
      return;
    }
    const word = activeDirection ? wordAt(cellWordMap, row, col, activeDirection)?.word : null;
    if (!word) return;
    const prev = prevCellInWord(word, row, col);
    if (prev) {
      updateGuess(prev.row, prev.col, undefined);
      setActiveCell(prev);
      focusCell(prev.row, prev.col);
    }
  }

  function handleClueClick(word: PublicCrosswordWord) {
    setActiveDirection(word.direction as Direction);
    const cell = firstEmptyCellInWord(word, new Map(Object.entries(guesses))) ?? cellsOfWord(word)[0];
    setActiveCell(cell);
    focusCell(cell.row, cell.col);
  }

  function handleHint() {
    if (!activeCell) return;
    const key = `${activeCell.row},${activeCell.col}`;
    if (guesses[key]) return;
    void fetch("/api/word-games/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: puzzle.id, row: activeCell.row, col: activeCell.col }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { row: number; col: number; letter: string } | null) => {
        if (!data) return;
        onHintUsed();
        updateGuess(data.row, data.col, data.letter);
      })
      // A network failure here (offline, DNS, etc.) used to reject with no
      // handler — same class of unhandled-rejection bug as
      // SerwistRegister.tsx. No hint appears; the player can just tap again.
      .catch(() => {});
  }

  // Manual re-check of every filled cell — deliberately calls runCheck
  // with no soundCell, so shouldCountAsError never counts it as a
  // mistake no matter how many wrong cells it reveals.
  function handleCheck() {
    void runCheck(guesses);
  }

  const correctCells = useMemo(() => {
    const set = new Set<string>();
    for (const [key, status] of Object.entries(cellStatus)) if (status === "correct") set.add(key);
    return set;
  }, [cellStatus]);
  const activeWord = activeCell && activeDirection ? wordAt(cellWordMap, activeCell.row, activeCell.col, activeDirection)?.word : null;
  const activeWordCells = activeWord ? new Set(cellsOfWord(activeWord).map((c) => `${c.row},${c.col}`)) : new Set<string>();
  // Filters defensively even though updateGuess's `delete` already keeps
  // cleared cells out of `guesses` entirely — a stray empty-string value
  // here would otherwise silently inflate the fill count.
  const filledCount = Object.values(guesses).filter(Boolean).length;
  const totalCells = cellWordMap.size;

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
      {/* overflow-x-auto is the safety net for puzzles wide enough that
          even the shrunk 22px floor below doesn't fit the viewport — the
          grid scrolls horizontally rather than squeezing cells illegibly
          small. minmax(22px, 2.5rem) makes columns shrink together with
          the container (unlike a fixed w-9 on the cells themselves, which
          silently overlapped instead of shrinking — the bug this replaces).
          Framed in a card so the puzzle reads as one bounded object
          instead of loose cells floating on the page background. */}
      <div className="max-w-full overflow-x-auto rounded-2xl border border-primary/15 bg-background p-3 shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.18)] sm:p-4">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(22px, 2.5rem))` }}
          role="grid"
          aria-label="crossword"
        >
          {puzzle.blocked.map((rowCells, row) =>
            rowCells.map((isBlocked, col) => {
              if (isBlocked) {
                return <div key={`${row},${col}`} className="aspect-square" aria-hidden />;
              }
              const key = `${row},${col}`;
              const number = puzzle.words.find((w) => w.row === row && w.col === col)?.number;
              const status = cellStatus[key];
              const isActive = activeCell?.row === row && activeCell?.col === col;
              const inActiveWord = activeWordCells.has(key);
              return (
                <div key={key} className="relative aspect-square">
                  {number ? (
                    <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] font-semibold text-primary-text/50">
                      {number}
                    </span>
                  ) : null}
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(key, el);
                      else inputRefs.current.delete(key);
                    }}
                    value={guesses[key]?.toUpperCase() ?? ""}
                    maxLength={1}
                    inputMode="text"
                    aria-label={`row ${row + 1} col ${col + 1}`}
                    title={status === "incorrect" ? dict.wrongCellHint : undefined}
                    onClick={() => handleCellClick(row, col)}
                    onFocus={() => activateCell(row, col)}
                    onChange={(e) => handleChange(row, col, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, row, col)}
                    className={`absolute inset-0 h-full w-full rounded-[3px] border text-center text-xs font-semibold uppercase focus:outline-none sm:text-base ${
                      status === "correct"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : status === "incorrect"
                          ? "border-red-400 bg-red-400/10 text-red-600 dark:text-red-400"
                          : isActive
                            ? "border-primary bg-primary/10"
                            : inActiveWord
                              ? "border-primary/40 bg-primary/[0.04]"
                              : "border-black/15 dark:border-white/20"
                    }`}
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="self-center text-xs font-medium text-foreground/50 md:self-start">
          {dict.filledCountLabel.replace("{filled}", String(filledCount)).replace("{total}", String(totalCells))}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
          <button
            type="button"
            onClick={handleHint}
            disabled={!activeCell}
            className="tap min-h-11 w-fit rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10 active:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dict.hintButton}
          </button>
          <button
            type="button"
            onClick={handleCheck}
            disabled={filledCount === 0}
            className="tap min-h-11 w-fit rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dict.checkButton}
          </button>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            {dict.acrossLabel}
          </h2>
          <ClueList
            words={sortClues(puzzle.words.filter((w) => w.direction === "E"))}
            correctCells={correctCells}
            activeWord={activeWord}
            onClick={handleClueClick}
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">{dict.downLabel}</h2>
          <ClueList
            words={sortClues(puzzle.words.filter((w) => w.direction === "S"))}
            correctCells={correctCells}
            activeWord={activeWord}
            onClick={handleClueClick}
          />
        </div>
      </div>
    </div>
  );
}

function ClueList({
  words,
  correctCells,
  activeWord,
  onClick,
}: {
  words: PublicCrosswordWord[];
  correctCells: Set<string>;
  activeWord: PublicCrosswordWord | null | undefined;
  onClick: (word: PublicCrosswordWord) => void;
}) {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 text-sm">
      {words.map((word) => {
        const solved = isWordSolved(word, correctCells);
        const isActive = activeWord === word;
        return (
          <li key={`${word.direction}-${word.number}`}>
            <button
              type="button"
              onClick={() => onClick(word)}
              className={`tap flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                isActive ? "bg-primary/10" : "hover:bg-primary/5 active:bg-primary/5"
              } ${solved ? "text-emerald-600 line-through dark:text-emerald-400" : ""}`}
            >
              <span className="font-semibold">{word.number}.</span>
              <span>{word.clue}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
