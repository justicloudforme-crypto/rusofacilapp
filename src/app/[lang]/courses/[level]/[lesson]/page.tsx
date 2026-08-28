import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, isLessonSlug, isFreeTrialLesson, lessonSlugsFor } from "@/lib/courses";
import { getEntitlementTier } from "@/lib/entitlement";
import { getLessonContent } from "@/lib/lessons/content";
import { getRelatedStoriesForLesson, getRelatedMediaForLesson, getGlossaryTermsForLesson } from "@/lib/content-links";
import { getAllMedia } from "@/lib/media/data";
import LessonView from "@/components/lesson/LessonView";
import SlideIllustration from "@/components/lesson/SlideIllustration";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, truncateForMeta, paywallJsonLd } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[level]/[lesson]">): Promise<Metadata> {
  const { lang, level, lesson } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isLessonSlug(level, lesson)) return {};
  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const lessonTitle = levelDict.lessons[Number(lesson) - 1];
  if (!lessonTitle) return {};
  const title =
    lang === "ru"
      ? `${lessonTitle} — урок ${lesson}, уровень ${level.toUpperCase()} | RusoFácilapp`
      : `${lessonTitle} — lección ${lesson}, nivel ${level.toUpperCase()} | RusoFácilapp`;
  // The grammar intro is real per-lesson text (unlike levelDict.description,
  // which is the same 4 sentences repeated across all 30 lessons of a
  // level) and is now genuinely visible to every visitor regardless of
  // subscription (see the page component below) — so it's an honest
  // description, not a description of content the reader can't see.
  const content = await getLessonContent(level, lesson);
  const description = content ? truncateForMeta(content.grammar.paragraphs.join(" ")) : levelDict.description;
  return { title, description };
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
  const [fullContent, tier, relatedStoriesResult, allMedia, glossaryTerms] = await Promise.all([
    getLessonContent(level, lesson),
    getEntitlementTier(),
    getRelatedStoriesForLesson(level, lesson),
    getAllMedia(),
    getGlossaryTermsForLesson(level, lesson),
  ]);
  const relatedMediaResult = getRelatedMediaForLesson(level, lesson, allMedia);

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

      {(relatedStoriesResult.stories.length > 0 || relatedMediaResult.items.length > 0 || glossaryTerms.length > 0) && (
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
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
            <section className="border-t border-black/10 pt-6 dark:border-white/30">
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
