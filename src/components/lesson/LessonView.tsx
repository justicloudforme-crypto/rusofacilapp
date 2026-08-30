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
import TabBar from "@/components/ui/TabBar";

type Tab = "grammar" | "vocabulary" | "alphabet" | "exercises" | "slides";

/** Placeholder shown in a locked tab (Vocabulario/Ejercicios/Presentación)
 * for a non-entitled visitor, instead of the real tab content — states a
 * real count ("Este módulo incluye 24 palabras con audio") rather than a
 * vague "subscribe for more", per the explicit owner requirement that a
 * visitor should see how much they'd get, not just that something is
 * locked. `.paywall-lock` is a stable hook for the page's own JSON-LD
 * (isAccessibleForFree/hasPart.cssSelector — see src/lib/site.ts's
 * paywallJsonLd), shared with the same class on the story/media lock
 * cards, not just a styling class. */
function LockedModuleCard({
  label,
  count,
  cta,
  pricingHref,
}: {
  label: string;
  count: number;
  cta: string;
  pricingHref: string;
}) {
  return (
    <div className="paywall-lock rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 dark:border-primary-400/30 dark:bg-primary-400/[0.06]">
      <p className="text-sm leading-6 text-foreground/80">{label.replace("{count}", String(count))}</p>
      <Link
        href={pricingHref}
        className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {cta}
      </Link>
    </div>
  );
}

