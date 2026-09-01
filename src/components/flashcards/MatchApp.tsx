"use client";

import { useEffect, useRef, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
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
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";
import type { Dictionary } from "@/i18n/dictionaries";
import { plural, type PluralForms } from "@/lib/plural";

export interface MatchAppDict extends CategoryGridDict {
  levelAll: string;
  backToCategories: string;
  instructionLabel: string;
  notEnoughCardsMessage: string;
  roundCompleteLabel: PluralForms; // templates, contain literal "{pairs}"
  playAgainButton: string;
  nextRoundButton: string;
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
  learnedProgressLabel: PluralForms; // templates, contain literal "{known}" and "{total}". Inflects with {total}.
}

const ROUND_SIZES = [4, 6, 8];
const MIN_PLAYABLE = 4;

export default function MatchApp({
  dict,
  celebrationDict,
  resultDict,
}: {
  dict: MatchAppDict;
  celebrationDict: Dictionary["celebration"];
  resultDict: GameResultPanelDict;
}) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [hasAnyProgress, setHasAnyProgress] = useState(false);
  const [totalProgress, setTotalProgress] = useState({ known: 0, total: 0 });
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundKey, setRoundKey] = useState(0);
  const [complete, setComplete] = useState(false);
  const [roundErrors, setRoundErrors] = useState(0);
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  const roundStartedAtRef = useRef(0);
  // True only right after a round just finished this visit — drives the
  // CelebrationModal, which the underlying static "complete" screen (with
  // its own back/next-round buttons) stays behind once dismissed.
  const [justCompleted, setJustCompleted] = useState(false);
  const [limited, setLimited] = useState(false);
  // True only while a category's round is being fetched — without it, the
  // "not enough cards" message flashed for a moment on every category open
  // (round starts at [] before the fetch resolves, which is also < the
  // MIN_PLAYABLE floor below).
  const [roundLoading, setRoundLoading] = useState(false);

  useEffect(() => {
    fetchCategorySummary(levelFilter).then((body) => {
      setCategorySummary(body.categories);
      setRecentCategories(body.recent);
      setHasAnyProgress(body.hasAnyProgress);
      setTotalProgress({ known: body.totalKnown, total: body.totalWords });
    });
  }, [levelFilter, round, complete]);

  function startRound(size: number, sourceCards: FlashcardRow[], level: FlashcardLevel | "all") {
    const filtered = level === "all" ? sourceCards : sourceCards.filter((c) => c.level === level);
    setRound(buildMatchRound(filtered, size));
    setRoundKey((k) => k + 1);
    setComplete(false);
    setJustCompleted(false);
    roundStartedAtRef.current = Date.now();
  }

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setSizeIndex(0);
    setRoundLoading(true);
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
      })
      .finally(() => setRoundLoading(false));
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
    setRoundErrors(results.filter((r) => !r.firstTryCorrect).length);
    setRoundTimeSeconds(Math.round((Date.now() - roundStartedAtRef.current) / 1000));
    setComplete(true);
    setJustCompleted(true);
  }

  function replayRound() {
    startRound(ROUND_SIZES[sizeIndex], categoryCards, levelFilter);
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
        title={plural(dict.locale, round.length, dict.roundCompleteLabel, { pairs: round.length })}
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

          {/* Rendered here, outside GameResultPanel, on purpose — see
              RecallApp.tsx's identical comment: this used to also be
              duplicated inside the panel's `children`, putting a paywall
              upsell in the middle of the celebratory result modal. This
              spot already sits behind the modal while it's open and
              becomes visible the moment it closes. */}
          {limited && (
            <FreeTrialLimitBanner message={dict.freeTrialLimitMessage} cta={dict.freeTrialLimitCta} />
          )}

          <GameResultPanel
            open={complete}
            onClose={backToCategories}
            title={plural(dict.locale, round.length, dict.roundCompleteLabel, { pairs: round.length })}
            avatarId="matryoshka_laughing"
            errors={roundErrors}
            timeSeconds={roundTimeSeconds}
            dict={resultDict}
            playAgainLabel={dict.playAgainButton}
            onPlayAgain={replayRound}
            nextGameLabel={dict.nextRoundButton}
            onNextGame={nextRound}
          >
            <p className="mt-1 text-center text-sm text-foreground/60">
              {plural(dict.locale, totalProgress.total, dict.learnedProgressLabel, {
                known: totalProgress.known,
                total: totalProgress.total,
              })}
            </p>
          </GameResultPanel>

          {complete ? null : roundLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} variant="rect" className="h-14 rounded-xl" />
              ))}
            </div>
          ) : round.length < MIN_PLAYABLE ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/30">
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
