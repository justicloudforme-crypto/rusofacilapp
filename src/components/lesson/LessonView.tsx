"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LessonContent } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import GrammarTab from "./GrammarTab";
import VocabularyTab from "./VocabularyTab";
import ExercisesTab from "./ExercisesTab";
import AlphabetTable from "./AlphabetTable";
import VideoPlayer from "./VideoPlayer";
import SlidesTab from "./SlidesTab";
import LessonGlossaryTerms from "@/components/glossary/LessonGlossaryTerms";

type Tab = "grammar" | "vocabulary" | "alphabet" | "exercises" | "slides";

export default function LessonView({
  lang,
  level,
  lessonSlug,
  title,
  levelTitle,
  content,
  slideIllustrations,
  dict,
  celebrationDict,
  prevHref,
  nextHref,
}: {
  lang: string;
  level: string;
  lessonSlug: string;
  title: string;
  levelTitle: string;
  content: LessonContent | null;
  // Pre-rendered server-side (see [lesson]/page.tsx), keyed by slide id —
  // keeps src/lib/lessons/slideIcons.ts's shape data out of this "use
  // client" component's bundle.
  slideIllustrations: Record<string, ReactNode>;
  dict: Dictionary["lesson"];
  celebrationDict: Dictionary["celebration"];
  prevHref: string | null;
  nextHref: string | null;
}) {
  const hasAlphabet = Boolean(content?.alphabet && content.alphabet.length > 0);
  const hasSlides = Boolean(content?.slides && content.slides.length > 0);
  const [tab, setTab] = useState<Tab>(hasSlides ? "slides" : hasAlphabet ? "alphabet" : "grammar");
  const [passed, setPassed] = useState(content ? false : true);
  // Pre-generated pronunciation audio for this lesson's items (see
  // prisma/generate-lesson-audio.ts), keyed by the Russian text itself.
  // Empty until this resolves — SpeakButton just falls back to browser
  // synthesis for any item not (yet) in the map, so there's no loading
  // state to show here.
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/lesson-audio?level=${level}&lesson=${lessonSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { audio?: Record<string, string> } | null) => {
        if (body?.audio) setAudioMap(body.audio);
      })
      .catch(() => {
        // No cached audio available (offline, or none generated yet) —
        // SpeakButton's browser-synthesis fallback covers this silently.
      });
  }, [level, lessonSlug]);

  const tabs: { id: Tab; label: string }[] = [
    ...(hasSlides ? [{ id: "slides" as const, label: dict.tabs.slides }] : []),
    ...(hasAlphabet ? [{ id: "alphabet" as const, label: dict.tabs.alphabet }] : []),
    { id: "grammar", label: dict.tabs.grammar },
    { id: "vocabulary", label: dict.tabs.vocabulary },
    { id: "exercises", label: dict.tabs.exercises },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link
        href={`/${lang}/courses/${level}`}
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← {dict.backToLevel}
      </Link>

      <span className="mt-6 block text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {levelTitle} · {dict.lessonLabel} {lessonSlug}
      </span>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>

      {!content ? (
        <p className="mt-6 leading-7 text-foreground/70">{dict.placeholder}</p>
      ) : (
        <>
          <VideoPlayer videoUrl={content.videoUrl} title={title} />

          <div
            role="tablist"
            className="mt-6 flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/30"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`tap flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:text-foreground active:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {tab === "slides" && content.slides && (
              <SlidesTab
                slides={content.slides}
                illustrations={slideIllustrations}
                level={level}
                lessonSlug={lessonSlug}
                dict={dict.slides}
              />
            )}
            {tab === "alphabet" && content.alphabet && (
              <AlphabetTable alphabet={content.alphabet} dict={dict.alphabet} audioMap={audioMap} />
            )}
            {tab === "grammar" && (
              <GrammarTab
                grammar={content.grammar}
                readingPractice={content.readingPractice}
                spanishNote={dict.grammarSpanishNote}
                dict={dict}
                level={level}
                lessonSlug={lessonSlug}
                audioMap={audioMap}
              />
            )}
            {tab === "vocabulary" && (
              <>
                <LessonGlossaryTerms
                  level={level}
                  lessonSlug={lessonSlug}
                  heading={dict.glossaryTermsHeading}
                  masteredLabel={dict.glossaryTermsMasteredLabel}
                  quizDict={dict.termQuiz}
                  lang={lang}
                />
                <VocabularyTab
                  vocabulary={content.vocabulary}
                  dict={dict.vocabulary}
                  listenLabel={dict.alphabet.listenLabel}
                  audioMap={audioMap}
                />
              </>
            )}
            {tab === "exercises" && (
              <ExercisesTab
                exercises={content.exercises}
                vocabulary={content.vocabulary}
                dict={dict.exercises}
                pronunciationDict={dict.pronunciation}
                celebrationDict={celebrationDict}
                level={level}
                lessonSlug={lessonSlug}
                storageKey={`lesson-passed:${level}:${lessonSlug}`}
                onPassChange={setPassed}
                enableAudioRecording={content.enableAudioRecording}
                audioMap={audioMap}
              />
            )}
          </div>
        </>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-black/10 pt-6 text-sm dark:border-white/30">
        {prevHref ? (
          <Link href={prevHref} className="tap font-medium hover:text-foreground/70 active:text-foreground/70">
            ← {dict.previous}
          </Link>
        ) : (
          <span />
        )}
        {nextHref ? (
          passed ? (
            <Link href={nextHref} className="tap font-medium hover:text-foreground/70 active:text-foreground/70">
              {dict.next} →
            </Link>
          ) : (
            <span
              aria-disabled
              title={dict.exercises.completeToUnlock}
              className="cursor-not-allowed font-medium text-foreground/30"
            >
              {dict.next} →
            </span>
          )
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
