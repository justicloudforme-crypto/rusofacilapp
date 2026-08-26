"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPuzzle } from "@/lib/word-games/data";
import type { Locale } from "@/i18n/config";
import CrosswordBoard from "./CrosswordBoard";
import WordSearchBoard from "./WordSearchBoard";
import CelebrationModal from "@/components/celebration/CelebrationModal";
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";

export interface WordGamePlayerDict {
  hintButton: string;
  hintUsedNote: string;
  wordsFoundLabel: string;
  cluesTitle: string;
  acrossLabel: string;
  downLabel: string;
  signInToSaveNote: string;
  solvedTitle: string;
  solvedSubtitle: string;
  playAgainButton: string;
  wrongCellHint: string;
  resetSelectionButton: string;
  expertModeLabel: string;
  backToWordGames: string;
  checkButton: string;
  filledCountLabel: string; // template, contains literal "{filled}" and "{total}"
}

/** Orchestrates one puzzle attempt: picks the right board (crossword vs
 * word search), tracks elapsed time + whether a hint was used this
 * attempt, and reports completion once the board reports solved. Boards
 * hold their own cell-level state; this component only cares about the
 * attempt-level outcome. */
export default function WordGamePlayer({
  lang,
  puzzle,
  dict,
  resultDict,
  signedIn,
}: {
  lang: Locale;
  puzzle: PublicPuzzle;
  dict: WordGamePlayerDict;
  resultDict: GameResultPanelDict;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [usedHint, setUsedHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  // Bumped on "play again" and used as CrosswordBoard/WordSearchBoard's
  // key — forces a full remount so guesses/found-words/timer/hint-used
  // all reset cleanly for a fresh attempt at the same puzzle, instead of
  // trying to hand-reset each board's internal state piece by piece.
  const [attempt, setAttempt] = useState(0);
  // Only crossword reports this (word search has no "wrong attempt"
  // concept) — undefined keeps GameResultPanel's error row hidden there.
  // Starts at 0 (not undefined) for crossword so a perfect solve — zero
  // wrong letters, onErrorCountChange never fires — still shows "0", not
  // an incorrectly hidden stat.
  const [errorCount, setErrorCount] = useState<number | undefined>(puzzle.type === "CROSSWORD" ? 0 : undefined);
  const completeReported = useRef(false);

  const handleHintUsed = useCallback(() => setUsedHint(true), []);

  const handleSolved = useCallback(() => {
    setSolved(true);
    setShowCelebration(true);
    setRoundTimeSeconds(Math.round((Date.now() - startedAt) / 1000));
    if (completeReported.current) return;
    completeReported.current = true;
    const timeSeconds = Math.round((Date.now() - startedAt) / 1000);
    void fetch("/api/word-games/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: puzzle.id, timeSeconds, usedHint }),
    });
  }, [puzzle.id, usedHint, startedAt]);

  function playAgain() {
    setAttempt((a) => a + 1);
    setUsedHint(false);
    setSolved(false);
    setShowCelebration(false);
    setStartedAt(Date.now());
    setErrorCount(puzzle.type === "CROSSWORD" ? 0 : undefined);
    completeReported.current = false;
  }

  function backToList() {
    router.push(`/${lang}/word-games`);
  }

  return (
    <div className="flex flex-col gap-6">
      {!signedIn && (
        <p className="rounded-xl border border-dashed border-black/10 p-3 text-sm text-foreground/60 dark:border-white/15">
          {dict.signInToSaveNote}
        </p>
      )}

      {usedHint && !solved && (
        <p className="text-xs font-medium text-foreground/50">{dict.hintUsedNote}</p>
      )}

      {puzzle.type === "CROSSWORD" ? (
        <CrosswordBoard
          key={attempt}
          puzzle={puzzle}
          dict={dict}
          onHintUsed={handleHintUsed}
          onSolved={handleSolved}
          onErrorCountChange={setErrorCount}
        />
      ) : (
        <WordSearchBoard key={attempt} puzzle={puzzle} dict={dict} onSolved={handleSolved} />
      )}

      <CelebrationModal
        open={showCelebration}
        title={dict.solvedTitle}
        subtitle={dict.solvedSubtitle}
        ctaLabel={dict.playAgainButton}
        onClose={() => setShowCelebration(false)}
      />

      <GameResultPanel
        open={solved}
        onClose={backToList}
        title={dict.solvedTitle}
        timeSeconds={roundTimeSeconds}
        errors={errorCount}
        dict={resultDict}
        playAgainLabel={dict.playAgainButton}
        onPlayAgain={playAgain}
        nextGameLabel={dict.backToWordGames}
        onNextGame={backToList}
      >
        {usedHint && <p className="text-xs font-medium text-foreground/50">{dict.hintUsedNote}</p>}
      </GameResultPanel>
    </div>
  );
}
