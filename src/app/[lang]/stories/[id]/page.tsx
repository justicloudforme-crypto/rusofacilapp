import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { userHasActiveSubscription } from "@/lib/subscription";
import { splitStoryParagraphs } from "@/lib/stories";
import AudioPlayer from "@/components/stories/AudioPlayer";
import StoryText from "@/components/stories/StoryText";

export default async function StoryReaderPage({
  params,
}: PageProps<"/[lang]/stories/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const story = await db.story.findUnique({ where: { id } });
  if (!story) notFound();

  // Non-premium stories are open to everyone, no login required. Premium
  // stories need either staff access or an active subscription — checked
  // here (not just via a client-side flag) so the full text/audio never
  // reaches the browser for a non-entitled reader.
  const user = await getCurrentUser();
  const entitled =
    !story.isPremium ||
    Boolean(user && (isStaff(user.role) || (await userHasActiveSubscription(user.id))));

  const paragraphs = splitStoryParagraphs(story.text);
  const visibleParagraphs = entitled ? paragraphs : paragraphs.slice(0, 1);

  const translationParagraphs = story.translationEs ? splitStoryParagraphs(story.translationEs) : [];
  const visibleTranslationParagraphs = entitled
    ? translationParagraphs
    : translationParagraphs.slice(0, 1);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href={`/${lang}/stories`}
        className="text-sm font-medium text-foreground/60 hover:text-foreground"
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
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{story.title}</h1>
      <p className="mt-1 text-foreground/60">
        {dict.stories.byAuthor} {story.author}
      </p>
      {story.description && (
        <p className="mt-3 text-foreground/70">{story.description}</p>
      )}

      {entitled && <AudioPlayer audioUrl={story.audioUrl} label={dict.stories.audioLabel} />}

      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-foreground/40">
        {dict.stories.translationHint}
      </p>
      <div className="mt-3">
        <StoryText
          storyId={entitled ? story.id : null}
          paragraphs={visibleParagraphs}
          translationParagraphs={visibleTranslationParagraphs}
          dict={{
            translationLoading: dict.stories.translationLoading,
            translationError: dict.stories.translationError,
            wordListenLabel: dict.stories.wordListenLabel,
            closeLabel: dict.stories.closeLabel,
            showTranslationButton: dict.stories.showTranslationButton,
            hideTranslationButton: dict.stories.hideTranslationButton,
            playLabel: dict.stories.playLabel,
            pauseLabel: dict.stories.pauseLabel,
            pageLabel: dict.stories.pageLabel,
            prevPageLabel: dict.stories.prevPageLabel,
            nextPageLabel: dict.stories.nextPageLabel,
            completedBadge: dict.stories.completedBadge,
          }}
        />
      </div>

      {!entitled && (
        <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="font-medium">{dict.stories.premiumLockTitle}</h2>
          <p className="mt-2 text-sm text-foreground/70">{dict.stories.premiumLockBody}</p>
          <Link
            href={`/${lang}/pricing?next=/${lang}/stories/${story.id}`}
            className="mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
          >
            {dict.stories.premiumLockCta}
          </Link>
        </div>
      )}
    </div>
  );
}
