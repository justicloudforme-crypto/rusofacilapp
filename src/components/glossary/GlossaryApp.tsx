"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { earliestRelatedLevel, glossaryCategories, isGlossaryCategory, type GlossaryCategory, type GlossaryExample } from "@/lib/glossary";
import { levelSlugs, type LevelSlug } from "@/lib/courses";
import RelatedLessonsList from "./RelatedLessonsList";
import GlossaryProgress from "./GlossaryProgress";
import SpeakButton from "@/components/lesson/SpeakButton";
import type { Locale } from "@/i18n/config";
import type { PluralForms } from "@/lib/plural";

export interface GlossaryDict {
  pageTitle: string;
  pageSubtitle: string;
  progressSeenLabel: PluralForms;
  progressMasteredLabel: PluralForms;
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
  introducedAtLabel: string;
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

export default function GlossaryApp({
  dict,
  lang,
  initialTerms,
}: {
  dict: GlossaryDict;
  lang: Locale;
  /** All terms, fetched once server-side (with audio already attached) by
   * the /glossary page — filtering below runs entirely in memory over this
   * array instead of re-fetching /api/glossary on every keystroke/filter
   * change. This is what makes the full term list (and its /glossary/[slug]
   * links) present in the server-rendered HTML on first load: there's no
   * client-only fetch gating it, so a crawler (or curl) sees the same
   * complete list a browser does. The /api/glossary routes themselves are
   * untouched — GlossaryAdminApp, LessonGlossaryTerms, GlossaryTermTooltip,
   * and useLevelGlossaryProgress still call them directly. */
  initialTerms: GlossaryTermData[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryCategory | "all">("all");
  const [level, setLevel] = useState<LevelSlug | "all">("all");
  // Set from a `?slug=` deep link (e.g. TermQuiz's "review in glossary"
  // link after a wrong answer, or the "back to category" link on a
  // /glossary/[slug] page) — an exact slug lookup, so a term whose name
  // happens to be a substring of another term's name (or vice versa) can't
  // resolve to the wrong card the way a `?q=` text search could.
  const [slugFocus, setSlugFocus] = useState<string | null>(null);

  // Picks up `?slug=`, `?q=`, or `?category=` from the URL without pulling
  // in useSearchParams/Suspense — this only needs to run once, client-side,
  // after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const initialQuery = params.get("q");
    const initialCategory = params.get("category");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (slug) setSlugFocus(slug);
    else if (initialQuery) setQuery(initialQuery);
    if (initialCategory && isGlossaryCategory(initialCategory)) setCategory(initialCategory);
  }, []);

  // Same filter semantics as the /api/glossary route this replaces
  // (case-sensitive substring match — a SQLite `contains` limitation there,
  // just naturally preserved here by not lowercasing either side; "level"
  // still means "relatedLessons has an entry for this level").
  const terms = useMemo(() => {
    if (slugFocus) {
      const match = initialTerms.find((t) => t.slug === slugFocus);
      return match ? [match] : [];
    }
    const q = query.trim();
    return initialTerms.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (level !== "all" && !t.relatedLessons.some((l) => l.startsWith(`${level}-`))) return false;
      if (q && !t.term.includes(q) && !t.russianEquivalent.includes(q) && !t.definition.includes(q)) return false;
      return true;
    });
  }, [initialTerms, slugFocus, category, level, query]);

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
      <GlossaryProgress
        locale={lang}
        seenLabel={dict.progressSeenLabel}
        masteredLabel={dict.progressMasteredLabel}
      />
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
              ? "border-primary bg-primary text-white dark:border-primary-400 dark:bg-primary-400"
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
                ? "border-primary bg-primary text-white dark:border-primary-400 dark:bg-primary-400"
                : "border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {terms.length === 0 && (
          <p className="text-sm text-foreground/60">{dict.noResultsMessage}</p>
        )}
        {terms.map((term) => {
          const earliestLevel = earliestRelatedLevel(term.relatedLessons);
          return (
          <div key={term.id} className="rounded-xl border border-black/10 p-4 dark:border-white/30">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  <Link
                    href={`/${lang}/glossary/${term.slug}`}
                    className="tap underline-offset-4 hover:underline active:underline"
                  >
                    {term.term}
                  </Link>
                </h2>
                {earliestLevel && (
                  <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground/50 dark:border-white/15">
                    {dict.introducedAtLabel} {earliestLevel}
                  </span>
                )}
              </span>
              {/* flex-wrap for the same reason as the footer's link row:
                  a non-wrapping flex row of content whose width nothing
                  bounds. The label, a long Russian term
                  ("разнонаправленный глагол движения"), its transcription
                  and the speak button add up to 362px, which overhangs a
                  320px phone and scrolls the whole document sideways.
                  Measured by scripts/check-layout-geometry.mjs. */}
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-foreground/50">
                {dict.russianEquivalentLabel}: <span className="font-medium text-foreground/80">{term.russianEquivalent}</span>
                {term.transcription ? <span className="text-foreground/50"> [{term.transcription}]</span> : null}
                <SpeakButton text={term.russianEquivalent} label={dict.listenLabel} audioUrl={term.audioUrl} />
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground/80">{term.definition}</p>
            {term.russianComparison && (
              <p className="mt-3 rounded-lg bg-primary/[0.05] px-3 py-2 text-sm leading-6 text-foreground/80 dark:bg-primary-400/[0.08]">
                <span className="font-medium text-primary-text dark:text-primary-400">{dict.russianComparisonLabel}: </span>
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
