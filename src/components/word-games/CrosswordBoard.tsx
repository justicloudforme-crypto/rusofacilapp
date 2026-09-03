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
  /** Accessible name of the grid. Was the English literal "crossword" on a
   * site whose interface is only ever Spanish or Russian. */
  crosswordGridLabel: string;
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
  // Mirror of `guesses` that is up to date synchronously — see updateGuess.
  const guessesRef = useRef<Record<string, string>>({});
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const solvedReported = useRef(false);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const errorCountRef = useRef(0);

  function focusCell(row: number, col: number) {
    const el = inputRefs.current.get(`${row},${col}`);
    if (!el) return;
    // `preventScroll` is the point, not a detail. Whatever reveal the engine
    // performs on focus is ITS decision, taken against the LAYOUT viewport,
    // and it is not the same decision twice: Chromium centres the cell
    // synchronously inside `focus()`, WebKit defers the same work, and CI's
    // Linux WebKit did not do it at all — which is exactly how a green local
    // run turned red on the build that matters (PROGRESS.md 7.96). Asking
    // the engine not to scroll makes the reveal below the ONLY thing that
    // moves the page or the board, so the outcome is the product's own
    // guarantee rather than a bet on the engine.
    //
    // An engine that does not know the option ignores it and reveals the
    // cell itself; the reveal below then finds a fully visible cell and
    // leaves it alone. So the fallback is "correct, by someone else's
    // arithmetic", never "hidden".
    el.focus({ preventScroll: true });
    revealCell(el);
  }

  /**
   * Brings the just-focused cell fully inside the board's scroller.
   *
   * Why the board has to do this itself. The board is deliberately wider
   * than a phone (PROGRESS.md 7.92: 1071 of 1262 puzzles do not fit at
   * 320px, and a column cannot shrink below 22px without becoming
   * unreadable), so typing a word walks the caret straight off the right
   * edge. Until now nothing here scrolled at all — `focusCell` was a bare
   * `.focus()` — and the board leaned on the browser's own "reveal the
   * focused element" behaviour. That behaviour is not a guarantee, and it
   * is not the same in two engines:
   *
   *   measured, WebKit, iPhone 13 viewport at 320px, geometry settled to
   *   three identical frames — typing across row 4 of B1/91:
   *     col 11  cell 277..299  scrollport 25..295  scrollLeft 0   ← OUTSIDE
   *     col 12  cell 148..170  scrollport 25..295  scrollLeft 153
   *
   * Column 11 is PARTLY visible, and WebKit's focus reveal
   * (`alignCenterIfNeeded`) does nothing at all in the partial case — so a
   * cell 4px past the edge just stays there. Column 12 is fully hidden, so
   * it gets centred, and that one sweep happens to drag the rest of the
   * word inside with 29px to spare. Which cells end up on which side of
   * that line is decided by the engine and by how many keystrokes fit
   * between two rendering updates, not by anything this component does.
   *
   * So the reveal is done here, minimally (the cell moves to the nearest
   * edge, never gets centred), and synchronously with the focus rather
   * than a frame later. A cell that is already fully inside is left alone,
   * which also means the browser's own deferred reveal afterwards sees a
   * fully-visible element and does nothing.
   */
  function revealCell(el: HTMLInputElement) {
    const scroller = el.closest<HTMLElement>("[data-crossword-scroller]");
    if (!scroller) return;
    const cell = el.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    // The scrollport is the PADDING box: clientLeft is the border, and
    // clientWidth already excludes both borders. Using the border box here
    // would leave the cell one border-width outside.
    const portLeft = box.left + scroller.clientLeft;
    const portRight = portLeft + scroller.clientWidth;
    if (cell.right > portRight) scroller.scrollLeft += cell.right - portRight;
    else if (cell.left < portLeft) scroller.scrollLeft -= portLeft - cell.left;
    revealBelowKeyboard(el);
  }

  /**
   * The same minimal reveal, on the other axis — for the strip of the page
   * that the on-screen keyboard covers.
   *
   * Why the horizontal reveal above is not enough. It moves the BOARD
   * inside its own scroller, which is the whole story for a word typed
   * across a row. A word typed DOWN never moves the board sideways at all;
   * it walks the caret down the page, straight under the keyboard. Nothing
   * scrolls, nothing errors, and the letters keep landing in cells the
   * typist cannot see.
   *
   * Why the engine's own reveal does not cover it. On iOS the keyboard does
   * NOT resize the layout viewport — it shrinks the VISUAL viewport and
   * leaves `innerHeight` alone. The engine reveals a focused element into
   * the layout viewport, so as far as it is concerned a cell at y = 460 out
   * of 780 is on screen, and it does nothing. `window.visualViewport` is
   * the only thing in the page that knows otherwise.
   *
   * Why this axis has to move the PAGE and not the board. Measured
   * 03.09.2026 on B1/91 at 320px, both engines, both keyboard models — the
   * board's own scroller is horizontal ONLY:
   *
   *   scrollWidth 1126 − clientWidth 270 = 856px of sideways travel
   *   scrollHeight 286 − clientHeight 286 =   0px of vertical travel
   *   probe: `scroller.scrollTop = 50` leaves scrollTop at 0
   *
   * (`overflow-y` COMPUTES to `auto` — a non-visible `overflow-x` forces it
   * — so the element looks vertically scrollable and is not. The document
   * is: 1810–2146px of page travel in the same measurement.) So a word
   * typed down is the page's business, and the correction below is the only
   * thing that moves it, because `focusCell` takes the engine's own reveal
   * off the table with `preventScroll`.
   *
   * That is the lesson of 7.96 and it is worth stating plainly. The first
   * edition of this function did the opposite: it stood down whenever the
   * visual viewport matched the layout one, on the grounds that the engine's
   * reveal was then the right one and a second reveal would fight it. Locally
   * that was true and measured (WebKit scrolled itself 0 → 235px at step 8).
   * On CI's Linux WebKit the same build scrolled 0px and the cell stayed
   * under the fold — a red PR from a green bench, because the product's
   * guarantee had been delegated to a decision the engine takes differently
   * in different builds.
   *
   * Bounds come from `visualViewport` (`offsetTop` included: pinch-zoom
   * moves the visual viewport inside the layout one, and the rect this is
   * compared against is in layout coordinates). With no such API the page's
   * own `innerHeight` is the only bound there is — which is right for every
   * engine that also has no keyboard shrinking the visual viewport, and is
   * still a real reveal rather than a stand-down.
   */
  function revealBelowKeyboard(el: HTMLInputElement) {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    // Nearest edge, never centred — same rule as the horizontal branch, and
    // a cell already fully inside is left alone. That is also what keeps an
    // engine that ignored `preventScroll` from being fought: it revealed the
    // cell already, so there is nothing here left to do.
    //
    // Rounded AWAY from the cell, and that is a fix rather than a detail.
    // The distance asked for here is fractional (the grid's rows do not
    // land on whole pixels), and WebKit TRUNCATES a fractional scroll
    // offset — probed directly: `scrollTop = 150.5` leaves `scrollY` at
    // 150. Passing the raw 23.5 therefore moved 23, the cell stopped at
    // 423..445 against a bound of 444, and it was still under the keyboard
    // by one row of pixels; a follow-up pass asking for the remaining 0.5
    // was truncated to 0 and moved nothing at all. `ceil`/`floor` overshoot
    // by less than a pixel and land the cell inside in one move, in both
    // engines.
    const cell = el.getBoundingClientRect();
    if (cell.bottom > bottom) window.scrollBy(0, Math.ceil(cell.bottom - bottom));
    else if (cell.top < top) window.scrollBy(0, Math.floor(cell.top - top));
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

  // The grading request is fired HERE, not from inside a setState updater.
  // It used to live inside `setGuesses(prev => { … runCheck(next) … })`, and
  // an updater has to be pure: React is free to call it more than once, or
  // to discard and replay it, so a fetch in there is guaranteed neither to
  // happen exactly once nor to happen at all.
  //
  // Honest scope: this is a correctness fix against React's contract, NOT
  // the explanation for anything observed. It was written while chasing a
  // crossword that occasionally never completed, and the run afterwards
  // showed the same failure — that turned out to be the e2e suite's own
  // `fill()` racing a controlled input, fixed in the test, PROGRESS.md 7.52.
  // Kept because the pattern is wrong on its own terms and the next thing
  // to trip on it (a StrictMode double-invoke, a replayed render) would
  // send the same grading POST twice.
  //
  // `guessesRef` rather than the `guesses` state because this function is
  // called several times before React re-renders; the ref is what makes each
  // call see the previous one's letter.
  function updateGuess(row: number, col: number, letter: string | undefined, soundCell?: { row: number; col: number }) {
    const next = { ...guessesRef.current };
    const key = `${row},${col}`;
    if (letter) next[key] = letter;
    else delete next[key];
    guessesRef.current = next;
    setGuesses(next);
    syncCell(row, col, letter);
    void runCheck(next, soundCell);
  }

  /**
   * Puts one cell's DOM value where `guesses` says it should be — the whole
   * of what the removed `value={…}` prop used to do, minus the part that was
   * losing keystrokes.
   *
   * The defect it replaces. Each cell was a controlled input, so React
   * rewrote its `value` on every render of the board, and the board
   * re-renders far more often than the typist touches it: every keystroke
   * changes `guesses`, and every grading response changes `cellStatus` at
   * some arbitrary later moment. React also keeps a private "value tracker"
   * per input and fires `onChange` only when the value it sees at event time
   * differs from the last value it wrote itself. So if one of those renders
   * lands in the window between the browser editing the field and the
   * `input` event being dispatched, React has already put "" back — the
   * event arrives with an empty value, the tracker sees no change, and
   * **`onChange` is never called at all.** The letter is gone, and nothing
   * anywhere reports a failure.
   *
   * Measured twice over, not deduced. A capture listener above React saw the
   * raw `input` event carrying an empty value; a probe inside `handleChange`
   * showed it was never invoked for that cell. One mechanism, two views of
   * it. It needs the edit and the event to be in separate tasks, which is
   * why it surfaced under WebKit driven at speed and not under a person.
   *
   * Writing one cell instead of all of them is the point: an unrelated
   * render can no longer touch a field somebody is typing into, because no
   * render touches any field any more. Everything that is not the typist —
   * a hint, a clear, a reset — comes through updateGuess and lands here.
   *
   * (The rejected fix, recorded so it is not tried again: React's
   * `onBeforeInput`. It never fires at all in WebKit, and in Chromium it is
   * a synthesised event whose `preventDefault` does not stop the edit, so it
   * was inert on the one engine that had the bug and double-applied on the
   * other. PROGRESS.md 7.54.)
   */
  function syncCell(row: number, col: number, letter: string | undefined) {
    const el = inputRefs.current.get(`${row},${col}`);
    if (!el) return;
    const want = letter ? letter.toUpperCase() : "";
    if (el.value !== want) el.value = want;
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
    // An empty value is a real edit, not nothing to do: cut, select-all +
    // Delete, and several on-screen keyboards clear a field this way.
    // Discarding it is what made Delete look like a dead key.
    if (!letter) {
      updateGuess(row, col, undefined);
      return;
    }
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
    // Delete does exactly what Backspace does. A cell holds a single
    // character, so there is no "forward" left for Delete to mean, and
    // before this it did nothing at all: its default action produces an
    // input event with an empty value, which handleChange used to discard.
    // Two keys that both look like "erase this" must not disagree about
    // whether erasing works.
    if (e.key !== "Backspace" && e.key !== "Delete") return;
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
      {/* overflow-x-auto is the safety net for puzzles wide enough that
          even the shrunk 22px floor below doesn't fit the viewport — the
          grid scrolls horizontally rather than squeezing cells illegibly
          small. minmax(22px, 2.5rem) makes columns shrink together with
          the container (unlike a fixed w-9 on the cells themselves, which
          silently overlapped instead of shrinking — the bug this replaces).
          Framed in a card so the puzzle reads as one bounded object
          instead of loose cells floating on the page background. */}
      <div
        data-crossword-scroller
        className="max-w-full overflow-x-auto rounded-2xl border border-primary/15 bg-background p-3 shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.18)] sm:p-4 md:mx-auto md:min-w-0 md:flex-1">
        <div
          className="grid w-fit gap-0.5 md:mx-auto"
          style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(22px, 2.5rem))` }}
          role="grid"
          aria-label={dict.crosswordGridLabel}
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
                    // Uncontrolled on purpose, and this is a fix, not a
                    // shortcut — see syncCell. `value={guesses[key]}` made
                    // React rewrite this field on EVERY render, including
                    // renders caused by another cell's grading response, and
                    // a rewrite that lands between the browser's edit and the
                    // input event's dispatch eats the keystroke silently.
                    // The board still owns the letter: `guesses` is the only
                    // source of truth, and syncCell writes it here.
                    defaultValue=""
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

      <div className="flex w-full max-w-sm flex-col gap-4 md:min-w-0 md:max-w-none md:flex-1">
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