export default function LessonView({
  lang,
  level,
  lessonSlug,
  ownerScope,
  title,
  levelTitle,
  content,
  isLocked,
  lockedCounts,
  slideIllustrations,
  dict,
  celebrationDict,
  prevHref,
  nextHref,
}: {
  lang: string;
  level: string;
  lessonSlug: string;
  /** Which browser-storage bucket the practice recordings on this page
   * belong to. They never leave the device — see
   * src/lib/voice-recordings-store.ts. */
  ownerScope: string;
  title: string;
  levelTitle: string;
  // Already stripped of vocabulary/exercises/slides/video by the page when
  // `isLocked` — see [lesson]/page.tsx's own comment on why that's a real
  // data cut, not just a UI hide.
  content: LessonContent | null;
  // True for every lesson except each level's lesson 1 and any entitled
  // (subscribed, or staff) visitor — gates the Vocabulary/Exercises/
  // Presentación tabs behind a placeholder card instead of hiding the tabs
  // themselves, so a visitor can see what the lesson includes before
  // subscribing.
  isLocked: boolean;
  // Real counts from the FULL (unstripped) content, computed server-side
  // before stripping — lets the locked placeholder say "24 palabras" isntead
  // of a vague "content available with subscription". Null when the lesson
  // couldn't be loaded at all (content itself is also null in that case).
  lockedCounts: { vocabulary: number; exercises: number; slides: number } | null;
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
  // When locked, content.slides was stripped server-side — fall back to
  // the real count computed before stripping (lockedCounts) to decide
  // whether the tab exists at all; every lesson in the DB has slides
  // today, but this stays correct if that ever isn't true for a future
  // lesson.
  const hasSlides = isLocked ? (lockedCounts?.slides ?? 0) > 0 : Boolean(content?.slides && content.slides.length > 0);
  // Every lesson — locked or not — lands on "grammar". A locked one has
  // nothing else to show anyway (never default into a paywall card), and
  // an OPEN one used to default to "slides", which measured as a real SEO
  // regression: SlidesTab is a carousel rendering 1 of 8 slides, so the
  // 8 open lessons served ~936 chars of text to a crawler against ~4373
  // for a locked one — opening a lesson made it *less* indexable, the
  // opposite of what PR #36 was for (full numbers in PROGRESS.md's
  // "БАЗОВЫЕ ЦИФРЫ ИНДЕКСИРУЕМОСТИ" block). Owner's call: the grammar
  // explanation being findable beats the presentation's softer intro.
  const [tab, setTab] = useState<Tab>("grammar");
  const [passed, setPassed] = useState(content ? false : true);
  // ExercisesTab is the one panel NOT rendered up front (see the render
  // block below): its mount effect fires a GET /api/progress for every
  // visitor, which would be a wasted request on every lesson view — and
  // for a signed-out visitor or a crawler it can never return anything.
  // Mounted on the first click of the Ejercicios tab and kept mounted
  // afterwards, so a student's graded state still survives tab switching.
  const [exercisesEverOpened, setExercisesEverOpened] = useState(false);
  // Because ExercisesTab is now lazily mounted (above) and it is the only
  // thing that flips `passed`, a student who already completed this lesson
  // would have found the "next lesson" link disabled until they clicked
  // Ejercicios again. ExercisesTab decides the same thing from the same
  // localStorage key, so read it here too — cheap, no request, and it
  // restores the pre-lazy-mount behaviour. (A student on a NEW device
  // whose pass only exists server-side still has to open the Ejercicios
  // tab once; they would be opening it anyway to see their graded
  // attempt, which is restored by ExercisesTab's own GET /api/progress.)
  useEffect(() => {
    if (!content) return;
    try {
      // Reading localStorage is only possible after mount (it doesn't
      // exist during SSR), so this has to happen in an effect rather than
      // during render — same reasoning and same rule override as
      // ExercisesTab's own copy of this check.
      if (content.exercises.length === 0 || window.localStorage.getItem(`lesson-passed:${level}:${lessonSlug}`) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPassed(true);
      }
    } catch {
      // localStorage unavailable (private mode / disabled) — the gate just
      // stays closed until the student opens Ejercicios, same as before.
    }
  }, [content, level, lessonSlug]);
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

          <TabBar
            items={tabs}
            activeId={tab}
            onSelect={(id) => {
              if (id === "exercises") setExercisesEverOpened(true);
              setTab(id);
            }}
            className="mt-6"
          />

          <div className="mt-8">
            {/* When locked, all three lock cards render into the DOM
                unconditionally (toggled by a `hidden` class, not by
                skipping the render) instead of only the active tab's —
                they're static text, no real content weight, and this is
                what lets a crawler (which never clicks a tab) actually
                see all three counts and lets the page's own
                isAccessibleForFree/hasPart.cssSelector JSON-LD (see
                [lesson]/page.tsx) point at a selector that really exists
                in the served HTML, not just in whichever tab happened to
                be active. */}
            {isLocked && (
              <>
                <div className={tab === "slides" ? undefined : "hidden"}>
                  <LockedModuleCard
                    label={dict.locked.slidesLabel}
                    count={lockedCounts?.slides ?? 0}
                    cta={dict.locked.cta}
                    pricingHref={`/${lang}/pricing?next=/${lang}/courses/${level}/${lessonSlug}`}
                  />
                </div>
                <div className={tab === "vocabulary" ? undefined : "hidden"}>
                  <LessonGlossaryTerms
                    level={level}
                    lessonSlug={lessonSlug}
                    heading={dict.glossaryTermsHeading}
                    masteredLabel={dict.glossaryTermsMasteredLabel}
                    quizDict={dict.termQuiz}
                    lang={lang}
                  />
                  <LockedModuleCard
                    label={dict.locked.vocabularyLabel}
                    count={lockedCounts?.vocabulary ?? 0}
                    cta={dict.locked.cta}
                    pricingHref={`/${lang}/pricing?next=/${lang}/courses/${level}/${lessonSlug}`}
                  />
                </div>
                <div className={tab === "exercises" ? undefined : "hidden"}>
                  <LockedModuleCard
                    label={dict.locked.exercisesLabel}
                    count={lockedCounts?.exercises ?? 0}
                    cta={dict.locked.cta}
                    pricingHref={`/${lang}/pricing?next=/${lang}/courses/${level}/${lessonSlug}`}
                  />
                </div>
              </>
            )}
            {/* Open-lesson panels follow the same rule as the lock cards
                above: rendered into the DOM up front, shown/hidden with a
                `hidden` class rather than skipped entirely. A crawler
                never clicks a tab, so the old `tab === "x" && ...` form
                meant only ONE panel was ever in the served HTML — which
                is what made the 8 open lessons the 8 thinnest pages in
                the whole sitemap (see the tab-default comment above).
                Same visible behaviour for a human: one panel showing,
                the rest hidden. */}
            {!isLocked && content.slides && (
              <div className={tab === "slides" ? undefined : "hidden"}>
                <SlidesTab
                  slides={content.slides}
                  illustrations={slideIllustrations}
                  level={level}
                  lessonSlug={lessonSlug}
                  dict={dict.slides}
                />
              </div>
            )}
            {content.alphabet && (
              <div className={tab === "alphabet" ? undefined : "hidden"}>
                <AlphabetTable alphabet={content.alphabet} dict={dict.alphabet} audioMap={audioMap} />
              </div>
            )}
            <div className={tab === "grammar" ? undefined : "hidden"}>
              <GrammarTab
                grammar={content.grammar}
                readingPractice={content.readingPractice}
                spanishNote={dict.grammarSpanishNote}
                dict={dict}
                level={level}
                lessonSlug={lessonSlug}
                audioMap={audioMap}
                ownerScope={ownerScope}
              />
            </div>
            {!isLocked && (
              <div className={tab === "vocabulary" ? undefined : "hidden"}>
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
              </div>
            )}
            {/* The one panel deliberately NOT pre-rendered — see
                exercisesEverOpened's own comment. Exercises are graded
                interaction, not readable prose, so leaving them out of
                the crawler's view costs nothing for SEO while saving a
                GET /api/progress on every single lesson view. */}
            {!isLocked && exercisesEverOpened && (
              <div className={tab === "exercises" ? undefined : "hidden"}>
                <ExercisesTab
                  exercises={content.exercises}
                  vocabulary={content.vocabulary}
                  dict={dict.exercises}
                  pronunciationDict={dict.pronunciation}
                  celebrationDict={celebrationDict}
                  level={level}
                  lessonSlug={lessonSlug}
                  ownerScope={ownerScope}
                  storageKey={`lesson-passed:${level}:${lessonSlug}`}
                  onPassChange={setPassed}
                  enableAudioRecording={content.enableAudioRecording}
                  audioMap={audioMap}
                />
              </div>
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
          // The "complete the exercises to advance" gate only makes sense
          // for a visitor who actually HAS exercises to complete here —
          // ExercisesTab (the only thing that ever flips `passed` to true)
          // is never rendered for a locked lesson, so without this a
          // locked lesson's "next" link would stay permanently disabled
          // for a visitor who was never doing exercises in the first
          // place. Also crawlable either way: the level page and sitemap
          // already list every lesson, so this only affects a real
          // reader's lesson-to-lesson click path, not discoverability.
          isLocked || passed ? (
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
