import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getMediaById } from "@/lib/media/data";
import MediaPlayer from "@/components/media/MediaPlayer";
import MediaSubtitlePlayer from "@/components/media/MediaSubtitlePlayer";
import MediaExercises from "@/components/media/MediaExercises";
import VocabularyTab from "@/components/lesson/VocabularyTab";

export default async function MediaDetailPage({
  params,
}: PageProps<"/[lang]/media/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.media) notFound();

  const item = await getMediaById(id);
  if (!item) notFound();

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
      <Link href={`/${lang}/media`} className="text-sm font-medium text-foreground/60 hover:text-foreground">
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
            <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-black/10 p-5 dark:border-white/10">
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
    </div>
  );
}
