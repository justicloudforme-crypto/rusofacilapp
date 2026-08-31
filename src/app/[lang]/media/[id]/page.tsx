import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getMediaById } from "@/lib/media/data";
import { canAccessMediaItem, getEntitlementTier } from "@/lib/entitlement";
import { markStudyDayVisit } from "@/lib/study-day-visit";
import { getMediaGrammarLinks, getRelatedStoriesForMedia, getRelatedLessonForMedia } from "@/lib/content-links";
import ContentInsights from "@/components/stories/ContentInsights";
import { isPilotMedia } from "@/lib/media-pilot";
import MediaPlayer from "@/components/media/MediaPlayer";
import MediaSubtitlePlayer from "@/components/media/MediaSubtitlePlayer";
import MediaExercises from "@/components/media/MediaExercises";
import VocabularyTab from "@/components/lesson/VocabularyTab";
import JsonLd from "@/components/seo/JsonLd";
import { contentPageTitle, isFrozenPage } from "@/lib/frozen-pages";
import { frozenMediaDescription, mediaDescription } from "@/lib/media/metadata";
import { SITE_URL, breadcrumbList, paywallJsonLd, routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/media/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const item = await getMediaById(id);
  if (!item) return {};
  // Measured across the live sitemap 29.08.2026: every one of the 550
  // media URLs had a title over Google's ~70-character display ceiling,
  // median 110 and 159 at the worst, so the snippet was cut mid-phrase and
  // often before the level ever appeared. fitTitle gives up the brand
  // suffix, then the qualifier, then a trailing parenthetical, in that
  // order — see its own comment for why the order is that way round.
  //
  // The 100 songs in the experiment keep the old, too-long title, byte for
  // byte: <title> is what Google shows and part of what it ranks on, and
  // changing it on half a measured group would move the thing being
  // measured. They are queued for after the 25.09 readout (PROGRESS.md).
  const qualifier =
    lang === "ru"
      ? `русский язык через медиа (${item.level})`
      : `ruso con música y vídeo (${item.level})`;
  // Short form, used when the long one will not fit. Before it existed, a
  // title that overflowed dropped the qualifier entirely and fell back to
  // "base | brand" — which collided with the LESSON of the same name, since
  // the grammar videos mirror the lesson topics on purpose. Caught by the
  // live crawl of 30.08.2026; see fitTitle's own comment.
  const shortQualifier = lang === "ru" ? `видео (${item.level})` : `vídeo (${item.level})`;
  const title = contentPageTitle(item.id, item.title, qualifier, shortQualifier);
  // The /ru description used to be one sentence with only the level
  // substituted in, so all 275 Russian media pages shared five strings
  // between them — measured on the live site 30.08.2026. Naming the item
  // makes each one describe its own page. The Spanish side already had a
  // per-item description; both are now capped at the 155 characters Google
  // shows, the same cap truncateForMeta already applies in the glossary.
  const description = isFrozenPage(item.id)
    ? frozenMediaDescription(lang, item)
    : mediaDescription(lang, item);
  return { title, description, alternates: routeAlternates(lang, `/media/${encodeURIComponent(id)}`) };
}

