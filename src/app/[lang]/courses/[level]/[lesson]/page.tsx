import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, isLessonSlug, isFreeTrialLesson, lessonSlugsFor } from "@/lib/courses";
import { getCurrentUser } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { isStaff } from "@/lib/roles";
import { getLessonContent } from "@/lib/lessons/content";
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
  const content = await getLessonContent(level, lesson);

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
    </>
  );
}
