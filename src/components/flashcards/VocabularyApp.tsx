"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import FlashcardsApp, { type FlashcardsDict } from "./FlashcardsApp";
import IdiomsList, { type IdiomsDict } from "./IdiomsList";
import RecallApp, { type RecallAppDict } from "./RecallApp";
import MatchApp, { type MatchAppDict } from "./MatchApp";
import FillBlankApp, { type FillBlankAppDict } from "./FillBlankApp";
import type { Dictionary } from "@/i18n/dictionaries";
import { hapticTap } from "@/lib/haptics";
import { DictionaryIcon, ChecklistIcon, PuzzleIcon, BookIcon } from "@/components/profile/ProfileIcons";

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
  recall: Omit<RecallAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta">;
  match: Omit<MatchAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta">;
  fillBlank: Omit<FillBlankAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta">;
}

type Mode = "vocabulary" | "recall" | "fillBlank" | "match" | "idioms";

const MODE_VALUES: readonly Mode[] = ["vocabulary", "recall", "fillBlank", "match", "idioms"];
function isMode(value: string | null): value is Mode {
  return value !== null && (MODE_VALUES as readonly string[]).includes(value);
}

export default function VocabularyApp({
  dict,
  celebrationDict,
}: {
  dict: VocabularyDict;
  celebrationDict: Dictionary["celebration"];
}) {
  const [mode, setModeState] = useState<Mode>("vocabulary");
  const router = useRouter();
  const pathname = usePathname();

  // Restores which mode the learner was on from ?mode= — the mode itself
  // was never lost by the language switcher (LanguageSwitcher.tsx already
  // carries the full pathname+search through a locale switch), what was
  // missing was ANY record of the mode outside this component's own
  // useState, which a locale switch's real navigation always remounts.
  // Same hydration-safe "start with the default, correct after mount"
  // pattern LanguageSwitcher.tsx itself uses for its own `search` read —
  // reading useSearchParams() here would force this whole page to opt out
  // of static rendering just for this one restore.
  useLayoutEffect(() => {
    const urlMode = new URLSearchParams(window.location.search).get("mode");
    if (isMode(urlMode)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeState(urlMode);
    }
  }, []);

  function setMode(next: Mode) {
    hapticTap();
    setModeState(next);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", next);
    // replace, not push: this is a tab switch within one page, not a new
    // navigable location — same reasoning profile/page.tsx's own ?tab=
    // links don't need history entries either.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tabs: { value: Mode; label: string; icon: React.ReactNode }[] = [
    { value: "vocabulary", label: dict.modeVocabulary, icon: <DictionaryIcon className="h-5 w-5" /> },
    { value: "recall", label: dict.modeRecall, icon: <ChecklistIcon className="h-5 w-5" /> },
    { value: "fillBlank", label: dict.modeFillBlank, icon: <ChecklistIcon className="h-5 w-5" /> },
    { value: "match", label: dict.modeMatch, icon: <PuzzleIcon className="h-5 w-5" /> },
    { value: "idioms", label: dict.modeIdioms, icon: <BookIcon className="h-5 w-5" /> },
  ];

  return (
    <div>
      <div role="tablist" className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={mode === tab.value}
            onClick={() => setMode(tab.value)}
            className={`tap flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-sm font-medium transition-all active:scale-[0.97] ${
              mode === tab.value
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-black/10 text-foreground/70 hover:border-foreground/30 hover:text-foreground dark:border-white/10"
            }`}
          >
            {tab.icon}
            <span className="leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      <div key={mode} className="animate-tab-fade-in">
        {mode === "vocabulary" && <FlashcardsApp dict={dict} />}
        {mode === "recall" && (
          <RecallApp
            dict={{
              ...dict.recall,
              categoryLabels: dict.categoryLabels,
              cardCountLabel: dict.cardCountLabel,
              nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
              freeTrialLimitMessage: dict.freeTrialLimitMessage,
              freeTrialLimitCta: dict.freeTrialLimitCta,
            }}
            celebrationDict={celebrationDict}
          />
        )}
        {mode === "fillBlank" && (
          <FillBlankApp
            dict={{
              ...dict.fillBlank,
              categoryLabels: dict.categoryLabels,
              cardCountLabel: dict.cardCountLabel,
              nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
              freeTrialLimitMessage: dict.freeTrialLimitMessage,
              freeTrialLimitCta: dict.freeTrialLimitCta,
            }}
            celebrationDict={celebrationDict}
          />
        )}
        {mode === "match" && (
          <MatchApp
            dict={{
              ...dict.match,
              categoryLabels: dict.categoryLabels,
              cardCountLabel: dict.cardCountLabel,
              nextLevelBadgeLabel: dict.nextLevelBadgeLabel,
              freeTrialLimitMessage: dict.freeTrialLimitMessage,
              freeTrialLimitCta: dict.freeTrialLimitCta,
            }}
            celebrationDict={celebrationDict}
          />
        )}
        {mode === "idioms" && <IdiomsList dict={dict.idioms} />}
      </div>
    </div>
  );
}
