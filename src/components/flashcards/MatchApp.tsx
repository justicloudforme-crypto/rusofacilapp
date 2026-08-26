"use client";

import { useEffect, useState } from "react";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import CategoryGrid, { type CategoryGridDict, type CategorySummary } from "./CategoryGrid";
import ContinueStrip from "./ContinueStrip";
import FreeTrialLimitBanner from "./FreeTrialLimitBanner";
import LevelFilterBar from "./LevelFilterBar";
import MatchBoard, { type MatchResult } from "./MatchBoard";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { buildMatchRound } from "@/lib/flashcards/match-round";
import { recordSrsAnswer } from "@/lib/flashcard-progress";
import { fetchCategorySummary, type RecentCategory } from "@/lib/flashcards/summary-client";
import CelebrationModal from "@/components/celebration/CelebrationModal";
import type { Dictionary } from "@/i18n/dictionaries";

export interface MatchAppDict extends CategoryGridDict {
  levelAll: string;
  backToCategories: string;
  instructionLabel: string;
  notEnoughCardsMessage: string;
  roundCompleteLabel: string; // template, contains literal "{pairs}"
  nextRoundButton: string;
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
}

const ROUND_SIZES = [4, 6, 8];
const MIN_PLAYABLE = 4;

export default function MatchApp({
  dict,
  celebrationDict,
}: {
  dict: MatchAppDict;
  celebrationDict: Dictionary["celebration"];
}) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [hasAnyProgress, setHasAnyProgress] = useState(false);
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundKey, setRoundKey] = useState(0);
  const [complete, setComplete] = useState(false);
  // True only right after a round just finished this visit — drives the
  // CelebrationModal, which the underlying static "complete" screen (with
  // its own back/next-round buttons) stays behind once dismissed.
  const [justCompleted, setJustCompleted] = useState(false);
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    fetchCategorySummary(levelFilter).then((body) => {
      setCategorySummary(body.categories);
      setRecentCategories(body.recent);
      setHasAnyProgress(body.hasAnyProgress);
    });
  }, [levelFilter, round]);

  function startRound(size: number, sourceCards: FlashcardRow[], level: FlashcardLevel | "all") {
    const filtered = level === "all" ? sourceCards : sourceCards.filter((c) => c.level === level);
    setRound(buildMatchRound(filtered, size));
    setRoundKey((k) => k + 1);
    setComplete(false);
    setJustCompleted(false);
  }

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setSizeIndex(0);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean }) => {
        const cards = body.cards ?? [];
        setCategoryCards(cards);
        setLimited(Boolean(body.limited));
        startRound(ROUND_SIZES[0], cards, levelFilter);
      })
      .catch(() => {
        setCategoryCards([]);
        startRound(ROUND_SIZES[0], [], levelFilter);
      });
  }

  function backToCategories() {
    setCategory(null);
    setRound([]);
    setComplete(false);
    setJustCompleted(false);
    setLimited(false);
  }

  function handleComplete(results: MatchResult[]) {
    for (const r of results) recordSrsAnswer(r.cardId, r.firstTryCorrect);
    setComplete(true);
    setJustCompleted(true);
  }

  function nextRound() {
    const nextIndex = Math.min(sizeIndex + 1, ROUND_SIZES.length - 1);
    setSizeIndex(nextIndex);
    startRound(ROUND_SIZES[nextIndex], categoryCards, levelFilter);
  }

  const inGrid = !category;

  return (
    <div>
      {/* Level is locked (disabled) for the duration of a round, same rule
          as recall/fill-blank — matching a category immediately starts a
          round here, so "in a round" and "a category is selected" are the
          same condition. To play a different level, back out to the
          category grid first, same as changing category. */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <LevelFilterBar dict={dict} value={levelFilter} onChange={setLevelFilter} disabled={Boolean(category)} />
      </div>

      <CelebrationModal
        open={justCompleted}
        title={dict.roundCompleteLabel.replace("{pairs}", String(round.length))}
        ctaLabel={celebrationDict.continueButton}
        exclamations={celebrationDict.exclamations}
        onClose={() => setJustCompleted(false)}
      />

      {inGrid ? (
        <>
          <ContinueStrip dict={dict} recent={recentCategories} onSelectCategory={selectCategory} />
          <CategoryGrid
            dict={dict}
            summary={categorySummary}
            hasAnyProgress={hasAnyProgress}
            levelFilter={levelFilter}
            onSelectCategory={selectCategory}
          />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={backToCategories}
            className="tap mb-4 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground active:text-foreground"
          >
            {dict.backToCategories}
          </button>

          {limited && (
            <FreeTrialLimitBanner message={dict.freeTrialLimitMessage} cta={dict.freeTrialLimitCta} />
          )}

          {complete ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 p-10 text-center dark:border-white/10">
              <MatryoshkaAvatar id="matryoshka_laughing" size={64} />
              <p className="text-lg font-semibold">{dict.roundCompleteLabel.replace("{pairs}", String(round.length))}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={backToCategories}
                  className="tap rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:border-foreground/40 active:text-foreground dark:border-white/15"
                >
                  {dict.backToCategories}
                </button>
                <button
                  type="button"
                  onClick={nextRound}
                  className="tap touch-manipulation select-none rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
                >
                  {dict.nextRoundButton}
                </button>
              </div>
            </div>
          ) : round.length < MIN_PLAYABLE ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
              {dict.notEnoughCardsMessage}
            </p>
          ) : (
            <>
              <p className="mb-4 text-center text-xs font-medium text-foreground/50">{dict.instructionLabel}</p>
              <MatchBoard key={roundKey} cards={round} onComplete={handleComplete} />
            </>
          )}
        </>
      )}
    </div>
  );
}
