"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SpeakButton from "@/components/lesson/SpeakButton";
import type { Idiom, IdiomCategory } from "@/lib/idioms";
import { getKnownWords, setWordKnown, syncKnownWords } from "@/lib/flashcard-progress";

export interface IdiomsDict {
  listenLabel: string;
  literalTranslationLabel: string;
  spanishEquivalentLabel: string;
  explanationLabel: string;
  contextExampleLabel: string;
  knownButton: string;
  knownBadge: string;
  progressLabel: string; // template, contains literal "{known}" and "{total}"
  searchPlaceholder: string;
  categoryAllLabel: string;
  categoryDailyLabel: string;
  categoryProverbsLabel: string;
  categoryLiteraryLabel: string;
  noResultsMessage: string;
  paginationPrev: string;
  paginationNext: string;
  paginationInfo: string; // template, contains literal "{current}" and "{total}"
}

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

export default function IdiomsList({ dict }: { dict: IdiomsDict }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Empty until after mount (localStorage isn't available during SSR) —
  // same hydration-safe pattern used by FlashcardsApp.
  const [knownIdioms, setKnownIdioms] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<IdiomCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLDivElement>(null);
  // Fetched once from the DB instead of importing the ~7,400-line static
  // bank straight into this client component's JS bundle.
  const [idioms, setIdioms] = useState<Idiom[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKnownIdioms(getKnownWords());
    syncKnownWords().then(setKnownIdioms);
  }, []);

  useEffect(() => {
    fetch("/api/idioms")
      .then((res) => (res.ok ? res.json() : { idioms: [] }))
      .then((body: { idioms?: Idiom[] }) => setIdioms(body.idioms ?? []))
      .catch(() => setIdioms([]));
  }, []);

  const known = idioms.filter((idiom) => knownIdioms[idiom.id]).length;
  const percent = idioms.length === 0 ? 0 : Math.round((known / idioms.length) * 100);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return idioms.filter((idiom) => {
      if (categoryFilter !== "all" && idiom.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        idiom.phrase.toLowerCase().includes(query) ||
        idiom.literalTranslation.toLowerCase().includes(query) ||
        idiom.spanishEquivalent.toLowerCase().includes(query) ||
        idiom.explanation.toLowerCase().includes(query)
      );
    });
  }, [idioms, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    setPage(clamped);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectCategory(next: IdiomCategory | "all") {
    setCategoryFilter(next);
    setPage(1);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleKnown(id: string) {
    setKnownIdioms(setWordKnown(id, !knownIdioms[id]));
  }

  const categoryTabs: { value: IdiomCategory | "all"; label: string }[] = [
    { value: "all", label: dict.categoryAllLabel },
    { value: "daily", label: dict.categoryDailyLabel },
    { value: "proverbs", label: dict.categoryProverbsLabel },
    { value: "literary", label: dict.categoryLiteraryLabel },
  ];

  return (
    <div>
      <div ref={listTopRef} className="mb-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <span className="mt-1 block text-xs text-foreground/60">
          {dict.progressLabel.replace("{known}", String(known)).replace("{total}", String(idioms.length))}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/10">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => selectCategory(tab.value)}
            className={`tap flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              categoryFilter === tab.value ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground active:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => updateSearch(e.target.value)}
        placeholder={dict.searchPlaceholder}
        className="mb-6 w-full rounded-full border border-black/10 bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 dark:border-white/15"
      />

      {pageItems.length === 0 ? (
        <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/10">
          {dict.noResultsMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {pageItems.map((idiom) => {
            const isOpen = openId === idiom.id;
            const isKnown = Boolean(knownIdioms[idiom.id]);
            return (
              <div key={idiom.id} className="rounded-2xl border border-black/10 p-4 dark:border-white/10 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : idiom.id)}
                      aria-expanded={isOpen}
                      className="tap flex-1 text-left text-lg font-medium hover:text-foreground/80 active:text-foreground/80"
                    >
                      «{idiom.phrase}»
                    </button>
                    <SpeakButton text={idiom.phrase} label={dict.listenLabel} audioUrl={idiom.audioUrl} />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleKnown(idiom.id)}
                    className={`tap self-start rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:flex-shrink-0 ${
                      isKnown
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
                    }`}
                  >
                    {isKnown ? `✓ ${dict.knownBadge}` : dict.knownButton}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-black/10 pt-4 text-sm dark:border-white/10">
                    <p>
                      <span className="font-medium text-foreground/60">{dict.literalTranslationLabel}: </span>
                      {idiom.literalTranslation}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">{dict.spanishEquivalentLabel}: </span>
                      {idiom.spanishEquivalent}
                    </p>
                    <p>
                      <span className="font-medium text-foreground/60">{dict.explanationLabel}: </span>
                      {idiom.explanation}
                    </p>
                    <div className="rounded-xl bg-foreground/5 p-3">
                      <span className="mb-1 block font-medium text-foreground/60">{dict.contextExampleLabel}:</span>
                      <p className="flex items-start gap-1.5 text-foreground/80">
                        <SpeakButton text={idiom.contextExampleRu} label={dict.listenLabel} audioUrl={idiom.contextExampleAudioUrl} />
                        <span>{idiom.contextExampleRu}</span>
                      </p>
                      <p className="mt-1 text-foreground/50">{idiom.contextExampleEs}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="tap rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground active:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15"
            >
              {dict?.paginationPrev ?? "Back"}
            </button>
            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-foreground/40">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  aria-current={p === safePage ? "page" : undefined}
                  className={`tap h-9 w-9 rounded-full text-sm font-medium transition-colors ${
                    p === safePage
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground active:bg-foreground/10 active:text-foreground"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="tap rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground active:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15"
            >
              {dict?.paginationNext ?? "Next"}
            </button>
          </div>
          <span className="text-xs text-foreground/50">
            {(dict?.paginationInfo ?? "Página {current} de {total}")
              .replace("{current}", String(safePage))
              .replace("{total}", String(totalPages))}
          </span>
        </div>
      )}
    </div>
  );
}