export default async function MediaDetailPage({
  params,
}: PageProps<"/[lang]/media/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, item, tier] = await Promise.all([getDictionary(lang), getMediaById(id), getEntitlementTier()]);
  if (!dict?.media) notFound();
  if (!item) notFound();

  // A song or a grammar video is study, decided 31.08.2026 — it was the
  // one substantive surface left that gave no day. Same rule as the other
  // six: OPENING it counts, finishing it is not required.
  await markStudyDayVisit("media");

  const relatedStories = await getRelatedStoriesForMedia(item);
  // Which grammar topics this item's transcript actually contains, as
  // crawlable links to the glossary. No example words: unlike a story's
  // free preview, the transcript is gated in full (see `entitled` below).
  const grammarLinks = await getMediaGrammarLinks(item);
  const relatedLesson = getRelatedLessonForMedia(item);
  const relatedLessonTitle = relatedLesson
    ? dict.courses.levels[relatedLesson.level].lessons[Number(relatedLesson.lesson) - 1]
    : null;

  // Free-trial-sample items (see mediaData.json) are open to everyone, no
  // login required; everything else needs any active subscription — no
  // Premium-exclusive slice here (unlike stories/word games), so this is
  // the one lock reason. Checked here (not just via a client-side flag)
  // so the actual video/subtitles/transcript/exercises never reach the
  // browser for a non-entitled visitor.
  const entitled = canAccessMediaItem(tier, item);

  // The item's own key vocabulary, shown to a LOCKED visitor so the page
  // says something concrete about this song rather than only "subscribe".
  // Isolated dictionary words with their translation — the transcript
  // itself stays gated below, and nothing here can produce a line of it.
  // Not rendered for an entitled visitor: they already get the full
  // "Ключевая лексика" section further down, and repeating it would just
  // duplicate the same rows on one page. Pilot-gated — see
  // src/lib/media-pilot.ts for the rule and its control group.
  const insightsVocabulary =
    !entitled && isPilotMedia(item)
      ? item.vocabulary.slice(0, 10).map((v) => ({
          surface: v.word,
          russian: v.word,
          transcription: v.transcription,
          translationEs: v.translation,
        }))
      : [];

  const categoryLabels: Record<string, string> = {
    song: dict.media.categorySong,
    movie: dict.media.categoryMovie,
    video: dict.media.categoryVideo,
    grammar: dict.media.categoryGrammar,
  };

  // Prefer the timestamped, interactive transcript (player + synced/clickable
  // lines) when it's been backfilled; fall back to the plain untimed lyrics
  // block for entries that don't have it yet.
  const hasSubtitles = Boolean(item.subtitles && item.subtitles.length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: item.title,
          description: item.description,
          learningResourceType: categoryLabels[item.category],
          educationalLevel: item.level,
          inLanguage: lang,
          url: `${SITE_URL}/${lang}/media/${item.id}`,
          ...paywallJsonLd(entitled, ".paywall-lock"),
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.media, url: `${SITE_URL}/${lang}/media` },
          { name: item.title, url: `${SITE_URL}/${lang}/media/${item.id}` },
        ])}
      />
      <Link href={`/${lang}/media`} className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground">
        ← {dict.media.backToList}
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70">
          {item.level}
        </span>
        <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground/70">
          {categoryLabels[item.category]}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{item.title}</h1>
      <p className="mt-2 text-foreground/70">{item.description}</p>

      {(relatedStories.length > 0 || relatedLessonTitle) && (
        <section className="mt-6 flex flex-col gap-4 sm:flex-row sm:gap-8">
          {relatedStories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {dict.crossLinks.topicHeading}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {relatedStories.map((story) => (
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
            </div>
          )}

          {relatedLessonTitle && relatedLesson && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {relatedLesson.kind === "curriculum"
                  ? dict.crossLinks.topicHeading
                  : `${dict.crossLinks.levelHeadingPrefix} ${relatedLesson.level.toUpperCase()}`}
              </h2>
              <Link
                href={`/${lang}/courses/${relatedLesson.level}/${relatedLesson.lesson}`}
                className="tap mt-2 block font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                <span className="mr-1.5 text-xs font-normal uppercase tracking-wide text-foreground/50">
                  {dict.crossLinks.lessonLabel}
                </span>
                {relatedLessonTitle}
              </Link>
            </div>
          )}
        </section>
      )}

      {(grammarLinks.length > 0 || insightsVocabulary.length > 0) && (
        <ContentInsights
          lang={lang}
          insights={{ vocabulary: insightsVocabulary, grammar: grammarLinks }}
          dict={{
            vocabHeading: dict.media.insightsVocabHeading,
            vocabNote: dict.media.insightsVocabNote,
            grammarHeading: dict.stories.insightsGrammarHeading,
            grammarNote: dict.media.insightsGrammarNote,
            exampleLabel: dict.stories.insightsExampleLabel,
            glossaryAllLink: dict.crossLinks.glossaryAllLink,
          }}
        />
      )}

      {entitled ? (
        <>
          {hasSubtitles ? (
            <div className="mt-8">
              <MediaSubtitlePlayer
                youtubeVideoId={item.youtubeVideoId}
                title={item.title}
                subtitles={item.subtitles!}
                transcriptHeading={dict.media.transcriptHeading}
                brokenLabel={dict.media.videoBroken}
              />
            </div>
          ) : (
            <>
              <div className="mt-8">
                <MediaPlayer
                  youtubeVideoId={item.youtubeVideoId}
                  title={item.title}
                  emptyLabel={dict.media.videoUnavailable}
                  brokenLabel={dict.media.videoBroken}
                />
              </div>

              <section className="mt-10">
                <h2 className="text-lg font-medium">{dict.media.transcriptHeading}</h2>
                <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-black/10 p-5 dark:border-white/30">
                  {item.lyricsOrTranscript.map((line, index) => (
                    <div key={index} className="text-sm leading-relaxed">
                      <p className="font-medium">{line.russian}</p>
                      {line.translation && <p className="text-foreground/60">{line.translation}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="mt-10">
            <h2 className="text-lg font-medium">{dict.media.vocabularyHeading}</h2>
            <div className="mt-4">
              <VocabularyTab
                vocabulary={item.vocabulary}
                dict={dict.lesson.vocabulary}
                listenLabel={dict.lesson.pronunciation.listenLabel ?? ""}
              />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-medium">{dict.media.exercisesHeading}</h2>
            <div className="mt-4">
              <MediaExercises
                exercises={item.exercises}
                dict={dict.lesson.exercises}
                passedLabel={dict.media.exercisesPassed}
                failedLabel={dict.media.exercisesFailed}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="paywall-lock mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="font-medium">{dict.media.premiumLockTitle}</h2>
          <p className="mt-2 text-sm text-foreground/70">{dict.media.premiumLockBody}</p>
          <Link
            href={`/${lang}/pricing?next=/${lang}/media/${item.id}`}
            className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.media.premiumLockCta}
          </Link>
        </div>
      )}
    </div>
  );
}
