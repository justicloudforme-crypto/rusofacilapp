import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { getStoryAccess, getEntitlementTier } from "@/lib/entitlement";
import { splitStoryParagraphs, toStoryAudioSegments } from "@/lib/stories";
import StoryText from "@/components/stories/StoryText";

export default async function StoryReaderPage({
  params,
}: PageProps<"/[lang]/stories/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  // Independent reads collapsed into one round trip instead of 3 sequential
  // ones — dict/story/tier don't depend on each other.
  const [dict, story, tier] = await Promise.all([
    getDictionary(lang),
    db.story.findUnique({ where: { id } }),
    getEntitlementTier(),
  ]);
  if (!story) notFound();

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

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
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
        {story.isPremium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            ⭐ {dict.stories.premiumBadge}
          </span>
        )}
        {requiresPremiumTier && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            👑 {dict.stories.premiumTierBadge}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{story.title}</h1>
      <p className="mt-1 text-foreground/60">
        {dict.stories.byAuthor} {story.author}
      </p>
      {story.description && (
        <p className="mt-3 text-foreground/70">{story.description}</p>
      )}

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
        <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
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
        </div>
      )}
    </div>
  );
}
