"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SpeakButton from "@/components/lesson/SpeakButton";
import Skeleton from "@/components/ui/Skeleton";
import CategoryGrid, { type CategorySummary } from "./CategoryGrid";
import ContinueStrip from "./ContinueStrip";
import FreeTrialLimitBanner from "./FreeTrialLimitBanner";
import LevelFilterBar from "./LevelFilterBar";
import { isFlashcardCategory, isFlashcardLevel, type FlashcardCategory, type FlashcardLevel, type FlashcardRow } from "@/lib/flashcards";
import { getKnownWords, setWordKnown, syncKnownWords } from "@/lib/flashcard-progress";
import { fetchCategorySummary, type RecentCategory } from "@/lib/flashcards/summary-client";
import { hapticTap, hapticSuccess } from "@/lib/haptics";

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
  nextLevelBadgeLabel: string; // template, contains literal "{level}"
  freeTrialLimitMessage: string;
  freeTrialLimitCta: string;
  continueTitle: string;
}

// Debounce delay for the always-visible search box — short enough to feel
// responsive, long enough that a 4-5 letter Russian word doesn't fire a
// request per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

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
  // True while a category/search fetch is in flight — without this, the
  // "no cards" message rendered for a split second on every category open
  // (categoryCards starts at [] before the fetch resolves), which read as
  // "this category is empty" for a few seconds before the real cards
  // appeared. Three real states now: loading -> skeleton, loaded+empty ->
  // message, loaded+non-empty -> cards.
  const [cardsLoading, setCardsLoading] = useState(false);
  const [categorySummary, setCategorySummary] = useState<Record<string, CategorySummary>>({});
  const [recentCategories, setRecentCategories] = useState<RecentCategory[]>([]);
  const [hasAnyProgress, setHasAnyProgress] = useState(false);
  const [limited, setLimited] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Swipe-to-answer (Tinder/Duolingo-style): a pure gesture layer over the
  // already-existing markKnown(true/false) below, not new logic. dragX
  // drives the live horizontal transform; isDragging turns off the CSS
  // transition while the finger is down (instant tracking) and back on for
  // the snap-back/fling-out settle. didDragRef distinguishes a real drag
  // from a tap so the existing tap-to-flip handler isn't also triggered by
  // a drag release.
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Mirrors the card's rendered width into state — render itself can't
  // read cardRef.current directly (React forbids ref access during
  // render), so the opacity indicators below read this instead of the ref.
  const [cardWidth, setCardWidth] = useState(320);
  // Last pointermove sample, for velocity — a fast short flick should
  // complete the swipe just as reliably as a slow drag past the distance
  // threshold (real desktop testing found the old fixed-100px rule felt
  // like it required dragging almost to the screen edge on a wide card).
  const lastMoveRef = useRef<{ x: number; t: number } | null>(null);
  const velocityRef = useRef(0);
  const TAP_THRESHOLD = 6;
  // Fraction of the card's own width, not a fixed pixel count — scales
  // correctly whether the card renders at 320px (small phone) or 480px
  // (desktop), unlike the old flat DRAG_THRESHOLD = 100.
  const COMPLETE_DISTANCE_FRACTION = 0.35;
  // px/ms — a quick flick well short of the distance threshold still
  // completes the swipe, matching how Tinder-style cards actually feel.
  const COMPLETE_VELOCITY = 0.5;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKnownWords(getKnownWords());
    syncKnownWords().then(setKnownWords);
  }, []);

  // Restores which category/level the learner was browsing from the URL —
  // closes the same gap VocabularyApp.tsx's own ?mode= restore does one
  // level up: a locale switch is a real navigation, so any state that
  // only ever lived in useState (never the URL) is lost, which read as
  // "dumped back to the category grid." Same hydration-safe "start with
  // the default, correct after mount" pattern as that sibling restore.
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category");
    const urlLevel = params.get("level");
    if (urlCategory && isFlashcardCategory(urlCategory)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategory(urlCategory);
    }
    if (urlLevel && isFlashcardLevel(urlLevel)) {
      setLevelFilter(urlLevel);
    }
  }, []);

  // replace, not push: browsing categories/levels isn't a new navigable
  // location, same reasoning VocabularyApp.tsx's own ?mode= sync uses.
  function syncUrl(next: { category?: FlashcardCategory | null; level?: FlashcardLevel | "all" }) {
    const params = new URLSearchParams(window.location.search);
    const nextCategory = next.category !== undefined ? next.category : category;
    const nextLevel = next.level !== undefined ? next.level : levelFilter;
    if (nextCategory) params.set("category", nextCategory);
    else params.delete("category");
    if (nextLevel && nextLevel !== "all") params.set("level", nextLevel);
    else params.delete("level");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchCategorySummary(levelFilter).then((body) => {
      setCategorySummary(body.categories);
      setRecentCategories(body.recent);
      setHasAnyProgress(body.hasAnyProgress);
    });
  }, [knownWords, levelFilter]);

  useEffect(() => {
    if (searchQuery || !category) return; // search fetch below takes over, or nothing to fetch yet
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardsLoading(true);
    fetch(`/api/flashcards?category=${encodeURIComponent(category)}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean }) => {
        if (!cancelled) {
          setCategoryCards(body.cards ?? []);
          setLimited(Boolean(body.limited));
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryCards([]);
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, searchQuery]);

  useEffect(() => {
    if (!searchQuery) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCardsLoading(true);
    const params = new URLSearchParams({ search: searchQuery });
    if (levelFilter !== "all") params.set("level", levelFilter);
    fetch(`/api/flashcards?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { cards: [], limited: false }))
      .then((body: { cards?: FlashcardRow[]; limited?: boolean }) => {
        if (!cancelled) {
          setCategoryCards(body.cards ?? []);
          setLimited(Boolean(body.limited));
          setIndex(0);
          setFlipped(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryCards([]);
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
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
  const completeDistance = cardWidth * COMPLETE_DISTANCE_FRACTION;

  useLayoutEffect(() => {
    if (cardRef.current) setCardWidth(cardRef.current.offsetWidth);
  }, [card?.id]);

  function selectCategory(next: FlashcardCategory) {
    setCategory(next);
    setSearchInput("");
    setSearchQuery("");
    setIndex(0);
    setFlipped(false);
    syncUrl({ category: next });
  }

  function backToCategories() {
    setCategory(null);
    setSearchInput("");
    setSearchQuery("");
    setIndex(0);
    setFlipped(false);
    setLimited(false);
    syncUrl({ category: null });
  }

  function selectLevel(next: FlashcardLevel | "all") {
    setLevelFilter(next);
    setIndex(0);
    setFlipped(false);
    syncUrl({ level: next });
  }

  function advance() {
    setFlipped(false);
    setDragX(0);
    setIsDragging(false);
    setIndex((prev) => (cards.length === 0 ? 0 : (prev + 1) % cards.length));
  }

  function markKnown(known: boolean) {
    if (!card) return;
    // "Sé esta palabra" gets the same success buzz as a correct answer
    // elsewhere in the app; "Repetir" is a neutral choice, not a mistake,
    // so a light tap rather than the error pattern.
    if (known) hapticSuccess();
    else hapticTap();
    setKnownWords(setWordKnown(card.id, known));
    advance();
  }

  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    // Without pointer capture, a fast or far mouse drag can carry the
    // cursor outside this element before release — the browser then
    // routes pointermove/pointerup to whatever's under the cursor instead
    // (or nothing at all), so handleDragEnd never fires and the card was
    // left stuck mid-drag ("hangs") until the pointer happened to wander
    // back over the card. Capturing the pointer here guarantees every
    // subsequent event for this gesture reaches this element regardless
    // of where the cursor physically is — the same fix WordSearchBoard's
    // drag-select already uses.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastMoveRef.current = { x: e.clientX, t: e.timeStamp };
    velocityRef.current = 0;
    didDragRef.current = false;
    setIsDragging(true);
  }

  function handleDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Once a real horizontal drag starts, a mostly-vertical move (page
    // scroll intent, not a swipe) cancels it rather than fighting the
    // browser's own scroll handling.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > TAP_THRESHOLD) {
      dragStartRef.current = null;
      setIsDragging(false);
      setDragX(0);
      return;
    }
    if (Math.abs(dx) > TAP_THRESHOLD) didDragRef.current = true;

    const last = lastMoveRef.current;
    if (last) {
      const dt = e.timeStamp - last.t;
      // Guard against a near-zero dt producing a wild instantaneous
      // velocity spike from a single noisy sample.
      if (dt > 4) velocityRef.current = (e.clientX - last.x) / dt;
    }
    lastMoveRef.current = { x: e.clientX, t: e.timeStamp };
    setDragX(dx);
  }

  function handleDragEnd() {
    dragStartRef.current = null;
    lastMoveRef.current = null;
    setIsDragging(false);

    const pastDistance = Math.abs(dragX) > completeDistance;
    const fastFlick = Math.abs(velocityRef.current) > COMPLETE_VELOCITY && Math.abs(dragX) > TAP_THRESHOLD;

    if (pastDistance || fastFlick) {
      // A fast flick can be in the opposite direction from a tiny residual
      // dragX sign flip — the flick's own direction is the more honest
      // signal for which way the card is "thrown" when it's the one that
      // crossed the threshold, so it takes priority over dragX's sign.
      const direction = fastFlick ? (velocityRef.current > 0 ? 1 : -1) : dragX > 0 ? 1 : -1;
      hapticTap();
      if (prefersReducedMotion()) {
        // No fling animation to wait out — go straight to the same
        // markKnown() the buttons use, card resets for the next one below.
        setDragX(0);
        markKnown(direction > 0);
        return;
      }
      // Fling fully off-screen first, so the swipe reads as a completed
      // gesture, then hand off to the same markKnown() the buttons use.
      setDragX(direction * (cardWidth + 100));
      window.setTimeout(() => markKnown(direction > 0), 200);
    } else {
      setDragX(0);
    }
  }

  function handleCardClick() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setFlipped((f) => !f);
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
        <LevelFilterBar dict={dict} value={levelFilter} onChange={selectLevel} />
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
          {category && (
            <div className="mb-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={backToCategories}
                className="tap text-sm font-medium text-foreground/60 transition-colors hover:text-foreground active:text-foreground"
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
              className="tap mb-4 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground active:text-foreground"
            >
              {dict.backToCategories}
            </button>
          )}

          {limited && (
            <FreeTrialLimitBanner message={dict.freeTrialLimitMessage} cta={dict.freeTrialLimitCta} />
          )}

          {cardsLoading ? (
            <div className="flex flex-col items-center gap-6">
              <Skeleton variant="text" className="h-3 w-24" />
              <Skeleton variant="rect" className="h-64 w-full" />
              <div className="flex gap-3">
                <Skeleton variant="rect" className="h-11 w-24 rounded-full" />
                <Skeleton variant="rect" className="h-11 w-24 rounded-full" />
              </div>
            </div>
          ) : !card ? (
            <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
              {searchQuery ? dict.noSearchResultsMessage : dict.categoryDoneMessage}
            </p>
          ) : (
            <>
              <p className="mb-3 text-center text-xs font-medium text-foreground/50">
                {dict.cardCounter.replace("{current}", String(index + 1)).replace("{total}", String(cards.length))}
              </p>

              <div key={card.id} className="relative [perspective:1200px]">
                {/* Swipe-progress indicators — decorative only
                    (pointer-events-none), so they never steal the drag
                    from the card underneath. Opacity ramps in with drag
                    distance so the gesture gives feedback before the
                    commit threshold (a fraction of the card's own width,
                    see COMPLETE_DISTANCE_FRACTION) is even reached. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ opacity: Math.max(0, Math.min(dragX / completeDistance, 1)), justifyContent: "flex-end" }}
                >
                  <span>✓ {dict.knowButton}</span>
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ opacity: Math.max(0, Math.min(-dragX / completeDistance, 1)) }}
                >
                  <span>↺ {dict.repeatButton}</span>
                </div>

                {/* A <div role="button">, not a real <button> — the example
                    sentence's SpeakButton (below) is itself a <button>, and
                    nesting <button> inside <button> is invalid HTML (React
                    warns "cannot be a descendant of"). Keyboard/AT support
                    is preserved via tabIndex + onKeyDown. Also doubles as
                    the swipe surface: pointer handlers track a horizontal
                    drag, and handleCardClick (rather than a plain toggle)
                    tells a completed drag apart from a tap so releasing a
                    swipe doesn't also flip the card. */}
                <div
                  ref={cardRef}
                  role="button"
                  tabIndex={0}
                  onClick={handleCardClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setFlipped((f) => !f);
                    }
                  }}
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  onPointerCancel={handleDragEnd}
                  aria-label={dict.tapToFlip}
                  className="relative block h-64 w-full cursor-pointer touch-manipulation select-none [transform-style:preserve-3d]"
                  style={{
                    transform: `translateX(${dragX}px) rotate(${dragX / 15}deg) ${flipped ? "rotateY(180deg)" : ""}`,
                    transition: isDragging || prefersReducedMotion() ? "none" : "transform 350ms ease-out",
                    touchAction: "pan-y",
                  }}
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
                    <p className="flex items-start justify-center gap-1.5 text-sm leading-6 text-foreground/70">
                      {/* stopPropagation so pressing play doesn't also
                          trigger the card-flip div's onClick above it */}
                      <span onClick={(event) => event.stopPropagation()}>
                        <SpeakButton text={card.exampleRu} label={dict.listenLabel} audioUrl={card.exampleAudioUrl ?? undefined} />
                      </span>
                      <span>{card.exampleRu}</span>
                    </p>
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
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <SpeakButton text={card.russian} label={dict.listenLabel} size="lg" audioUrl={card.audioUrl ?? undefined} />
                <button
                  type="button"
                  onClick={() => markKnown(false)}
                  className="tap rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:border-foreground/40 active:text-foreground dark:border-white/15"
                >
                  {dict.repeatButton}
                </button>
                <button
                  type="button"
                  onClick={() => markKnown(true)}
                  className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
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
