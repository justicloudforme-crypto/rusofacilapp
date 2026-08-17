"use client";

import SpeakButton from "@/components/lesson/SpeakButton";
import AnswerPad, { type AnswerPadDict } from "./AnswerPad";
import type { FlashcardRow } from "@/lib/flashcards";
import type { RecallResult } from "@/lib/flashcards/recall-round";

export type RecallDirection = "esToRu" | "ruToEs";

export interface RecallCardDict extends AnswerPadDict {
  promptEsToRu: string;
  promptRuToEs: string;
  listenLabel: string;
}

export default function RecallCard({
  dict,
  card,
  direction,
  result,
  onSubmit,
  onNext,
}: {
  dict: RecallCardDict;
  card: FlashcardRow;
  direction: RecallDirection;
  result: RecallResult | null;
  onSubmit: (answer: string) => void;
  onNext: () => void;
}) {
  const isEsToRu = direction === "esToRu";

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-black/10 bg-background p-6 text-center dark:border-white/10">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
          {isEsToRu ? dict.promptEsToRu : dict.promptRuToEs}
        </span>
        {isEsToRu ? (
          <>
            <span className="text-5xl">{card.emoji}</span>
            <span className="text-2xl font-semibold">{card.translationEs}</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-semibold">{card.russian}</span>
            <SpeakButton text={card.russian} label={dict.listenLabel} audioUrl={card.audioUrl ?? undefined} />
          </>
        )}
      </div>

      <AnswerPad
        dict={dict}
        alphabet={isEsToRu ? "cyrillic" : "latin"}
        correctAnswer={isEsToRu ? card.russian : card.translationEs}
        result={result}
        onSubmit={onSubmit}
        onNext={onNext}
      />
    </div>
  );
}
