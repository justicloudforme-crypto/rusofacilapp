"use client";

import { useState } from "react";
import AnswerPad, { type AnswerPadDict } from "./AnswerPad";
import { getBlankedSentence } from "@/lib/flashcards/fill-blank-round";
import type { FlashcardRow } from "@/lib/flashcards";
import type { RecallResult } from "@/lib/flashcards/recall-round";

export interface FillBlankCardDict extends AnswerPadDict {
  instructionLabel: string;
}

function blankColorClass(result: RecallResult | null): string {
  if (result === "correct") return "text-emerald-700 dark:text-emerald-400";
  if (result === "almost") return "text-amber-700 dark:text-amber-400";
  if (result === "incorrect") return "text-rose-700 dark:text-rose-400";
  return "text-foreground";
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
  const [liveAnswer, setLiveAnswer] = useState("");

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-black/10 bg-background p-6 text-center dark:border-white/30">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">{dict.instructionLabel}</span>
        {span ? (
          <p className="text-xl leading-relaxed">
            {span.before}
            <span
              className={`mx-1 inline-block min-w-16 px-1 pb-0.5 align-bottom font-semibold transition-colors ${blankColorClass(result)}`}
              style={{
                // A background-gradient underline instead of `border-bottom:
                // dashed` — WebKit on iOS unreliably paints dashed borders on
                // short inline-block elements (renders fine on desktop
                // Chrome/Safari, silently vanishes on mobile Safari). A
                // background image doesn't hit that code path and renders
                // consistently everywhere; `currentColor` keeps it in sync
                // with the feedback color above.
                backgroundImage: "linear-gradient(to right, currentColor 60%, transparent 0%)",
                backgroundSize: "8px 2px",
                backgroundRepeat: "repeat-x",
                backgroundPosition: "bottom",
              }}
            >
              {liveAnswer || " "}
            </span>
            {span.after}
          </p>
        ) : (
          <p className="text-xl leading-relaxed">{card.exampleRu}</p>
        )}
        {card.exampleEs && <p className="text-sm text-foreground/50">{card.exampleEs}</p>}
      </div>

      <AnswerPad
        dict={dict}
        alphabet="cyrillic"
        correctAnswer={card.russian}
        result={result}
        onSubmit={onSubmit}
        onNext={onNext}
        hideAnswerBox
        onAnswerChange={setLiveAnswer}
      />
    </div>
  );
}
