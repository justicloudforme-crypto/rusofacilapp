import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, isLessonSlug, isFreeTrialLesson, lessonSlugsFor } from "@/lib/courses";
import { getCurrentUser } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { isStaff } from "@/lib/roles";
import { getLessonContent } from "@/lib/lessons/content";
import { getRelatedStoriesForLesson, getRelatedMediaForLesson } from "@/lib/content-links";
import { getAllMedia } from "@/lib/media/data";
import LessonView from "@/components/lesson/LessonView";
import SlideIllustration from "@/components/lesson/SlideIllustration";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

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
  return { title, description: levelDict.description };
}

export default async function LessonPage({
  params,
}: PageProps<"/[lang]/courses/[level]/[lesson]">) {
  const { lang, level, lesson } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isLessonSlug(level, lesson)) notFound();

  // Proxy already gates this route, but auth/subscription state is
  // re-checked here too: a page should never rely solely on the proxy for
  // access control (a matcher change elsewhere shouldn't silently expose it).
  // The free-trial lesson (A1/1) is public even to a logged-out visitor —
  // see proxy.ts's protectLessonRoute for why this matters for SEO. Staff
  // (owner/admin) bypass the subscription requirement entirely.
  const isFreeTrial = isFreeTrialLesson(level, lesson);
  const user = await getCurrentUser();
  if (!isFreeTrial && (!user || (!isStaff(user.role) && !(await userHasActiveSubscription(user.id))))) {
    redirect(`/${lang}/pricing?next=/${lang}/courses/${level}/${lesson}`);
  }

  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const index = Number(lesson) - 1;
  const title = levelDict.lessons[index];
  if (!title) notFound();

  const slugs = lessonSlugsFor(level);
  const prevSlug = index > 0 ? slugs[index - 1] : null;
  const nextSlug = index < slugs.length - 1 ? slugs[index + 1] : null;
  const [content, relatedStoriesResult, allMedia] = await Promise.all([
    getLessonContent(level, lesson),
    getRelatedStoriesForLesson(level, lesson),
    getAllMedia(),
  ]);
  const relatedMediaResult = getRelatedMediaForLesson(level, lesson, allMedia);

  // Rendered server-side, once per slide, and handed down as already-built
  // markup — SlideIllustration's shape data (src/lib/lessons/slideIcons.ts,
  // ~10,700 lines) would otherwise have to ship in the client JS bundle for
  // every lesson page, just so the "use client" SlidesTab could pick a
  // shape by icon key at render time. A slide's icon never changes at
  // runtime, so there's nothing for the client to compute here.
  const slideIllustrations = Object.fromEntries(
    (content?.slides ?? []).map((slide) => [
      slide.id,
      <SlideIllustration key={slide.id} icon={slide.icon} className="h-full w-full" />,
    ])
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: title,
          description: levelDict.description,
          learningResourceType: "Lesson",
          educationalLevel: level.toUpperCase(),
          inLanguage: lang,
          isPartOf: {
            "@type": "Course",
            name: levelDict.title,
            url: `${SITE_URL}/${lang}/courses/${level}`,
          },
          url: `${SITE_URL}/${lang}/courses/${level}/${lesson}`,
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
        slideIllustrations={slideIllustrations}
        dict={dict.lesson}
        celebrationDict={dict.celebration}
        prevHref={prevSlug ? `/${lang}/courses/${level}/${prevSlug}` : null}
        nextHref={nextSlug ? `/${lang}/courses/${level}/${nextSlug}` : null}
      />

      {(relatedStoriesResult.stories.length > 0 || relatedMediaResult.items.length > 0) && (
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
          {relatedStoriesResult.stories.length > 0 && (
            <section className="border-t border-black/10 pt-6 dark:border-white/30">
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
