"use client";

import { useEffect, useState } from "react";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import CategoryGrid, { type CategoryGridDict, type CategorySummary } from "./CategoryGrid";
import FillBlankCard, { type FillBlankCardDict } from "./FillBlankCard";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
import { checkRecallAnswer, type RecallResult } from "@/lib/flashcards/recall-round";
import { buildFillBlankRound } from "@/lib/flashcards/fill-blank-round";
import { getSrsProgress, recordSrsAnswer, syncSrsProgress, type SrsEntry } from "@/lib/flashcard-progress";

export interface FillBlankAppDict extends CategoryGridDict, FillBlankCardDict {
  levelAll: string;
  backToCategories: string;
  noCategoryCardsMessage: string;
  roundCompleteLabel: string; // template, contains literal "{correct}" and "{total}"
  playAgainButton: string;
}

const levels: FlashcardLevel[] = ["A1", "A2", "B1"];
const ROUND_SIZE = 10;

export default function FillBlankApp({ dict }: { dict: FillBlankAppDict }) {
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [srsMap, setSrsMap] = useState<Record<string, SrsEntry>>({});
  const [round, setRound] = useState<FlashcardRow[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [result, setResult] = useState<RecallResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrsMap(getSrsProgress());
    syncSrsProgress().then(setSrsMap);
  }, []);

  useEffect(() => {
    const params = levelFilter === "all" ? "" : `?level=${levelFilter}`;
    fetch(`/api/flashcards/summary${params}`)
      .then((res) => (res.ok ? res.json() : { categories: {} }))
      .then((body: { categories?: Record<string, CategorySummary> }) => setCategorySummary(body.categories ?? {}))
      .catch(() => setCategorySummary({}));
  }, [round, levelFilter]);

  const card = round[roundIndex];

  function startRound(sourceCards: FlashcardRow[]) {
    const pool = levelFilter === "all" ? sourceCards : sourceCards.filter((c) => c.level === levelFilter);
    setRound(buildFillBlankRound(pool, srsMap, ROUND_SIZE));
    setRoundIndex(0);
    setResult(null);
    setScore({ correct: 0, total: 0 });
    setComplete(false);
  }

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    fetch(`/api/flashcards?category=${encodeURIComponent(next)}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((body: { cards?: FlashcardRow[] }) => startRound(body.cards ?? []))
      .catch(() => startRound([]));
  }

  function backToCategories() {
    setCategory(null);
    setRound([]);
    setComplete(false);
  }

  function handleSubmit(answer: string) {
    if (!card) return;
    const outcome = checkRecallAnswer(answer, card.russian);
    setResult(outcome);
    setScore((s) => ({ correct: s.correct + (outcome === "correct" ? 1 : 0), total: s.total + 1 }));
    const entry = recordSrsAnswer(card.id, outcome === "correct");
    setSrsMap((prev) => ({ ...prev, [card.id]: entry }));
  }

  function handleNext() {
    if (roundIndex + 1 >= round.length) {
      setComplete(true);
      return;
    }
    setRoundIndex((i) => i + 1);
    setResult(null);
  }

  const inGrid = !category;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap gap-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setLevelFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
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
            onClick={() => setLevelFilter(lvl)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
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
              <MatryoshkaAvatar id={score.correct === score.total ? "matryoshka_proud" : "matryoshka_happy"} size={64} />
              <p className="text-lg font-semibold">
                {dict.roundCompleteLabel.replace("{correct}", String(score.correct)).replace("{total}", String(score.total))}
              </p>
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
                  onClick={() => category && selectCategory(category)}
                  className="touch-manipulation select-none rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
                >
                  {dict.playAgainButton}
                </button>
              </div>
            </div>
          ) : !card ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
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
