"use client";

import { useLayoutEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import FlashcardsApp, { type FlashcardsDict } from "./FlashcardsApp";
import IdiomsList, { type IdiomsDict } from "./IdiomsList";
import RecallApp, { type RecallAppDict } from "./RecallApp";
import MatchApp, { type MatchAppDict } from "./MatchApp";
import FillBlankApp, { type FillBlankAppDict } from "./FillBlankApp";
import type { GameResultPanelDict } from "@/components/games/GameResultPanel";
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
  // One short line per mode instead of one static page subtitle — the old
  // single subtitle described only the flip-card mode ("tap a card...") and
  // stayed on screen unchanged in the other 4 modes, where there's no card
  // to tap at all (a real report: it actively misled Recall/FillBlank/Match/
  // Idioms visitors). Kept short on purpose (see each dict entry) so it
  // never wraps past 2 lines and pushes the mode chips off the first mobile
  // screen.
  subtitleVocabulary: string;
  subtitleRecall: string;
  subtitleFillBlank: string;
  subtitleMatch: string;
  subtitleIdioms: string;
  idioms: IdiomsDict;
  recall: Omit<RecallAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta" | "continueTitle" | "learnedProgressLabel">;
  match: Omit<MatchAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta" | "continueTitle" | "learnedProgressLabel">;
  fillBlank: Omit<FillBlankAppDict, "categoryLabels" | "cardCountLabel" | "nextLevelBadgeLabel" | "freeTrialLimitMessage" | "freeTrialLimitCta" | "continueTitle" | "learnedProgressLabel">;
}

type Mode = "vocabulary" | "recall" | "fillBlank" | "match" | "idioms";

const MODE_VALUES: readonly Mode[] = ["vocabulary", "recall", "fillBlank", "match", "idioms"];
function isMode(value: string | null): value is Mode {
  return value !== null && (MODE_VALUES as readonly string[]).includes(value);
}

export default function VocabularyApp({
  dict,
  celebrationDict,
  resultDict,
}: {
  dict: VocabularyDict;
  celebrationDict: Dictionary["celebration"];
  resultDict: GameResultPanelDict;
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

  const subtitle: Record<Mode, string> = {
    vocabulary: dict.subtitleVocabulary,
    recall: dict.subtitleRecall,
    fillBlank: dict.subtitleFillBlank,
    match: dict.subtitleMatch,
    idioms: dict.subtitleIdioms,
  };

  return (
    <div>
      <p className="mb-6 max-w-xl text-foreground/70">{subtitle[mode]}</p>

      {/* Horizontal scroll-snap chip strip below sm: — 5 tiles in a
          grid-cols-2 wrap felt cramped/ugly at 375px (AUDIT.md-confirmed
          complaint). sm:+ has room for a proper grid, so it switches back
          there. -mx-4/px-4 lets the strip bleed to the screen edges (so the
          first/last chip isn't flush against the content padding) while
          the scroll-snap targets stay flush with the visible viewport.
          The mask-image fade (same technique as ui/Tabs.tsx) is the scroll
          affordance: at 375px only ~3.5 of the 5 chips fit, so the last one
          used to just get sliced off mid-label by the container's own
          edge with no visual hint that there was more to scroll to — read
          as "one card is smaller" (reported). Fading the trailing edge
          instead of hard-cutting it signals "scrollable" rather than
          "broken layout". */}
      <div
        role="tablist"
        className="mb-8 -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,black_0,black_calc(100%-28px),transparent_100%)] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 sm:[mask-image:none] lg:grid-cols-5"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={mode === tab.value}
            onClick={() => setMode(tab.value)}
            className={`tap flex w-24 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-sm font-medium transition-all active:scale-[0.97] sm:w-auto ${
              mode === tab.value
                ? "border-primary bg-primary/10 text-primary-text shadow-sm"
                : "border-black/10 text-foreground/70 hover:border-foreground/30 hover:text-foreground dark:border-white/30"
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
              continueTitle: dict.continueTitle,
              learnedProgressLabel: dict.learnedProgressLabel,
            }}
            celebrationDict={celebrationDict}
            resultDict={resultDict}
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
              continueTitle: dict.continueTitle,
              learnedProgressLabel: dict.learnedProgressLabel,
            }}
            celebrationDict={celebrationDict}
            resultDict={resultDict}
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
              continueTitle: dict.continueTitle,
              learnedProgressLabel: dict.learnedProgressLabel,
            }}
            celebrationDict={celebrationDict}
            resultDict={resultDict}
          />
        )}
        {mode === "idioms" && <IdiomsList dict={dict.idioms} />}
      </div>
    </div>
  );
}
