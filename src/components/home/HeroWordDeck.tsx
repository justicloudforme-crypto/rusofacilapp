"use client";

import { useState } from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import type { FlashcardRow } from "@/lib/flashcards";

export interface HeroWordDeckDict {
  flipHint: string;
  listenLabel: string;
}

// Real vocabulary bank cards (see getHomepageWordSample), not invented
// copy — flip-to-reveal (tap toggles a rotateY class), audio via the same
// SpeakButton every practice screen uses, real pre-generated audioUrl
// first with browser speechSynthesis only as SpeakButton's own built-in
// fallback. motion-reduce disables the 3D transition, not the flip itself
// (state still toggles instantly).
export default function HeroWordDeck({ words, dict }: { words: FlashcardRow[]; dict: HeroWordDeckDict }) {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:flex-wrap sm:overflow-visible sm:px-0">
      {words.map((word) => {
        const flipped = flippedIds.has(word.id);
        return (
          <div key={word.id} className="w-44 flex-shrink-0 snap-center sm:w-40">
            <button
              type="button"
              onClick={() => toggle(word.id)}
              aria-label={dict.flipHint}
              aria-pressed={flipped}
              className="tap relative block h-52 w-full [perspective:1000px]"
            >
              <div
                className="relative h-full w-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
                style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
              >
                {/* Front: Russian word */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-black/10 bg-background p-4 text-center [backface-visibility:hidden] dark:border-white/10">
                  <span className="text-4xl" aria-hidden>
                    {word.emoji}
                  </span>
                  <span className="text-xl font-semibold">{word.russian}</span>
                  <span className="text-sm text-foreground/50">{word.transcription}</span>
                </div>
                {/* Back: Spanish translation + example */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center [backface-visibility:hidden]"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <span className="text-lg font-medium">{word.translationEs}</span>
                  <span className="text-xs text-foreground/60">{word.exampleEs}</span>
                </div>
              </div>
            </button>
            <div className="mt-2 flex min-h-11 items-center justify-center">
              <SpeakButton text={word.russian} label={dict.listenLabel} audioUrl={word.audioUrl ?? undefined} size="md" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
