"use client";

import { useEffect, useState } from "react";
import { earliestRelatedLevel, glossaryCategories, type GlossaryCategory, type GlossaryExample } from "@/lib/glossary";
import { levelSlugs, type LevelSlug } from "@/lib/courses";
import RelatedLessonsList from "./RelatedLessonsList";
import GlossaryProgress from "./GlossaryProgress";
import SpeakButton from "@/components/lesson/SpeakButton";

export interface GlossaryDict {
  pageTitle: string;
  pageSubtitle: string;
  progressSeenLabel: string;
  progressMasteredLabel: string;
  searchPlaceholder: string;
  categoryAllLabel: string;
  categoryLabels: Record<GlossaryCategory, string>;
  levelAllLabel: string;
  russianEquivalentLabel: string;
  russianComparisonLabel: string;
  exampleLabel: string;
  relatedLessonsLabel: string;
  listenLabel: string;
  noResultsMessage: string;
}

export interface GlossaryTermData {
  id: string;
  slug: string;
  term: string;
  definition: string;
  russianEquivalent: string;
  transcription: string | null;
  category: GlossaryCategory;
  russianComparison: string | null;
  examples: GlossaryExample[];
  relatedLessons: string[];
  /** Pre-generated narration for russianEquivalent (see prisma/generate-
   * glossary-audio.ts), attached server-side by /api/glossary. Undefined
   * until that generation pass runs. */
  audioUrl?: string;
}

export default function GlossaryApp({ dict, lang }: { dict: GlossaryDict; lang: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryCategory | "all">("all");
  const [level, setLevel] = useState<LevelSlug | "all">("all");
  const [terms, setTerms] = useState<GlossaryTermData[]>([]);
  const [loading, setLoading] = useState(true);
  // Set from a `?slug=` deep link (e.g. TermQuiz's "review in glossary"
  // link after a wrong answer) — an exact slug lookup, so a term whose name
  // happens to be a substring of another term's name (or vice versa) can't
  // resolve to the wrong card the way a `?q=` text search could.
  const [slugFocus, setSlugFocus] = useState<string | null>(null);

  // Picks up `?slug=` or `?q=` from the URL without pulling in
  // useSearchParams/Suspense — this only needs to run once, client-side,
  // after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const initialQuery = params.get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (slug) setSlugFocus(slug);
    else if (initialQuery) setQuery(initialQuery);
  }, []);

  useEffect(() => {
    if (!slugFocus) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/glossary/${encodeURIComponent(slugFocus)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { term: null }))
      .then((body: { term?: GlossaryTermData | null }) => {
        setTerms(body.term ? [body.term] : []);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slugFocus]);

  useEffect(() => {
    if (slugFocus) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "all") params.set("category", category);
    if (level !== "all") params.set("level", level);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/glossary?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((body: { terms?: GlossaryTermData[] }) => {
        setTerms(body.terms ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, category, level, slugFocus]);

  // Any manual interaction with search/filters exits the slug-focused deep
  // link and returns to normal browsing.
  function updateQuery(value: string) {
    setSlugFocus(null);
    setQuery(value);
  }
  function updateCategory(value: GlossaryCategory | "all") {
    setSlugFocus(null);
    setCategory(value);
  }
  function updateLevel(value: LevelSlug | "all") {
    setSlugFocus(null);
    setLevel(value);
  }

  return (
    <div>
      <GlossaryProgress seenLabel={dict.progressSeenLabel} masteredLabel={dict.progressMasteredLabel} />
      <input
        type="search"
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder={dict.searchPlaceholder}
        className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateCategory("all")}
          className={`tap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            category === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-black/10 text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {dict.categoryAllLabel}
        </button>
        {glossaryCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => updateCategory(c)}
            className={`tap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              category === c
                ? "border-foreground bg-foreground text-background"
                : "border-black/10 text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
            }`}
          >
            {dict.categoryLabels[c]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateLevel("all")}
          className={`tap rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
            level === "all"
              ? "border-brand bg-brand text-white dark:border-brand-light dark:bg-brand-light"
              : "border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {dict.levelAllLabel}
        </button>
        {levelSlugs.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => updateLevel(l)}
            className={`tap rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
              level === l
                ? "border-brand bg-brand text-white dark:border-brand-light dark:bg-brand-light"
                : "border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {!loading && terms.length === 0 && (
          <p className="text-sm text-foreground/60">{dict.noResultsMessage}</p>
        )}
        {terms.map((term) => {
          const earliestLevel = earliestRelatedLevel(term.relatedLessons);
          return (
          <div key={term.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{term.term}</h2>
                {earliestLevel && (
                  <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground/50 dark:border-white/15">
                    Introducido en {earliestLevel}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-foreground/50">
                {dict.russianEquivalentLabel}: <span className="font-medium text-foreground/80">{term.russianEquivalent}</span>
                {term.transcription ? <span className="text-foreground/50"> [{term.transcription}]</span> : null}
                <SpeakButton text={term.russianEquivalent} label={dict.listenLabel} audioUrl={term.audioUrl} />
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground/80">{term.definition}</p>
            {term.russianComparison && (
              <p className="mt-3 rounded-lg bg-brand/[0.05] px-3 py-2 text-sm leading-6 text-foreground/80 dark:bg-brand-light/[0.08]">
                <span className="font-medium text-brand dark:text-brand-light">{dict.russianComparisonLabel}: </span>
                {term.russianComparison}
              </p>
            )}
            {term.examples.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {term.examples.map((example) => (
                  <li key={example.ru} className="flex items-start gap-2 text-sm text-foreground/70">
                    <SpeakButton text={example.ru} label={dict.listenLabel} audioUrl={example.audioUrl} />
                    <span>
                      <span className="font-medium text-foreground/50">{dict.exampleLabel}: </span>
                      {example.ru}
                      <span className="text-foreground/50"> — {example.es}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <RelatedLessonsList
              lessons={term.relatedLessons}
              lang={lang}
              label={dict.relatedLessonsLabel}
              className="mt-3 block text-sm text-foreground/70"
            />
          </div>
          );
        })}
      </div>
    </div>
  );
}
