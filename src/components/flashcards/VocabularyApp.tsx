"use client";

import { useState } from "react";
import FlashcardsApp, { type FlashcardsDict } from "./FlashcardsApp";
import IdiomsList, { type IdiomsDict } from "./IdiomsList";

export interface VocabularyDict extends FlashcardsDict {
  modeVocabulary: string;
  modeIdioms: string;
  idioms: IdiomsDict;
}

type Mode = "vocabulary" | "idioms";

export default function VocabularyApp({ dict }: { dict: VocabularyDict }) {
  const [mode, setMode] = useState<Mode>("vocabulary");

  return (
    <div>
      <div role="tablist" className="mb-8 flex gap-1 rounded-full border border-black/10 p-1 dark:border-white/10">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "vocabulary"}
          onClick={() => setMode("vocabulary")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            mode === "vocabulary" ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
          }`}
        >
          {dict.modeVocabulary}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "idioms"}
          onClick={() => setMode("idioms")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            mode === "idioms" ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
          }`}
        >
          {dict.modeIdioms}
        </button>
      </div>

      {mode === "vocabulary" ? <FlashcardsApp dict={dict} /> : <IdiomsList dict={dict.idioms} />}
    </div>
  );
}
