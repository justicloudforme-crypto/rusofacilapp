import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, isLessonSlug, isFreeTrialLesson, lessonSlugsFor } from "@/lib/courses";
import { getEntitlementTier } from "@/lib/entitlement";
import { getLessonContent } from "@/lib/lessons/content";
import {
  getRelatedStoriesForLesson,
  getRelatedMediaForLesson,
  getGlossaryTermsForLesson,
  getGrammarGuideForLesson,
} from "@/lib/content-links";
import { getAllMedia } from "@/lib/media/data";
import LessonView from "@/components/lesson/LessonView";
import { getRecordingsOwnerScope } from "@/lib/recordings-owner";
import { markStudyDayVisit } from "@/lib/study-day-visit";
import SlideIllustration from "@/components/lesson/SlideIllustration";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, fitTitle, truncateForMeta, paywallJsonLd, routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[level]/[lesson]">): Promise<Metadata> {
  const { lang, level, lesson } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isLessonSlug(level, lesson)) return {};
  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const lessonTitle = levelDict.lessons[Number(lesson) - 1];
  if (!lessonTitle) return {};
  // 168 of the 240 lesson URLs were over Google's ~70-character title
  // ceiling (measured on the live sitemap 29.08.2026), the worst at 110 —
  // lesson names quote Russian conjunctions inline ("Causales: 'потому
  // что', 'так как', 'поскольку'"), which is exactly the part a reader
  // needs and exactly the part that was being cut off.
  const qualifier =
    lang === "ru"
      ? `урок ${lesson}, уровень ${level.toUpperCase()}`
      : `lección ${lesson}, nivel ${level.toUpperCase()}`;
  // Short form for when the long one will not fit. Without it a lesson
  // whose name overflowed fell back to "name | brand" — identical to the
  // grammar VIDEO of the same name, which the live crawl of 30.08.2026
  // caught on /courses/a2/23 and /courses/b1/16.
  const shortQualifier =
    lang === "ru"
      ? `урок ${lesson} (${level.toUpperCase()})`
      : `lección ${lesson} (${level.toUpperCase()})`;
  const title = fitTitle(lessonTitle, qualifier, shortQualifier);
  // The grammar intro is real per-lesson text (unlike levelDict.description,
  // which is the same 4 sentences repeated across all 30 lessons of a
  // level) and is now genuinely visible to every visitor regardless of
  // subscription (see the page component below) — so it's an honest
  // description, not a description of content the reader can't see.
  const content = await getLessonContent(level, lesson);
  const description = content ? truncateForMeta(content.grammar.paragraphs.join(" ")) : levelDict.description;
  return {
    title,
    description,
    alternates: routeAlternates(lang, `/courses/${encodeURIComponent(level)}/${encodeURIComponent(lesson)}`),
  };
}

