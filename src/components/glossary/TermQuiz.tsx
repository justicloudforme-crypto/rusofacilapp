"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GlossaryTermData } from "./GlossaryApp";
import { loadGlossaryTerms, markTermMastered, markTermSeen } from "@/lib/glossary-client";
import SpeakButton from "@/components/lesson/SpeakButton";

export interface TermQuizDict {
  toggleLabel: string;
  loadingLabel: string;
  listenLabel: string;
  /** Plain instruction line, e.g. "¿Qué significa esto?" — the term itself
   * is shown separately, as a large heading (see the render below), so it
   * doesn't need a placeholder here. */
  questionPrompt: string;
  /** Template with {index}/{total} placeholders, e.g. "Pregunta {index} de {total}". */
  questionCounter: string;
  correctLabel: string;
  incorrectLabel: string;
  /** Template with a {term} placeholder, e.g. "Pista sobre «{term}»". */
  hintLabel: string;
  reviewInGlossaryLabel: string;
  nextLabel: string;
  scoreLabel: string;
  retryLabel: string;
  closeLabel: string;
}

interface QuizQuestion {
  term: GlossaryTermData;
  options: string[];
  correctIndex: number;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuestions(lessonTerms: GlossaryTermData[], allTerms: GlossaryTermData[]): QuizQuestion[] {
  return shuffled(lessonTerms)
    .slice(0, 3)
    .map((term) => {
      const distractors = shuffled(allTerms.filter((t) => t.id !== term.id))
        .slice(0, 2)
        .map((t) => t.definition);
      const options = shuffled([term.definition, ...distractors]);
      return { term, options, correctIndex: options.indexOf(term.definition) };
    });
}

/**
 * Optional "¿Ya los conoces?" mini quiz shown alongside a lesson's term
 * chip list — turns skimming the term list into active recall before the
 * student even starts the lesson. Distractor definitions are drawn from the
 * rest of the glossary (already cached by loadGlossaryTerms for
 * auto-linking, so this adds no extra network cost).
 */
export default function TermQuiz({
  terms,
  dict,
  lang,
}: {
  terms: GlossaryTermData[];
  dict: TermQuizDict;
  lang: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [allTerms, setAllTerms] = useState<GlossaryTermData[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (expanded && !allTerms) loadGlossaryTerms().then(setAllTerms);
  }, [expanded, allTerms]);

  const questions = useMemo(
    () => (allTerms ? buildQuestions(terms, allTerms) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTerms, terms, attempt],
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="tap mt-3 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary-text transition-colors hover:bg-primary/[0.06] active:bg-primary/[0.06] dark:border-primary-400/40 dark:text-primary-400"
      >
        {dict.toggleLabel}
      </button>
    );
  }

  if (!allTerms || questions.length === 0) {
    return <p className="mt-3 text-xs text-foreground/50">{dict.loadingLabel}</p>;
  }

  const finished = index >= questions.length;

  if (finished) {
    return (
      <div className="mt-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
        <p className="font-medium text-foreground">
          {dict.scoreLabel.replace("{score}", String(correctCount)).replace("{total}", String(questions.length))}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setSelected(null);
              setCorrectCount(0);
              setAttempt((a) => a + 1);
            }}
            className="tap rounded-full border border-black/10 px-3 py-1 text-xs font-medium hover:border-foreground/40 active:border-foreground/40 dark:border-white/15"
          >
            {dict.retryLabel}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="tap rounded-full border border-black/10 px-3 py-1 text-xs font-medium hover:border-foreground/40 active:border-foreground/40 dark:border-white/15"
          >
            {dict.closeLabel}
          </button>
        </div>
      </div>
    );
  }

  const question = questions[index];

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correctIndex) {
      markTermMastered(question.term.slug);
      setCorrectCount((c) => c + 1);
    } else {
      markTermSeen(question.term.slug);
    }
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  const wasCorrect = selected === question.correctIndex;
  const hint = question.term.russianComparison ?? question.term.definition;

  return (
    <div className="mt-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
      {/* The term itself is the single biggest, boldest thing in this
       * block — deliberately more prominent than the instruction text
       * above it, so which word the question is about is unmistakable at
       * a glance rather than something read off inside a sentence. */}
      <div className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2.5 dark:border-primary-400/30 dark:bg-primary-400/[0.08]">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-foreground/45">
          {dict.questionCounter.replace("{index}", String(index + 1)).replace("{total}", String(questions.length))}
          {" · "}
          {dict.questionPrompt}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h3 className="text-xl font-bold leading-tight text-foreground">{question.term.term}</h3>
          <SpeakButton text={question.term.russianEquivalent} label={dict.listenLabel} audioUrl={question.term.audioUrl} />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {question.options.map((option, optionIndex) => {
          const isCorrectOption = optionIndex === question.correctIndex;
          const isSelected = selected === optionIndex;
          let stateClasses = "border-black/15 dark:border-white/20";
          if (selected !== null) {
            if (isCorrectOption) stateClasses = "border-emerald-500 bg-emerald-500/10";
            else if (isSelected) stateClasses = "border-red-500 bg-red-500/10";
          }
          return (
            <button
              key={option}
              type="button"
              disabled={selected !== null}
              onClick={() => choose(optionIndex)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${stateClasses} ${
                selected === null ? "tap hover:border-foreground/40 active:border-foreground/40" : "cursor-default"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium ${
                wasCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {wasCorrect ? dict.correctLabel : dict.incorrectLabel}
            </span>
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
            >
              {dict.nextLabel}
            </button>
          </div>
          {!wasCorrect && (
            <div className="mt-2 rounded-lg bg-red-500/5 px-3 py-2">
              <p className="text-xs leading-5 text-foreground/70">
                <span className="font-medium text-foreground/50">
                  {dict.hintLabel.replace("{term}", question.term.term)}:{" "}
                </span>
                {hint}
              </p>
              <Link
                href={`/${lang}/glossary?slug=${encodeURIComponent(question.term.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tap mt-1.5 inline-block text-xs font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                {dict.reviewInGlossaryLabel} ›
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
