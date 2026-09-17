"use client";

import { useRef, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import CategoryGrid, { type CategoryGridDict } from "./CategoryGrid";
import ContinueStrip from "./ContinueStrip";
import LearnedProgressLine from "./LearnedProgressLine";
import FreeTrialLimitBanner from "./FreeTrialLimitBanner";
import LevelFilterBar from "./LevelFilterBar";
import { resumeRoundAt } from "@/lib/flashcards/resume-round";
import MatchBoard, { type MatchResult } from "./MatchBoard";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { buildMatchRound } from "@/lib/flashcards/match-round";
import { recordSrsAnswer } from "@/lib/flashcard-progress";
import type { RecentCategory } from "@/lib/flashcards/summary-client";
import { useCategorySummary } from "@/lib/flashcards/use-category-summary";
import { lockedView } from "@/lib/flashcards/locked-view";
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";
import { plural, type PluralForms } from "@/lib/plural";
import { learnedProgressText } from "@/lib/flashcards/learned-progress";

export interface MatchAppDict extends CategoryGridDict {
  levelAll: string;
  /** Подпись значка «нужен план Premium» — одна на весь сайт. */
  premiumTierBadge: string;
  subscriptionBadge: string;
  backToCategories: string;
  instructionLabel: string;
  notEnoughCardsMessage: string;
  roundCompleteLabel: PluralForms; // templates, contain literal "{pairs}"
  playAgainButton: string;
  nextRoundButton: string;
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
  /** Шаблон «Продолжить со слова «{word}»» — содержит литерал "{word}". */
  continueWithWord: string;
  /** The "you've learned N of M" line. Two forms — see
   * lib/flashcards/learned-progress.ts for which one prints when. */
  learnedProgressLabel: PluralForms; // templates, contain literal "{known}" and "{total}". Inflects with {total}.
  learnedProgressAvailableLabel: PluralForms; // adds literal "{locked}". Inflects with {total}.
  learnedProgressSubscriptionLabel: PluralForms; // закрыто бесплатной пробой — открывает любая подписка (7.206).
  learnedProgressBothLabel: PluralForms; // закрыто и пробой, и Premium; добавляет "{premium}".
}

const ROUND_SIZES = [4, 6, 8];
const MIN_PLAYABLE = 4;

export default function MatchApp({
  dict,
  resultDict,
}: {
  dict: MatchAppDict;
  resultDict: GameResultPanelDict;
}) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundKey, setRoundKey] = useState(0);
  const [complete, setComplete] = useState(false);
  const [roundErrors, setRoundErrors] = useState(0);
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  const roundStartedAtRef = useRef(0);
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
  // True only while a category's round is being fetched — without it, the
  // "not enough cards" message flashed for a moment on every category open
  // (round starts at [] before the fetch resolves, which is also < the
  // MIN_PLAYABLE floor below).
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
    // Закрытое подпиской — отдельным числом (7.206): её и Premium нельзя
    // называть одним словом, это разные покупки.
    lockedBySubscription: summary.subscriptionOnlyWords,
  };

  function startRound(size: number, sourceCards: FlashcardRow[], level: FlashcardLevel | "all", startCardId?: string | null) {
    const filtered = level === "all" ? sourceCards : sourceCards.filter((c) => c.level === level);
    // «Продолжить» кладёт то самое слово НА ДОСКУ (первой парой), а не
    // надеется, что оно попадёт туда случайно. Размер доски не меняется.
    setRound(resumeRoundAt(buildMatchRound(filtered, size), filtered, startCardId));
    setRoundKey((k) => k + 1);
    setComplete(false);
    roundStartedAtRef.current = Date.now();
  }

  function selectCategory(next: FlashcardCategory, startCardId?: string | null) {
    setCategory(next);
    setSizeIndex(0);
    setRoundLoading(true);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean; lockedTotal?: number; lockedByLevel?: Record<string, number> }) => {
        const cards = body.cards ?? [];
        setCategoryCards(cards);
        setLimited(Boolean(body.limited));
        setLockedTotal(body.lockedTotal ?? 0);
        setLockedByLevel(body.lockedByLevel ?? {});
        startRound(ROUND_SIZES[0], cards, levelFilter, startCardId);
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
    setLimited(false);
  }

  function handleComplete(results: MatchResult[]) {
    for (const r of results) recordSrsAnswer(r.cardId, r.firstTryCorrect);
    setRoundErrors(results.filter((r) => !r.firstTryCorrect).length);
    setRoundTimeSeconds(Math.round((Date.now() - roundStartedAtRef.current) / 1000));
    setComplete(true);
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

      {inGrid ? (
        <>
          <ContinueStrip
            dict={dict}
            recent={recentCategories}
            ready={summaryLevel !== undefined && (summaryLevel ?? "all") === levelFilter}
            onSelectCategory={selectCategory}
          />
          {/* ДОЛГ 249. Сколько слов человеку вообще открыто — на самом
              экране, а не только в окне итога раунда. Блок «Продолжить»
              выше не тронут: строка встаёт ПОД ним и НАД сеткой тем. */}
          <LearnedProgressLine
            dict={dict}
            locale={dict.locale}
            ready={summaryLevel !== undefined && (summaryLevel ?? "all") === levelFilter}
            known={totalProgress.known}
            available={totalProgress.total}
            locked={totalProgress.locked}
            lockedBySubscription={totalProgress.lockedBySubscription}
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
              {learnedProgressText(dict.locale, dict, {
                known: totalProgress.known,
                available: totalProgress.total,
                locked: totalProgress.locked,
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