export default async function LessonPage({
  params,
}: PageProps<"/[lang]/courses/[level]/[lesson]">) {
  const { lang, level, lesson } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isLessonSlug(level, lesson)) notFound();

  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const index = Number(lesson) - 1;
  const title = levelDict.lessons[index];
  if (!title) notFound();

  const slugs = lessonSlugsFor(level);
  const prevSlug = index > 0 ? slugs[index - 1] : null;
  const nextSlug = index < slugs.length - 1 ? slugs[index + 1] : null;
  const [fullContent, tier, ownerScope, relatedStoriesResult, allMedia, glossaryTerms] = await Promise.all([
    getLessonContent(level, lesson),
    getEntitlementTier(),
    // Names the browser-storage bucket the page's practice recordings go
    // into. Reads the signed session cookie, not the database — see
    // src/lib/recordings-owner.ts for why this page in particular must not
    // grow a second user lookup.
    getRecordingsOwnerScope(),
    getRelatedStoriesForLesson(level, lesson),
    getAllMedia(),
    getGlossaryTermsForLesson(level, lesson),
  ]);
  const relatedMediaResult = getRelatedMediaForLesson(level, lesson, allMedia);
  const grammarGuide = getGrammarGuideForLesson(lang, level, lesson);

  // Opening the lesson is the study action — the day counts from here, not
  // from finishing an exercise. Costs no user lookup and no time on the
  // response; see markStudyDayVisit.
  await markStudyDayVisit("lesson");

  // Every level's first lesson is fully open, no subscription required —
  // lets a visitor try the actual exercise/audio mechanic before paying
  // (see isFreeTrialLesson's own comment). Every other lesson still shows
  // its grammar explanation for free (below), but locks vocabulary,
  // exercises, slides, and video behind a subscription — checked by
  // subscription tier, not by login state, so a logged-out visitor (and
  // Googlebot) sees exactly the same thing a logged-in-but-unsubscribed
  // visitor does. This used to be a middleware redirect in proxy.ts for
  // every non-free-trial lesson; moved to page-level content locking so
  // the page itself is always a real, indexable 200 — same pattern as
  // stories (Story.isPremium) and media (MediaItem.free) already use.
  const isFreeTrial = isFreeTrialLesson(level, lesson);
  const entitled = isFreeTrial || tier !== "free";

  // The counts shown in the locked tabs' placeholder cards come from the
  // REAL content, computed here before it gets stripped below — every
  // lesson in the DB has a nonzero vocabulary/exercises/slides count
  // (verified against all 120 rows before shipping this), so there is no
  // "can't compute a number" case to fall back on.
  const lockedCounts = fullContent
    ? {
        vocabulary: fullContent.vocabulary.length,
        exercises: fullContent.exercises.length,
        slides: fullContent.slides?.length ?? 0,
      }
    : null;

  // Only the entitled path (or the always-free lesson 1) actually gets
  // vocabulary/exercises/slides/video/alphabet in the payload sent to the
  // browser — this is a real data cut, not a CSS hide: a non-entitled
  // visitor's HTML/RSC response never contains that content at all, same
  // principle as the story reader's visibleParagraphs truncation.
  const content =
    entitled || !fullContent
      ? fullContent
      : {
          grammar: fullContent.grammar,
          readingPractice: fullContent.readingPractice,
          enableAudioRecording: fullContent.enableAudioRecording,
          vocabulary: [],
          exercises: [],
        };

  // Rendered server-side, once per slide, and handed down as already-built
  // markup — SlideIllustration's shape data (src/lib/lessons/slideIcons.ts,
  // ~10,700 lines) would otherwise have to ship in the client JS bundle for
  // every lesson page, just so the "use client" SlidesTab could pick a
  // shape by icon key at render time. A slide's icon never changes at
  // runtime, so there's nothing for the client to compute here. Built from
  // `content` (already stripped when locked), never `fullContent` — a
  // locked lesson's slide shapes must not leak into the client bundle
  // either.
  const slideIllustrations = Object.fromEntries(
    (content?.slides ?? []).map((slide) => [
      slide.id,
      <SlideIllustration key={slide.id} icon={slide.icon} className="h-full w-full" />,
    ])
  );

  const description = fullContent
    ? truncateForMeta(fullContent.grammar.paragraphs.join(" "))
    : levelDict.description;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: title,
          description,
          learningResourceType: "Lesson",
          educationalLevel: level.toUpperCase(),
          inLanguage: lang,
          isPartOf: {
            "@type": "Course",
            name: levelDict.title,
            url: `${SITE_URL}/${lang}/courses/${level}`,
          },
          url: `${SITE_URL}/${lang}/courses/${level}/${lesson}`,
          ...paywallJsonLd(entitled, ".paywall-lock"),
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.courses, url: `${SITE_URL}/${lang}/courses` },
          { name: levelDict.title, url: `${SITE_URL}/${lang}/courses/${level}` },
          { name: title, url: `${SITE_URL}/${lang}/courses/${level}/${lesson}` },
        ])}
      />
      <LessonView
        lang={lang}
        level={level}
        lessonSlug={lesson}
        ownerScope={ownerScope}
        title={title}
        levelTitle={levelDict.title}
        content={content}
        isLocked={!entitled}
        lockedCounts={lockedCounts}
        slideIllustrations={slideIllustrations}
        dict={dict.lesson}
        celebrationDict={dict.celebration}
        prevHref={prevSlug ? `/${lang}/courses/${level}/${prevSlug}` : null}
        nextHref={nextSlug ? `/${lang}/courses/${level}/${nextSlug}` : null}
      />

      {(relatedStoriesResult.stories.length > 0 ||
        relatedMediaResult.items.length > 0 ||
        glossaryTerms.length > 0 ||
        grammarGuide !== null) && (
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
          {/* Sits above the term links on purpose: this lesson needs the
              concept explained, and the guide explains it, whereas the
              glossary links below are reference lookups. Only a handful
              of lessons have one — see GRAMMAR_GUIDE_FOR_LESSON. */}
          {grammarGuide && (
            <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 dark:border-primary-400/30 dark:bg-primary-400/[0.06]">
              <Link
                href={grammarGuide.href}
                className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                {grammarGuide.title} →
              </Link>
              <p className="mt-1.5 text-sm leading-6 text-foreground/70">{grammarGuide.note}</p>
            </section>
          )}

          {/* Real server-rendered links to the glossary terms this lesson
              introduces. LessonGlossaryTerms.tsx already shows the same
              terms inside the Vocabulary tab, but as popover-opening chips
              in a client component that fetches after mount — so a crawler
              saw none of them: all 240 lesson pages served zero crawlable
              links to /glossary (measured across the whole sitemap on
              2026-08-28). This is a curated relation (GlossaryTerm.
              relatedLessons is hand-maintained), so it gets its own
              specific heading rather than the generic "topic vs level"
              pair the story/media blocks below choose between — those two
              have a real fallback mode to be honest about, this one
              doesn't: it either has curated terms or renders nothing. */}
          {glossaryTerms.length > 0 && (
            <section className={`border-t border-black/10 pt-6 dark:border-white/30 ${grammarGuide ? "mt-6" : ""}`}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {dict.crossLinks.glossaryHeading}
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {glossaryTerms.map((term) => (
                  <li key={term.slug}>
                    <Link
                      href={`/${lang}/glossary/${term.slug}`}
                      className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                    >
                      <span className="mr-1.5 text-xs font-normal uppercase tracking-wide text-foreground/50">
                        {dict.crossLinks.glossaryLabel}
                      </span>
                      {term.term}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${lang}/glossary`}
                className="tap mt-3 inline-block text-sm font-medium text-foreground/60 underline-offset-2 hover:underline hover:text-foreground active:underline"
              >
                {dict.crossLinks.glossaryAllLink} →
              </Link>
            </section>
          )}

          {relatedStoriesResult.stories.length > 0 && (
            <section className={`border-t border-black/10 pt-6 dark:border-white/30 ${glossaryTerms.length > 0 ? "mt-6" : ""}`}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {relatedStoriesResult.kind === "topic"
                  ? dict.crossLinks.topicHeading
                  : `${dict.crossLinks.levelHeadingPrefix} ${level.toUpperCase()}`}
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {relatedStoriesResult.stories.map((story) => (
                  <li key={story.id}>
                    <Link
                      href={`/${lang}/stories/${story.id}`}
                      className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                    >
                      <span className="mr-1.5 text-xs font-normal uppercase tracking-wide text-foreground/50">
                        {dict.crossLinks.storyLabel}
                      </span>
                      {story.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {relatedMediaResult.items.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {relatedMediaResult.kind === "curriculum"
                  ? dict.crossLinks.topicHeading
                  : `${dict.crossLinks.levelHeadingPrefix} ${level.toUpperCase()}`}
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5">
                {relatedMediaResult.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/${lang}/media/${item.id}`}
                      className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                    >
                      <span className="mr-1.5 text-xs font-normal uppercase tracking-wide text-foreground/50">
                        {dict.crossLinks.mediaLabel}
                      </span>
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
