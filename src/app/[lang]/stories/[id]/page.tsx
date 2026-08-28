import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { getStoryAccess, getEntitlementTier } from "@/lib/entitlement";
import { splitStoryParagraphs, toStoryAudioSegments } from "@/lib/stories";
import { getRelatedLessonForStory, getRelatedMediaForStory } from "@/lib/content-links";
import { getAllMedia } from "@/lib/media/data";
import StoryText from "@/components/stories/StoryText";
import PremiumBadge from "@/components/ui/PremiumBadge";
import Card from "@/components/ui/Card";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/stories/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const story = await db.story.findUnique({ where: { id }, select: { title: true, level: true, description: true, descriptionRu: true } });
  if (!story) return {};
  const description =
    (lang === "ru" ? (story.descriptionRu ?? story.description) : story.description) ??
    (lang === "ru"
      ? `Рассказ на русском языке, уровень ${story.level}, в RusoFácilapp.`
      : `Cuento en ruso, nivel ${story.level}, en RusoFácilapp.`);
  const title =
    lang === "ru"
      ? `${story.title} — рассказ на русском (${story.level}) | RusoFácilapp`
      : `${story.title} — cuento en ruso (${story.level}) | RusoFácilapp`;
  return { title, description };
}

export default async function StoryReaderPage({
  params,
}: PageProps<"/[lang]/stories/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  // Independent reads collapsed into one round trip instead of sequential
  // ones — dict/story/tier/allMedia don't depend on each other.
  const [dict, story, tier, allMedia] = await Promise.all([
    getDictionary(lang),
    db.story.findUnique({ where: { id } }),
    getEntitlementTier(),
    getAllMedia(),
  ]);
  if (!story) notFound();

  const relatedLesson = getRelatedLessonForStory(story);
  const relatedLessonTitle = relatedLesson
    ? dict.courses.levels[relatedLesson.level].lessons[Number(relatedLesson.lesson) - 1]
    : null;
  const relatedMedia = getRelatedMediaForStory(story, allMedia);

  // Non-premium stories are open to everyone, no login required. Premium
  // stories need any active subscription (or staff); C1 and premiumOnly
  // stories (a curated ~30% slice, see schema.prisma) need Premium
  // specifically — checked here (not just via a client-side flag) so the
  // full text/audio never reaches the browser for a non-entitled reader.
  const { entitled, reason } = getStoryAccess(tier, story);
  // Distinguishes the two lock states below: "subscribe at all" vs. "you're
  // subscribed, but this needs Premium specifically".
  const needsPremiumUpgrade = reason === "premium";
  const requiresPremiumTier = story.premiumOnly || story.level === "C1";

  // descriptionRu is null for every row today (see schema.prisma) — this
  // fallback is what keeps /ru showing the Spanish summary instead of
  // hiding the block, until the Russian text exists.
  const localizedDescription = lang === "ru" ? (story.descriptionRu ?? story.description) : story.description;

  const paragraphs = splitStoryParagraphs(story.text);
  const visibleParagraphs = entitled ? paragraphs : paragraphs.slice(0, 1);

  const translationParagraphs = story.translationEs ? splitStoryParagraphs(story.translationEs) : [];
  const visibleTranslationParagraphs = entitled
    ? translationParagraphs
    : translationParagraphs.slice(0, 1);

  // Narration clips live in the shared AudioAsset cache, indexed against
  // the FULL story text, so they stay aligned even when visibleParagraphs
  // is truncated to the free preview — just drop clips for paragraphs the
  // reader can't see. Not fetched at all for a non-entitled reader, same
  // as the text/translation truncation above.
  const audioAssetRows = entitled
    ? await db.audioAsset.findMany({
        where: { contentType: "story", contentId: story.id },
        select: { itemKey: true, audioUrl: true, durationSeconds: true },
      })
    : [];
  const audioSegments = toStoryAudioSegments(audioAssetRows).filter(
    (segment) => segment.paragraphIndex < visibleParagraphs.length
  );

  // fullAudioUrl covers the ENTIRE story end to end — only safe to hand to
  // the reader when the reader can see the entire story text (`entitled`).
  // For the paywalled single-paragraph preview, `entitled` is false and
  // visibleParagraphs is truncated to 1 — falling back to the per-sentence
  // audioSegments above (already filtered to that same truncated preview)
  // is what keeps playback from leaking the rest of the story's narration
  // past the paywall.
  const fullAudioUrl = entitled ? story.fullAudioUrl : null;
  const sentenceOffsets =
    entitled && story.sentenceOffsetsJson ? (JSON.parse(story.sentenceOffsetsJson) as number[]) : null;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: story.title,
          ...(localizedDescription ? { description: localizedDescription } : {}),
          author: { "@type": "Person", name: story.author },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
          inLanguage: "ru",
          datePublished: story.createdAt.toISOString(),
          dateModified: story.updatedAt.toISOString(),
          url: `${SITE_URL}/${lang}/stories/${story.id}`,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.stories, url: `${SITE_URL}/${lang}/stories` },
          { name: story.title, url: `${SITE_URL}/${lang}/stories/${story.id}` },
        ])}
      />
      <Link
        href={`/${lang}/stories`}
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← {dict.stories.backToList}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70">
          {story.level}
        </span>
        {story.isPremium && <PremiumBadge icon="⭐">{dict.stories.premiumBadge}</PremiumBadge>}
        {requiresPremiumTier && <PremiumBadge>{dict.stories.premiumTierBadge}</PremiumBadge>}
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{story.title}</h1>
      <p className="mt-1 text-foreground/60">
        {dict.stories.byAuthor} {story.author}
      </p>
      {localizedDescription && <p className="mt-3 text-foreground/70">{localizedDescription}</p>}

      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-foreground/40">
        {dict.stories.translationHint}
      </p>
      <div className="mt-3">
        <StoryText
          storyId={entitled ? story.id : null}
          title={story.title}
          author={story.author}
          paragraphs={visibleParagraphs}
          translationParagraphs={visibleTranslationParagraphs}
          audioSegments={audioSegments}
          fullAudioUrl={fullAudioUrl}
          sentenceOffsets={sentenceOffsets}
          dict={{
            translationLoading: dict.stories.translationLoading,
            translationError: dict.stories.translationError,
            wordListenLabel: dict.stories.wordListenLabel,
            closeLabel: dict.stories.closeLabel,
            playLabel: dict.stories.playLabel,
            pauseLabel: dict.stories.pauseLabel,
            skipBackLabel: dict.stories.skipBackLabel,
            skipForwardLabel: dict.stories.skipForwardLabel,
            seekLabel: dict.stories.seekLabel,
            completedBadge: dict.stories.completedBadge,
          }}
        />
      </div>

      {!entitled && (
        <Card tone="premium" padding="lg" className="mt-10">
          <h2 className="font-medium">
            {needsPremiumUpgrade ? dict.stories.premiumTierLockTitle : dict.stories.premiumLockTitle}
          </h2>
          <p className="mt-2 text-sm text-foreground/70">
            {needsPremiumUpgrade ? dict.stories.premiumTierLockBody : dict.stories.premiumLockBody}
          </p>
          <Link
            href={`/${lang}/pricing?next=/${lang}/stories/${story.id}`}
            className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.stories.premiumLockCta}
          </Link>
        </Card>
      )}

      {relatedLesson && relatedLessonTitle && (
        <section className="mt-10 border-t border-black/10 pt-6 dark:border-white/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            {relatedLesson.kind === "topic"
              ? dict.crossLinks.topicHeading
              : `${dict.crossLinks.levelHeadingPrefix} ${relatedLesson.level.toUpperCase()}`}
          </h2>
          <Link
            href={`/${lang}/courses/${relatedLesson.level}/${relatedLesson.lesson}`}
            className="tap mt-3 block font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            <span className="mr-1.5 text-xs font-normal uppercase tracking-wide text-foreground/50">
              {dict.crossLinks.lessonLabel}
            </span>
            {relatedLessonTitle}
          </Link>
        </section>
      )}

      {relatedMedia.length > 0 && (
        <section className="mt-6">
          {!relatedLesson && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {dict.crossLinks.topicHeading}
            </h2>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {relatedMedia.map((item) => (
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
  );
}
