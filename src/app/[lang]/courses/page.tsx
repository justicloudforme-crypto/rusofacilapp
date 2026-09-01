import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelMeta, levelSlugs } from "@/lib/courses";
import { introSlides } from "@/lib/intro/content";
import IntroPresentation from "@/components/intro/IntroPresentation";
import LevelGlossaryBadge from "@/components/glossary/LevelGlossaryBadge";
import LevelBadge from "@/components/LevelBadge";
import type { FlashcardLevel } from "@/lib/flashcards/types";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, routeAlternates } from "@/lib/site";
import { plural } from "@/lib/plural";

export async function generateMetadata({ params }: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const alternates = routeAlternates(lang, "/courses");
  // ES copy written for actual Spanish search demand ("curso de ruso
  // online", "aprender ruso") rather than a straight translation of the
  // visible H1/subtitle below — deliberately doesn't touch
  // dict.courses.pageTitle/pageSubtitle, which stay as the on-page copy for
  // both locales. Neutral Spanish (no regionalisms) since the audience is
  // Spanish-speakers everywhere (Latin America + Spain), not just Mexico.
  if (lang === "es") {
    return {
      title: "Curso de ruso online — Niveles A1 a B2 | RusoFácilapp",
      description:
        "Aprende ruso paso a paso: 4 niveles, gramática explicada en español, ejercicios y audio nativo. Primera lección gratis.",
      alternates,
    };
  }
  return {
    title: `${dict.courses.pageTitle} | RusoFácilapp`,
    description: dict.courses.pageSubtitle,
    alternates,
  };
}

export default async function CoursesPage({ params }: PageProps<"/[lang]/courses">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const levels = levelSlugs.map((slug) => ({
    slug,
    title: dict.courses.levels[slug].title,
    subtitle: dict.courses.levels[slug].subtitle,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.courses, url: `${SITE_URL}/${lang}/courses` },
        ])}
      />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {dict.courses.pageTitle}
      </h1>
      <p className="mt-3 max-w-xl text-foreground/70">
        {dict.courses.pageSubtitle}
      </p>

      <div className="mx-auto mt-12 max-w-3xl">
        <h2 className="text-xl font-semibold tracking-tight">{dict.intro.title}</h2>
        <p className="mt-2 text-sm text-foreground/70">{dict.intro.subtitle}</p>
        <div className="mt-6">
          <IntroPresentation slides={introSlides} lang={lang} levels={levels} dict={dict.intro} />
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {levelSlugs.map((slug) => {
          const level = dict.courses.levels[slug];
          const meta = levelMeta[slug];
          return (
            <Link
              key={slug}
              href={`/${lang}/courses/${slug}`}
              className="tap group flex flex-col rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
            >
              <div className="flex items-center justify-between gap-2">
                <LevelBadge level={slug.toUpperCase() as FlashcardLevel} />
                <LevelGlossaryBadge
                  level={slug}
                  dict={{
                    locale: lang,
                    completeLabel: dict.courses.levelMasteredBadge,
                    progressLabel: dict.courses.levelProgressLabel,
                  }}
                />
              </div>
              <h2 className="mt-1 text-lg font-medium">{level.title}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground/70">
                {level.description}
              </p>
              <div className="mt-4 flex items-center gap-3 text-sm text-foreground/60">
                <span>
                  {meta.weeks} {plural(lang, meta.weeks, dict.courses.weeks)}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {meta.hoursPerWeek} {dict.courses.hoursPerWeek}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* The catalog is where a learner picks a level and first meets the
          grammar vocabulary the lessons are named after ("Caso
          instrumental", "Aspecto verbal"), so this is where a pointer to
          the glossary is actually useful rather than decorative — and it
          sits one hop above all 240 lesson pages in the site hierarchy.
          The navbar entry added alongside this already gives /glossary a
          link from every page including the homepage, so this block is
          for context, not for link equity on its own. */}
      <section className="mt-12 rounded-2xl border border-black/10 p-6 dark:border-white/30">
        <p className="text-sm leading-6 text-foreground/70">{dict.courses.glossaryNote}</p>
        <Link
          href={`/${lang}/glossary`}
          className="tap mt-3 inline-block font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          {dict.courses.glossaryCta} →
        </Link>
      </section>
    </div>
  );
}
