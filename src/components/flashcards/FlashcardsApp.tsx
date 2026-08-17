"use client";

import { useEffect, useMemo, useState } from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import CategoryGrid, { type CategorySummary } from "./CategoryGrid";
import type { FlashcardCategory, FlashcardLevel, FlashcardRow } from "@/lib/flashcards";
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
  noSearchResultsMessage: string;
  synonymsLabel: string;
  antonymsLabel: string;
  searchPlaceholder: string;
  cardCountLabel: string; // template, contains literal "{count}"
  backToCategories: string;
}

const levels: FlashcardLevel[] = ["A1", "A2", "B1"];
// Debounce delay for the always-visible search box — short enough to feel
// responsive, long enough that a 4-5 letter Russian word doesn't fire a
// request per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export default function FlashcardsApp({ dict }: { dict: FlashcardsDict }) {
  // null = showing the category grid, not studying a specific category yet.
  const [category, setCategory] = useState<FlashcardCategory | null>(null);
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Empty until after mount (localStorage isn't available during SSR) —
  // same hydration-safe pattern used by StoriesCatalog's progress read.
  const [knownWords, setKnownWords] = useState<Record<string, boolean>>({});
  // Only the current category's cards are fetched — previously the whole
  // ~2,600-card bank was bundled straight into this client component's JS.
  const [categoryCards, setCategoryCards] = useState<FlashcardRow[]>([]);
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKnownWords(getKnownWords());
    syncKnownWords().then(setKnownWords);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = levelFilter === "all" ? "" : `?level=${levelFilter}`;
    fetch(`/api/flashcards/summary${params}`)
      .then((res) => (res.ok ? res.json() : { categories: {} }))
      .then((body: { categories?: Record<string, CategorySummary> }) => setCategorySummary(body.categories ?? {}))
      .catch(() => setCategorySummary({}));
  }, [knownWords, levelFilter]);

  useEffect(() => {
    if (searchQuery || !category) return; // search fetch below takes over, or nothing to fetch yet
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
  }, [category, searchQuery]);

  useEffect(() => {
    if (!searchQuery) return;
    let cancelled = false;
    const params = new URLSearchParams({ search: searchQuery });
    if (levelFilter !== "all") params.set("level", levelFilter);
    fetch(`/api/flashcards?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((body: { cards?: FlashcardRow[] }) => {
        if (!cancelled) {
          setCategoryCards(body.cards ?? []);
          setIndex(0);
          setFlipped(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery, levelFilter]);

  // While searching, the API already applied the level filter server-side
  // (it needs the full-bank cache to do Cyrillic-correct matching, see
  // /api/flashcards/route.ts) — filtering again here would be redundant but
  // harmless; while browsing a category, this is the only level filter.
  // Also guards against briefly showing the previous category's/search's
  // stale cards for one render after backing out to the grid — categoryCards
  // itself isn't cleared synchronously (see the fetch effects above), only
  // hidden here.
  const cards = useMemo(() => {
    if (!category && !searchQuery) return [];
    return levelFilter === "all" || searchQuery ? categoryCards : categoryCards.filter((c) => c.level === levelFilter);
  }, [categoryCards, category, levelFilter, searchQuery]);

  const progress = useMemo(() => {
    const total = categoryCards.length;
    const known = categoryCards.filter((c) => knownWords[c.id]).length;
    return { known, total, percent: total === 0 ? 0 : Math.round((known / total) * 100) };
  }, [categoryCards, knownWords]);

  const card: FlashcardRow | undefined = cards[index];
  const inGrid = !category && !searchQuery;

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setSearchInput("");
    setSearchQuery("");
    setIndex(0);
    setFlipped(false);
  }

  function backToCategories() {
    setCategory(null);
    setSearchInput("");
    setSearchQuery("");
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
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:mx-0 sm:px-0">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={dict.searchPlaceholder}
          className="mb-3 w-full rounded-full border border-black/10 bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 dark:border-white/15"
        />
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
      </div>

      {inGrid ? (
        <CategoryGrid dict={dict} summary={categorySummary} onSelectCategory={selectCategory} />
      ) : (
        <>
          {category && (
            <div className="mb-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={backToCategories}
                className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
              >
                {dict.backToCategories}
              </button>
              <div className="min-w-[10rem] flex-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
                </div>
                <span className="mt-1 block text-right text-xs text-foreground/60">
                  {dict.progressLabel
                    .replace("{known}", String(progress.known))
                    .replace("{total}", String(progress.total))}
                </span>
              </div>
            </div>
          )}
          {!category && searchQuery && (
            <button
              type="button"
              onClick={backToCategories}
              className="mb-4 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
            >
              {dict.backToCategories}
            </button>
          )}

          {!card ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
              {searchQuery ? dict.noSearchResultsMessage : dict.categoryDoneMessage}
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
                <SpeakButton text={card.russian} label={dict.listenLabel} size="md" audioUrl={card.audioUrl ?? undefined} />
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
        </>
      )}
    </div>
  );
}
