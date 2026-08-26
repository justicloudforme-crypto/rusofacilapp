"use client";

import { usePathname } from "next/navigation";
import type { GlossaryTermData } from "./GlossaryApp";
import RelatedLessonsList from "./RelatedLessonsList";
import SpeakButton from "@/components/lesson/SpeakButton";
import { earliestRelatedLevel } from "@/lib/glossary";

/** The actual card content (term header, simple definition, Russian
 * comparison, example) shared by GlossaryTermPopover (preloaded data, used
 * by GlossaryText's auto-linked terms) and GlossaryTermTooltip (lazy
 * slug-based fetch, for manual use), so the two visual treatments never
 * drift apart. */
export default function GlossaryTermCardBody({ term }: { term: GlossaryTermData }) {
  // Read from the URL instead of a prop so every call site (lesson pages,
  // the /glossary search page, anywhere else this gets used later) gets a
  // working "Aparece en" link for free, without threading `lang` through
  // GrammarTab → SlidesTab → GlossaryText → GlossaryTermPopover.
  const pathname = usePathname();
  const lang = pathname.split("/")[1] || "es";
  const earliestLevel = earliestRelatedLevel(term.relatedLessons);

  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
        {term.term}
        <span className="font-normal text-foreground/50">
          — {term.russianEquivalent}
          {term.transcription ? ` [${term.transcription}]` : ""}
        </span>
        <SpeakButton text={term.russianEquivalent} label="Escuchar en ruso" audioUrl={term.audioUrl} />
        {earliestLevel && (
          <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground/50 dark:border-white/15">
            Introducido en {earliestLevel}
          </span>
        )}
      </span>
      <span className="mt-1.5 block leading-5 text-foreground/80">{term.definition}</span>
      {term.russianComparison && (
        <span className="mt-2 block rounded-md bg-primary/[0.06] px-2.5 py-2 leading-5 text-foreground/80 dark:bg-primary-400/[0.08]">
          <span className="font-medium text-primary-text dark:text-primary-400">Cómo funciona en ruso: </span>
          {term.russianComparison}
        </span>
      )}
      {term.examples.length > 0 && (
        <span className="mt-2 flex flex-col gap-1.5">
          {term.examples.map((example) => (
            <span key={example.ru} className="flex items-start gap-1.5 leading-5 text-foreground/70">
              <SpeakButton text={example.ru} label="Escuchar en ruso" audioUrl={example.audioUrl} />
              <span>
                {example.ru}
                <span className="text-foreground/50"> — {example.es}</span>
              </span>
            </span>
          ))}
        </span>
      )}
      <RelatedLessonsList
        lessons={term.relatedLessons}
        lang={lang}
        label="Aparece en"
        className="mt-2 block leading-5 text-foreground/70"
      />
    </>
  );
}
