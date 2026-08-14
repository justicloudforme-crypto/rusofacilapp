"use client";

import { useEffect, useMemo, useState } from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import {
  flashcardCategories,
  type FlashcardCategory,
  type FlashcardLevel,
  type FlashcardRow,
} from "@/lib/flashcards";
import { getKnownWords, setWordKnown, syncKnownWords } from "@/lib/flashcard-progress";

export interface FlashcardsDict {
  categoryLabels: Record<FlashcardCategory, string>;
  levelAll: string;
  tapToFlip: string;
  listenLabel: string;
  knowButton: string;
  repeatButton: string;
  cardCounter: string; // template, contains literal "{current}" and "{total}"
  progressLabel: string; // template, contains literal "{known}" and "{total}"
  categoryDoneMessage: string;
  synonymsLabel: string;
  antonymsLabel: string;
}

const levels: FlashcardLevel[] = ["A1", "A2", "B1"];

export default function FlashcardsApp({ dict }: { dict: FlashcardsDict }) {
  const [category, setCategory] = useState<FlashcardCategory>(flashcardCategories[0]);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Empty until after mount (localStorage isn't available during SSR) —
  // same hydration-safe pattern used by StoriesCatalog's progress read.
  const [knownWords, setKnownWords] = useState<Record<string, boolean>>({});
  // Only the current category's cards are fetched — previously the whole
  // ~2,600-card bank was bundled straight into this client component's JS.
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKnownWords(getKnownWords());
    syncKnownWords().then(setKnownWords);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flashcards?category=${encodeURIComponent(category)}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((body: { cards?: FlashcardRow[] }) => {
        if (!cancelled) setCategoryCards(body.cards ?? []);
      })
      .catch(() => {
        if (!cancelled) setCategoryCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const cards = useMemo(
    () => (levelFilter === "all" ? categoryCards : categoryCards.filter((c) => c.level === levelFilter)),
    [categoryCards, levelFilter]
  );

  const progress = useMemo(() => {
    const total = categoryCards.length;
    const known = categoryCards.filter((c) => knownWords[c.id]).length;
    return { known, total, percent: total === 0 ? 0 : Math.round((known / total) * 100) };
  }, [categoryCards, knownWords]);

  const card: FlashcardRow | undefined = cards[index];

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setIndex(0);
    setFlipped(false);
  }

  function selectLevel(next: FlashcardLevel | "all") {
    setLevelFilter(next);
    setIndex(0);
    setFlipped(false);
  }

  function advance() {
    setFlipped(false);
    setIndex((prev) => (cards.length === 0 ? 0 : (prev + 1) % cards.length));
  }

  function markKnown(known: boolean) {
    if (!card) return;
    setKnownWords(setWordKnown(card.id, known));
    advance();
  }

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/10">
        {flashcardCategories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => selectCategory(c)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              category === c ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {dict.categoryLabels[c]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectLevel("all")}
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
              onClick={() => selectLevel(lvl)}
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

        <div className="ml-auto min-w-[10rem] flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="mt-1 block text-xs text-foreground/60">
            {dict.progressLabel.replace("{known}", String(progress.known)).replace("{total}", String(progress.total))}
          </span>
        </div>
      </div>

      <div className="mt-8">
        {!card ? (
          <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
            {dict.categoryDoneMessage}
          </p>
        ) : (
          <>
            <p className="mb-3 text-center text-xs font-medium text-foreground/50">
              {dict.cardCounter.replace("{current}", String(index + 1)).replace("{total}", String(cards.length))}
            </p>

            <div className="[perspective:1200px]">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                aria-label={dict.tapToFlip}
                className="relative block h-64 w-full [transform-style:preserve-3d] transition-transform duration-500"
                style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-background p-6 [backface-visibility:hidden] dark:border-white/10">
                  <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/60">
                    {card.level}
                  </span>
                  <span className="text-5xl">{card.emoji}</span>
                  <span className="text-2xl font-semibold">{card.russian}</span>
                  <span className="text-sm text-foreground/50">{card.transcription}</span>
                </div>

                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-2xl border border-black/10 bg-background p-6 text-center [backface-visibility:hidden] dark:border-white/10"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <span className="text-2xl font-semibold">{card.translationEs}</span>
                  <p className="text-sm leading-6 text-foreground/70">{card.exampleRu}</p>
                  <p className="text-sm leading-6 text-foreground/50">{card.exampleEs}</p>
                  {(card.synonyms?.length || card.antonyms?.length) ? (
                    <div className="mt-1 flex w-full flex-col gap-1 text-xs">
                      {card.synonyms && card.synonyms.length > 0 && (
                        <p className="text-foreground/60">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{dict.synonymsLabel}: </span>
                          {card.synonyms.map((s) => `${s.word} (${s.translation})`).join(", ")}
                        </p>
                      )}
                      {card.antonyms && card.antonyms.length > 0 && (
                        <p className="text-foreground/60">
                          <span className="font-medium text-rose-600 dark:text-rose-400">{dict.antonymsLabel}: </span>
                          {card.antonyms.map((a) => `${a.word} (${a.translation})`).join(", ")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <SpeakButton text={card.russian} label={dict.listenLabel} size="md" />
              <button
                type="button"
                onClick={() => markKnown(false)}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground dark:border-white/15"
              >
                {dict.repeatButton}
              </button>
              <button
                type="button"
                onClick={() => markKnown(true)}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
              >
                {dict.knowButton}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
