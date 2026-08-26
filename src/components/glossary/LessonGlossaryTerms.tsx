"use client";

import { useEffect, useState } from "react";
import type { GlossaryTermData } from "./GlossaryApp";
import GlossaryTermPopover from "./GlossaryTermPopover";
import TermQuiz, { type TermQuizDict } from "./TermQuiz";
import { GLOSSARY_SEEN_CHANGE_EVENT, getMasteredTermSlugs } from "@/lib/glossary-client";

const CHIP_CLASSNAME =
  "cursor-help rounded-full border border-primary/25 bg-primary/[0.05] px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10 dark:border-primary-400/30 dark:bg-primary-400/[0.08] dark:hover:border-primary-400";

/**
 * "Terms in this lesson" preview, shown before the tabs so a student can
 * skim the grammar vocabulary this lesson introduces before diving in —
 * part of the fully-self-guided-learning bar (no teacher to ask "what
 * words should I know for this lesson?"). Reuses GlossaryTermPopover
 * directly (chip-styled via its `className` prop) so tapping a chip opens
 * the exact same explanation card as an auto-linked term inside the
 * lesson text — one interaction pattern, not two to learn.
 */
export default function LessonGlossaryTerms({
  level,
  lessonSlug,
  heading,
  masteredLabel,
  quizDict,
  lang,
}: {
  level: string;
  lessonSlug: string;
  heading: string;
  /** Template with {count}/{total} placeholders, e.g. "{count}/{total} dominados". */
  masteredLabel: string;
  quizDict: TermQuizDict;
  lang: string;
}) {
  const [terms, setTerms] = useState<GlossaryTermData[] | null>(null);
  const [masteredCount, setMasteredCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/glossary?lesson=${level}-${lessonSlug}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((body: { terms?: GlossaryTermData[] }) => setTerms(body.terms ?? []))
      .catch(() => {
        if (!controller.signal.aborted) setTerms([]);
      });
    return () => controller.abort();
  }, [level, lessonSlug]);

  useEffect(() => {
    if (!terms) return;
    function refresh() {
      const mastered = new Set(getMasteredTermSlugs());
      setMasteredCount(terms!.filter((term) => mastered.has(term.slug)).length);
    }
    refresh();
    window.addEventListener(GLOSSARY_SEEN_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(GLOSSARY_SEEN_CHANGE_EVENT, refresh);
  }, [terms]);

  if (!terms || terms.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{heading}</span>
        <span className="text-xs font-medium text-foreground/50">
          {masteredLabel.replace("{count}", String(masteredCount)).replace("{total}", String(terms.length))}
        </span>
      </div>
      {/* Fixed max-height + scroll rather than truncating: lessons that
       * introduce many terms (e.g. a heavy grammar lesson) would otherwise
       * push the tab bar far down the page. Nothing about a term is
       * shortened — the full card still opens on tap, this only caps how
       * much vertical space the *chip list* itself takes before scrolling. */}
      <div className="mt-2.5 max-h-28 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <GlossaryTermPopover key={term.id} term={term} className={CHIP_CLASSNAME}>
              {term.term}
            </GlossaryTermPopover>
          ))}
        </div>
      </div>
      <TermQuiz terms={terms} dict={quizDict} lang={lang} />
    </div>
  );
}
