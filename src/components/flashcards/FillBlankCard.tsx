"use client";

import AnswerPad, { type AnswerPadDict } from "./AnswerPad";
import { getBlankedSentence } from "@/lib/flashcards/fill-blank-round";
import type { FlashcardRow } from "@/lib/flashcards";
import type { RecallResult } from "@/lib/flashcards/recall-round";

export interface FillBlankCardDict extends AnswerPadDict {
  instructionLabel: string;
}

export default function FillBlankCard({
  dict,
  card,
  result,
  onSubmit,
  onNext,
}: {
  dict: FillBlankCardDict;
  card: FlashcardRow;
  result: RecallResult | null;
  onSubmit: (answer: string) => void;
  onNext: () => void;
}) {
  // Always non-null in practice — buildFillBlankRound only ever selects
  // cards that pass this same check — but a card is still just data, so
  // this stays a graceful bail-out rather than a non-null assertion.
  const span = getBlankedSentence(card);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-black/10 bg-background p-6 text-center dark:border-white/10">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">{dict.instructionLabel}</span>
        {span ? (
          <p className="text-xl leading-relaxed">
            {span.before}
            <span className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-foreground/40 align-bottom">
              &nbsp;
            </span>
            {span.after}
          </p>
        ) : (
          <p className="text-xl leading-relaxed">{card.exampleRu}</p>
        )}
        {card.exampleEs && <p className="text-sm text-foreground/50">{card.exampleEs}</p>}
      </div>

      <AnswerPad dict={dict} alphabet="cyrillic" correctAnswer={card.russian} result={result} onSubmit={onSubmit} onNext={onNext} />
    </div>
  );
}
