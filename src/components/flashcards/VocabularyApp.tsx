"use client";

import { useState } from "react";
import FlashcardsApp, { type FlashcardsDict } from "./FlashcardsApp";
import IdiomsList, { type IdiomsDict } from "./IdiomsList";
import RecallApp, { type RecallAppDict } from "./RecallApp";
import MatchApp, { type MatchAppDict } from "./MatchApp";
import FillBlankApp, { type FillBlankAppDict } from "./FillBlankApp";

// recall/match/fillBlank's dicts omit categoryLabels/cardCountLabel — those
// are reused from the top-level FlashcardsDict below rather than
// duplicated a third/fourth time in every locale file (21 category names
// each).
export interface VocabularyDict extends FlashcardsDict {
  modeVocabulary: string;
  modeRecall: string;
  modeFillBlank: string;
  modeMatch: string;
  modeIdioms: string;
  idioms: IdiomsDict;
  recall: Omit<RecallAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel">;
  match: Omit<MatchAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel">;
  fillBlank: Omit<FillBlankAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel">;
}

type Mode = "vocabulary" | "recall" | "fillBlank" | "match" | "idioms";

export default function VocabularyApp({ dict }: { dict: VocabularyDict }) {
  const [mode, setMode] = useState<Mode>("vocabulary");

  const tabs: { value: Mode; label: string }[] = [
    { value: "vocabulary", label: dict.modeVocabulary },
    { value: "recall", label: dict.modeRecall },
    { value: "fillBlank", label: dict.modeFillBlank },
    { value: "match", label: dict.modeMatch },
    { value: "idioms", label: dict.modeIdioms },
  ];

  return (
    <div>
      <div role="tablist" className="mb-8 flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={mode === tab.value}
            onClick={() => setMode(tab.value)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              mode === tab.value ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "vocabulary" && <FlashcardsApp dict={dict} />}
      {mode === "recall" && (
        <RecallApp
          dict={{
            ...dict.recall,
            categoryLabels: dict.categoryLabels,
            cardCountLabel: dict.cardCountLabel,
            nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
          }}
        />
      )}
      {mode === "fillBlank" && (
        <FillBlankApp
          dict={{
            ...dict.fillBlank,
            categoryLabels: dict.categoryLabels,
            cardCountLabel: dict.cardCountLabel,
            nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
          }}
        />
      )}
      {mode === "match" && (
        <MatchApp
          dict={{
            ...dict.match,
            categoryLabels: dict.categoryLabels,
            cardCountLabel: dict.cardCountLabel,
            nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
          }}
        />
      )}
      {mode === "idioms" && <IdiomsList dict={dict.idioms} />}
    </div>
  );
}
