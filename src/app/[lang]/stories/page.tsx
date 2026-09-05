import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getStoryCatalog } from "@/lib/stories-catalog";
import { getEntitlementTier, getStoryAccess } from "@/lib/entitlement";
import { storyLevels } from "@/lib/stories";
import { localizeStoryAuthor } from "@/lib/story-author";
import StoriesCatalog from "@/components/stories/StoriesCatalog";
import StoryLinkIndex from "@/components/stories/StoryLinkIndex";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, routeAlternates } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/stories">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  if (!dict?.stories) return {};
  const alternates = routeAlternates(lang, "/stories");
  // ES copy written for actual search demand ("cuentos en ruso con audio")
  // rather than a translation of the visible H1/subtitle — see the same
  // note in courses/page.tsx's generateMetadata. Neutral Spanish, no
  // regionalisms.
  if (lang === "es") {
    return {
      title: "Cuentos en ruso con audio y traducción | RusoFácilapp",
      description:
        "Practica ruso leyendo cuentos clásicos y originales, con audio narrado y traducción al español, por nivel (A1–C1).",
      alternates,
    };
  }
  return {
    title: `${dict.stories.pageTitle} | RusoFácilapp`,
    description: dict.stories.pageSubtitle,
    alternates,
  };
}

export default async function StoriesPage({ params }: PageProps<"/[lang]/stories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.stories) notFound();

  const [rawStories, tier] = await Promise.all([getStoryCatalog(), getEntitlementTier()]);

  // Sorted (stable) accessible-first, locked-at-the-end — a story this
  // visitor can't open at all right now shouldn't crowd out the ones they
  // can, per the access-tier policy's list-ordering rule. `lockReason`
  // drives the card's badge/paywall-on-click (see StoriesCatalog); `null`
  // means fully accessible. Level (A1->C1) is the secondary key *within*
  // each of those two groups — sorting by level alone would let a locked
  // A1 story outrank an accessible C1 one, which is exactly what the
  // accessible-first rule above exists to prevent.
  const levelRank = new Map(storyLevels.map((level, index) => [level, index]));
  const stories = rawStories
    .map((story) => ({
      ...story,
      // descriptionRu is null for every row today (see schema.prisma) —
      // this fallback is what keeps /ru showing the Spanish summary
      // instead of hiding the block, until the Russian text exists.
      description: lang === "ru" ? (story.descriptionRu ?? story.description) : story.description,
      // Same idea one column over: `author` is a single column read by both
      // locales, and on /es it was rendering «Por Русская народная сказка»
      // (see story-author.ts). Applied HERE rather than in
      // getStoryCatalog() so the catalog cache stays locale-independent,
      // and after `isClassic` has already been derived from the raw value.
      author: localizeStoryAuthor(story.author, lang),
      lockReason: getStoryAccess(tier, story).reason,
    }))
    .sort((a, b) => {
      const lockDiff = Number(a.lockReason !== null) - Number(b.lockReason !== null);
      if (lockDiff !== 0) return lockDiff;
      return (levelRank.get(a.level) ?? 0) - (levelRank.get(b.level) ?? 0);
    });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.stories, url: `${SITE_URL}/${lang}/stories` },
        ])}
      />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict?.stories?.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict?.stories?.pageSubtitle}</p>

      <div className="mt-10">
        <StoriesCatalog lang={lang} stories={stories} dict={dict.stories} />
      </div>

      {/* Под каталогом, а не вместо него: каталог остаётся клиентским со
          своими фильтрами и «показать ещё», а это — ребро графа на каждый
          из 325 рассказов, которого без JavaScript не существовало (замер
          прода 05.09.2026: 24 якоря на странице, PROGRESS.md 7.112).
          `rawStories`, а не `stories`: во втором порядок зависит от тарифа
          посетителя, и HTML страницы менялся бы от того, кто её открыл. */}
      <StoryLinkIndex
        lang={lang}
        stories={rawStories.map((story) => ({ id: story.id, title: story.title, level: story.level }))}
        dict={{ indexTitle: dict.stories.indexTitle, indexIntro: dict.stories.indexIntro }}
      />
    </div>
  );
}
