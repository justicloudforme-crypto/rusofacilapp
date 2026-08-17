"use client";

import { useEffect, useMemo, useState } from "react";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import CategoryGrid, { type CategoryGridDict, type CategorySummary } from "./CategoryGrid";
import MatchBoard, { type MatchResult } from "./MatchBoard";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { buildMatchRound, countPlayableCards } from "@/lib/flashcards/match-round";
import { recordSrsAnswer } from "@/lib/flashcard-progress";

export interface MatchAppDict extends CategoryGridDict {
  levelAll: string;
  backToCategories: string;
  instructionLabel: string;
  notEnoughCardsMessage: string;
  roundCompleteLabel: string; // template, contains literal "{pairs}"
  nextRoundButton: string;
}

const levels: FlashcardLevel[] = ["A1", "A2", "B1"];
const ROUND_SIZES = [4, 6, 8];
const MIN_PLAYABLE = 4;

export default function MatchApp({ dict }: { dict: MatchAppDict }) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);
  const [sizeIndex, setSizeIndex] = useState(0);
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundKey, setRoundKey] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = levelFilter === "all" ? "" : `?level=${levelFilter}`;
    fetch(`/api/flashcards/summary${params}`)
      .then((res) => (res.ok ? res.json() : { categories: {} }))
      .then((body: { categories?: Record<string, CategorySummary> }) => setCategorySummary(body.categories ?? {}))
      .catch(() => setCategorySummary({}));
  }, [levelFilter, round]);

  // How many playable pairs the CURRENT category has at each level — lets
  // the level buttons disable themselves before the player switches into a
  // level with too few cards, rather than switching and finding a stale or
  // empty board (see the two bugs this component used to have: switching
  // level while already inside a category didn't rebuild the round at all,
  // and there was no way to tell in advance that a level had nothing to play).
  const playableCounts = useMemo(() => {
    const counts: Record<FlashcardLevel | "all", number> = { all: countPlayableCards(categoryCards), A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
    for (const lvl of levels) counts[lvl] = countPlayableCards(categoryCards.filter((c) => c.level === lvl));
    return counts;
  }, [categoryCards]);

  // Takes the level explicitly instead of reading levelFilter from the
  // closure — selectLevel below calls this right after setLevelFilter,
  // whose new value isn't visible in this render's closure yet, so reading
  // the state directly here would rebuild the round against the OLD level.
  function startRound(size: number, sourceCards: FlashcardRow[], level: FlashcardLevel | "all") {
    const filtered = level === "all" ? sourceCards : sourceCards.filter((c) => c.level === level);
    setRound(buildMatchRound(filtered, size));
    setRoundKey((k) => k + 1);
    setComplete(false);
  }

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setSizeIndex(0);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((body: { cards?: FlashcardRow[] }) => {
        const cards = body.cards ?? [];
        setCategoryCards(cards);
        startRound(ROUND_SIZES[0], cards, levelFilter);
      })
      .catch(() => {
        setCategoryCards([]);
        startRound(ROUND_SIZES[0], [], levelFilter);
      });
  }

  // Switching the level filter while already inside a category must
  // immediately rebuild the round from the new level's cards — previously
  // this only updated levelFilter and left the old level's round on
  // screen untouched.
  function selectLevel(next: FlashcardLevel | "all") {
    setLevelFilter(next);
    if (category) {
      setSizeIndex(0);
      startRound(ROUND_SIZES[0], categoryCards, next);
    }
  }

  function backToCategories() {
    setCategory(null);
    setRound([]);
    setComplete(false);
  }

  function handleComplete(results: MatchResult[]) {
    for (const r of results) recordSrsAnswer(r.cardId, r.firstTryCorrect);
    setComplete(true);
  }

  function nextRound() {
    const nextIndex = Math.min(sizeIndex + 1, ROUND_SIZES.length - 1);
    setSizeIndex(nextIndex);
    startRound(ROUND_SIZES[nextIndex], categoryCards, levelFilter);
  }

  const inGrid = !category;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => selectLevel("all")}
          disabled={Boolean(category) && playableCounts.all < MIN_PLAYABLE}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            levelFilter === "all"
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
          }`}
        >
          {dict.levelAll}
        </button>
        {levels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => selectLevel(lvl)}
            disabled={Boolean(category) && playableCounts[lvl] < MIN_PLAYABLE}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              levelFilter === lvl
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/60 hover:text-foreground dark:border-white/15"
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {inGrid ? (
        <CategoryGrid dict={dict} summary={categorySummary} onSelectCategory={selectCategory} />
      ) : (
        <>
          <button
            type="button"
            onClick={backToCategories}
            className="mb-4 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
          >
            {dict.backToCategories}
          </button>

          {complete ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 p-10 text-center dark:border-white/10">
              <MatryoshkaAvatar id="matryoshka_laughing" size={64} />
              <p className="text-lg font-semibold">{dict.roundCompleteLabel.replace("{pairs}", String(round.length))}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={backToCategories}
                  className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground dark:border-white/15"
                >
                  {dict.backToCategories}
                </button>
                <button
                  type="button"
                  onClick={nextRound}
                  className="touch-manipulation select-none rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
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
