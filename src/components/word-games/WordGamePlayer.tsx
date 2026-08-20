"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPuzzle } from "@/lib/word-games/data";
import type { Locale } from "@/i18n/config";
import CrosswordBoard from "./CrosswordBoard";
import WordSearchBoard from "./WordSearchBoard";
import CelebrationModal from "@/components/celebration/CelebrationModal";

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
  signedIn,
}: {
  lang: Locale;
  puzzle: PublicPuzzle;
  dict: WordGamePlayerDict;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [usedHint, setUsedHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const completeReported = useRef(false);

  const handleHintUsed = useCallback(() => setUsedHint(true), []);

  const handleSolved = useCallback(() => {
    setSolved(true);
    setShowCelebration(true);
    if (completeReported.current) return;
    completeReported.current = true;
    const timeSeconds = Math.round((Date.now() - startedAt) / 1000);
    void fetch("/api/word-games/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzleId: puzzle.id, timeSeconds, usedHint }),
    });
  }, [puzzle.id, usedHint, startedAt]);

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
        <CrosswordBoard puzzle={puzzle} dict={dict} onHintUsed={handleHintUsed} onSolved={handleSolved} />
      ) : (
        <WordSearchBoard puzzle={puzzle} dict={dict} onSolved={handleSolved} />
      )}

      <CelebrationModal
        open={showCelebration}
        title={dict.solvedTitle}
        subtitle={dict.solvedSubtitle}
        ctaLabel={dict.playAgainButton}
        onClose={() => {
          setShowCelebration(false);
          router.push(`/${lang}/word-games`);
        }}
      />
    </div>
  );
}
