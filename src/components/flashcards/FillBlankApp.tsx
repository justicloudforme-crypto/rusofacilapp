"use client";

import { useEffect, useRef, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import CategoryGrid, { type CategoryGridDict } from "./CategoryGrid";
import ContinueStrip from "./ContinueStrip";
import FillBlankCard, { type FillBlankCardDict } from "./FillBlankCard";
import FreeTrialLimitBanner, { LockedOrEmpty } from "./FreeTrialLimitBanner";
import LevelFilterBar from "./LevelFilterBar";
import { resumeRoundAt } from "@/lib/flashcards/resume-round";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { checkRecallAnswer, type RecallResult } from "@/lib/flashcards/recall-round";
import { buildFillBlankRound } from "@/lib/flashcards/fill-blank-round";
import { getSrsProgress, recordSrsAnswer, syncSrsProgress, type SrsEntry } from "@/lib/flashcard-progress";
import type { RecentCategory } from "@/lib/flashcards/summary-client";
import { useCategorySummary } from "@/lib/flashcards/use-category-summary";
import { lockedView } from "@/lib/flashcards/locked-view";
import StreakToast from "@/components/celebration/StreakToast";
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";
import { playStreakFanfare } from "@/lib/sound";
import { hapticSuccess } from "@/lib/haptics";
import { plural, type PluralForms } from "@/lib/plural";
import { learnedProgressText } from "@/lib/flashcards/learned-progress";

export interface FillBlankAppDict extends CategoryGridDict, FillBlankCardDict {
  levelAll: string;
  /** Подпись значка «нужен план Premium» — одна на весь сайт. */
  premiumTierBadge: string;
  subscriptionBadge: string;
  backToCategories: string;
  noCategoryCardsMessage: string;
  roundCompleteLabel: PluralForms; // templates, contain literal "{correct}" and "{total}". Inflects with {total}.
  playAgainButton: string;
  streakToastLabel: string; // template, contains literal "{count}"
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
  /** Шаблон «Продолжить со слова «{word}»» — содержит литерал "{word}". */
  continueWithWord: string;
  /** The "you've learned N of M" line. Two forms — see
   * lib/flashcards/learned-progress.ts for which one prints when. */
  learnedProgressLabel: PluralForms; // templates, contain literal "{known}" and "{total}". Inflects with {total}.
  learnedProgressAvailableLabel: PluralForms; // adds literal "{locked}". Inflects with {total}.
}

const ROUND_SIZE = 10;
const STREAK_MILESTONE = 3;
const STREAK_TOAST_MS = 1800;

export default function FillBlankApp({
  dict,
  resultDict,
}: {
  dict: FillBlankAppDict;
  resultDict: GameResultPanelDict;
}) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  const [srsMap, setSrsMap] = useState<Record<string, SrsEntry>>({});
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [result, setResult] = useState<RecallResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [complete, setComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [streakToast, setStreakToast] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  // Перепись закрытого из ответа сервера (долг 191).
  const [lockedTotal, setLockedTotal] = useState(0);
  const [lockedByLevel, setLockedByLevel] = useState<Record<string, number>>({});
  // Закрытое под текущим фильтром уровня: уровень здесь тоже
  // накладывает браузер (см. `pool` ниже), поэтому и разрез тот же.
  // Разрез плашки — один на четыре режима словаря (7.195, часть 2).
  const locked = lockedView({
    levelFilter,
    categoryLabel: category ? dict.categoryLabels[category] : null,
    lockedTotal,
    lockedByLevel,
  });
  const [roundLoading, setRoundLoading] = useState(false);
  /**
   * ПЕРЕПИСЬ ТЕМ ТЕКУЩЕГО РАЗРЕЗА — 7.199, часть 1.
   *
   * Один общий крючок на все четыре режима словаря. Он же держит признак
   * `summaryLevel` («какому разрезу принадлежат числа в руках»), который
   * читают сетка тем и строка «Продолжить»: пока он не совпал с выбранным
   * уровнем, чисел на экране нет вовсе. Почему это один крючок, а не
   * четыре эффекта, и какой дефект это чинит — в шапке
   * `src/lib/flashcards/use-category-summary.ts`.
   */
  const { summary, summaryLevel } = useCategorySummary(levelFilter, [round, complete]);
  const categorySummary = summary.categories;
  const bankCategories = summary.bankCategories;
  const bankLockedByLevel = summary.lockedByLevel;
  const summaryTier = summary.tier;
  const recentCategories: RecentCategory[] = summary.recent;
  const hasAnyProgress = summary.hasAnyProgress;
  const totalProgress = {
    known: summary.totalKnown,
    total: summary.availableWords,
    locked: summary.premiumOnlyWords,
  };
  const streakToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundStartedAtRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrsMap(getSrsProgress());
    syncSrsProgress().then(setSrsMap);
  }, []);

  const card = round[roundIndex];

  function startRound(sourceCards: FlashcardRow[], startCardId?: string | null) {
    const pool = levelFilter === "all" ? sourceCards : sourceCards.filter((c) => c.level === levelFilter);
    // См. RecallApp: слово, на котором остановились, идёт первым.
    setRound(resumeRoundAt(buildFillBlankRound(pool, srsMap, ROUND_SIZE), pool, startCardId));
    setRoundIndex(0);
    setResult(null);
    setScore({ correct: 0, total: 0 });
    setComplete(false);
    setStreak(0);
    roundStartedAtRef.current = Date.now();
  }

  function selectCategory(next: FlashcardCategory, startCardId?: string | null) {
    setCategory(next);
    setRoundLoading(true);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean; lockedTotal?: number; lockedByLevel?: Record<string, number> }) => {
        setLimited(Boolean(body.limited));
        setLockedTotal(body.lockedTotal ?? 0);
        setLockedByLevel(body.lockedByLevel ?? {});
        startRound(body.cards ?? [], startCardId);
      })
      .catch(() => startRound([]))
      .finally(() => setRoundLoading(false));
  }

  function backToCategories() {
    setCategory(null);
    setRound([]);
    setComplete(false);
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
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <LevelFilterBar dict={dict} value={levelFilter} onChange={setLevelFilter} disabled={Boolean(category)} />
      </div>

      {inGrid ? (
        <>
          <ContinueStrip
            dict={dict}
            recent={recentCategories}
            ready={summaryLevel !== undefined && (summaryLevel ?? "all") === levelFilter}
            onSelectCategory={selectCategory}
          />
          <CategoryGrid
            dict={dict}
            summary={categorySummary}
            hasAnyProgress={hasAnyProgress}
            levelFilter={levelFilter}
            bank={bankCategories}
            summaryLevel={summaryLevel}
            tier={summaryTier}
            lockedAtLevel={levelFilter === "all" ? 0 : (bankLockedByLevel[levelFilter] ?? 0)}
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
            <FreeTrialLimitBanner
              message={dict.freeTrialLimitMessage}
              cta={dict.freeTrialLimitCta}
              locale={dict.locale}
              lockedTotal={locked.lockedHere}
              level={locked.level}
              topic={locked.topic}
              requirement={locked.requirement}
              unit="words"
            />
          )}

          <GameResultPanel
            open={complete}
            onClose={backToCategories}
            title={plural(dict.locale, score.total, dict.roundCompleteLabel, { correct: score.correct, total: score.total })}
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
              {learnedProgressText(dict.locale, dict, {
                known: totalProgress.known,
                available: totalProgress.total,
                locked: totalProgress.locked,
              })}
            </p>
          </GameResultPanel>

          {complete ? null : roundLoading ? (
            <div className="flex flex-col items-center gap-6">
              <Skeleton variant="rect" className="h-48 w-full" />
              <Skeleton variant="rect" className="h-11 w-full max-w-xs rounded-xl" />
            </div>
          ) : !card ? (
            <LockedOrEmpty
              locale={dict.locale}
              emptyMessage={dict.noCategoryCardsMessage}
              lockedHere={locked.lockedHere}
              level={locked.level}
              topic={locked.topic}
              requirement={locked.requirement}
              unit="words"
              noticeAbove={limited}
            />
          ) : (
            <FillBlankCard key={card.id} dict={dict} card={card} result={result} onSubmit={handleSubmit} onNext={handleNext} />
          )}
        </>
      )}
    </div>
  );
}
