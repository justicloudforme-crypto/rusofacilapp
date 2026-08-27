"use client";

import { useEffect, useRef, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import CategoryGrid, { type CategoryGridDict, type CategorySummary } from "./CategoryGrid";
import ContinueStrip from "./ContinueStrip";
import FillBlankCard, { type FillBlankCardDict } from "./FillBlankCard";
import FreeTrialLimitBanner from "./FreeTrialLimitBanner";
import LevelFilterBar from "./LevelFilterBar";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { checkRecallAnswer, type RecallResult } from "@/lib/flashcards/recall-round";
import { buildFillBlankRound } from "@/lib/flashcards/fill-blank-round";
import { getSrsProgress, recordSrsAnswer, syncSrsProgress, type SrsEntry } from "@/lib/flashcard-progress";
import { fetchCategorySummary, type RecentCategory } from "@/lib/flashcards/summary-client";
import CelebrationModal from "@/components/celebration/CelebrationModal";
import StreakToast from "@/components/celebration/StreakToast";
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";
import { playStreakFanfare } from "@/lib/sound";
import { hapticSuccess } from "@/lib/haptics";
import type { Dictionary } from "@/i18n/dictionaries";

export interface FillBlankAppDict extends CategoryGridDict, FillBlankCardDict {
  levelAll: string;
  backToCategories: string;
  noCategoryCardsMessage: string;
  roundCompleteLabel: string; // template, contains literal "{correct}" and "{total}"
  playAgainButton: string;
  streakToastLabel: string; // template, contains literal "{count}"
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
  learnedProgressLabel: string; // template, contains literal "{known}" and "{total}"
}

const ROUND_SIZE = 10;
const STREAK_MILESTONE = 3;
const STREAK_TOAST_MS = 1800;

export default function FillBlankApp({
  dict,
  celebrationDict,
  resultDict,
}: {
  dict: FillBlankAppDict;
  celebrationDict: Dictionary["celebration"];
  resultDict: GameResultPanelDict;
}) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [hasAnyProgress, setHasAnyProgress] = useState(false);
  const [totalProgress, setTotalProgress] = useState({ known: 0, total: 0 });
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  const [srsMap, setSrsMap] = useState<Record<string, SrsEntry>>({});
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [result, setResult] = useState<RecallResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [complete, setComplete] = useState(false);
  const [justComplete, setJustComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [streakToast, setStreakToast] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);
  const streakToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundStartedAtRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrsMap(getSrsProgress());
    syncSrsProgress().then(setSrsMap);
  }, []);

  useEffect(() => {
    fetchCategorySummary(levelFilter).then((body) => {
      setCategorySummary(body.categories);
      setRecentCategories(body.recent);
      setHasAnyProgress(body.hasAnyProgress);
      setTotalProgress({ known: body.totalKnown, total: body.totalWords });
    });
  }, [round, levelFilter, complete]);

  const card = round[roundIndex];

  function startRound(sourceCards: FlashcardRow[]) {
    const pool = levelFilter === "all" ? sourceCards : sourceCards.filter((c) => c.level === levelFilter);
    setRound(buildFillBlankRound(pool, srsMap, ROUND_SIZE));
    setRoundIndex(0);
    setResult(null);
    setScore({ correct: 0, total: 0 });
    setComplete(false);
    setJustComplete(false);
    setStreak(0);
    roundStartedAtRef.current = Date.now();
  }

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setRoundLoading(true);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean }) => {
        setLimited(Boolean(body.limited));
        startRound(body.cards ?? []);
      })
      .catch(() => startRound([]))
      .finally(() => setRoundLoading(false));
  }

  function backToCategories() {
    setCategory(null);
    setRound([]);
    setComplete(false);
    setJustComplete(false);
    setLimited(false);
  }

  function handleSubmit(answer: string) {
    if (!card) return;
    const outcome = checkRecallAnswer(answer, card.russian);
    setResult(outcome);
    setScore((s) => ({ correct: s.correct + (outcome === "correct" ? 1 : 0), total: s.total + 1 }));
    const entry = recordSrsAnswer(card.id, outcome === "correct");
    setSrsMap((prev) => ({ ...prev, [card.id]: entry }));

    const newStreak = outcome === "correct" ? streak + 1 : 0;
    setStreak(newStreak);
    if (outcome === "correct" && newStreak > 0 && newStreak % STREAK_MILESTONE === 0) {
      playStreakFanfare();
      hapticSuccess();
      setStreakToast(newStreak);
      if (streakToastTimer.current) clearTimeout(streakToastTimer.current);
      streakToastTimer.current = setTimeout(() => setStreakToast(null), STREAK_TOAST_MS);
    }
  }

  function handleNext() {
    if (roundIndex + 1 >= round.length) {
      setRoundTimeSeconds(Math.round((Date.now() - roundStartedAtRef.current) / 1000));
      setComplete(true);
      setJustComplete(true);
      return;
    }
    setRoundIndex((i) => i + 1);
    setResult(null);
  }

  useEffect(() => {
    return () => {
      if (streakToastTimer.current) clearTimeout(streakToastTimer.current);
    };
  }, []);

  const inGrid = !category;

  return (
    <div>
      {streakToast !== null && (
        <StreakToast label={dict.streakToastLabel.replace("{count}", String(streakToast))} />
      )}
      <CelebrationModal
        open={justComplete}
        title={dict.roundCompleteLabel.replace("{correct}", String(score.correct)).replace("{total}", String(score.total))}
        ctaLabel={celebrationDict.continueButton}
        exclamations={celebrationDict.exclamations}
        onClose={() => setJustComplete(false)}
      />

      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <LevelFilterBar dict={dict} value={levelFilter} onChange={setLevelFilter} disabled={Boolean(category)} />
      </div>

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
            title={dict.roundCompleteLabel.replace("{correct}", String(score.correct)).replace("{total}", String(score.total))}
            avatarId={score.correct === score.total ? "matryoshka_proud" : "matryoshka_happy"}
            score={score}
            timeSeconds={roundTimeSeconds}
            dict={resultDict}
            playAgainLabel={dict.playAgainButton}
            onPlayAgain={() => category && selectCategory(category)}
            nextGameLabel={dict.backToCategories}
            onNextGame={backToCategories}
          >
            <p className="mt-1 text-center text-sm text-foreground/60">
              {dict.learnedProgressLabel.replace("{known}", String(totalProgress.known)).replace("{total}", String(totalProgress.total))}
            </p>
          </GameResultPanel>

          {complete ? null : roundLoading ? (
            <div className="flex flex-col items-center gap-6">
              <Skeleton variant="rect" className="h-48 w-full" />
              <Skeleton variant="rect" className="h-11 w-full max-w-xs rounded-xl" />
            </div>
          ) : !card ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/30">
              {dict.noCategoryCardsMessage}
            </p>
          ) : (
            <FillBlankCard key={card.id} dict={dict} card={card} result={result} onSubmit={handleSubmit} onNext={handleNext} />
          )}
        </>
      )}
    </div>
  );
}
