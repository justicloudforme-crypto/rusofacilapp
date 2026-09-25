import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { getStoryAccess, getEntitlementTier } from "@/lib/entitlement";
import { isNativeShellRequest } from "@/lib/native-shell";
import { nativeAccessCopy, nativeLockBody } from "@/lib/native-access-copy";
import { splitStoryParagraphs, toStoryAudioSegments } from "@/lib/stories";
import { getContentInsights, getRelatedLessonForStory, getRelatedMediaForStory } from "@/lib/content-links";
import { isPilotStory } from "@/lib/story-pilot";
import { getCulturalNote } from "@/lib/story-culture";
import { getAllMedia } from "@/lib/media/data";
import StoryText from "@/components/stories/StoryText";
import DownloadButton from "@/components/DownloadButton";
import ContentInsights from "@/components/stories/ContentInsights";
import CulturalNote from "@/components/stories/CulturalNote";
import AccessMark from "@/components/ui/AccessMark";
import { accessSignFor, storyRequirement } from "@/lib/access-marks";
import Card from "@/components/ui/Card";
import JsonLd from "@/components/seo/JsonLd";
import { contentPageTitle, isFrozenPage } from "@/lib/frozen-pages";
import { storyTitles } from "@/lib/story-title";
import StoryTitle from "@/components/stories/StoryTitle";
import { SITE_URL, breadcrumbList, paywallJsonLd, routeAlternates, truncateForMeta } from "@/lib/site";

/**
 * Запасные метаданные страницы рассказа — на случай, когда база не
 * ответила вовсе (см. длинный комментарий в `generateMetadata`). Написаны
 * здесь, а не собраны из словаря, намеренно: словарь грузится своим
 * `await`, и подставлять запасной текст через ещё одно возможное падение
 * значило бы чинить отказ отказом.
 */
const FALLBACK_STORY_METADATA: Record<"es" | "ru", { title: string; description: string }> = {
  es: {
    title: "Cuento en ruso | RusoFácilapp",
    description: "Lee cuentos en ruso con audio y traducción al español, por nivel (A1–C1).",
  },
  ru: {
    title: "Рассказ на русском | RusoFácilapp",
    description: "Рассказы на русском языке с озвучкой и переводом, по уровням A1–C1.",
  },
};

/**
 * ОДНО ЧТЕНИЕ РАССКАЗА НА ЗАПРОС — 21.09.2026, заход 7.222, строка 292.
 *
 * Замерено прибором `src/lib/db-read-meter.ts`: за одно открытие страницы
 * рассказа уходило `SELECT Story` **дважды** — раз из `generateMetadata`
 * (пять колонок), раз из тела страницы (строка целиком). В Next.js это
 * два разных вызова, и знать друг о друге им нечем.
 *
 * Почему ОБЩЕЕ чтение берёт строку ЦЕЛИКОМ, а не пять колонок. Тело
 * страницы всё равно читает её целиком — там текст рассказа, перевод и
 * разметка. Сузить общее чтение до пяти колонок значило бы оставить телу
 * второй поход, то есть не убрать ничего. Наоборот: узкое чтение
 * метаданных исчезает, и полное остаётся ОДНО на весь ответ.
 *
 * ДВЕ ГРАНИЦЫ ОТКАЗА, РЕШЁННЫЕ ЗАХОДОМ 7.220, ОСТАЮТСЯ РАЗНЫМИ, и это не
 * на словах. Памятка `cache` запоминает обещание вместе с его отказом:
 * `generateMetadata` свой `try` сохраняет и по-прежнему отдаёт запасной
 * заголовок, а тело страницы получает ТО ЖЕ отказавшее обещание и падает
 * громко — рассказ это содержимое, и пустая страница вместо него была бы
 * враньём. Заперто в `db-read-resilience.test.ts`.
 */
const getStoryById = cache((id: string) => db.story.findUnique({ where: { id } }));

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/stories/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};
  const alternates = routeAlternates(lang, `/stories/${encodeURIComponent(id)}`);
  /**
   * ОТКАЗ ЭТОГО ЧТЕНИЯ СТОИЛ ВСЕЙ СТРАНИЦЫ — 20.09.2026, заход 7.220.
   *
   * Что измерено. Sentry `JAVASCRIPT-NEXTJS-12`: `Invalid
   * prisma.story.findUnique() invocation` … `BLOCKED: Operation was
   * blocked`, **unhandled**, транзакция `Page.generateMetadata
   * (/[lang]/stories/[id])`, **126 событий** — самая частая запись
   * семейства. `BLOCKED` отдаёт сама Turso при исчерпанной квоте чтений
   * (авария 11.09.2026, PROGRESS.md строка 135).
   *
   * Почему это отдельный дефект от тела страницы. В Next.js
   * `generateMetadata` и рендер страницы — два разных вызова, и падение
   * ЛЮБОГО из них даёт 500 на весь ответ. То есть рассказ, чьё тело
   * прочиталось бы, всё равно не показывался, потому что не прочитался
   * заголовок вкладки. Заголовок вкладки — не содержимое рассказа.
   *
   * Что теперь. Отказ стоит ТОЧНОГО заголовка: страница отдаёт запасные
   * метаданные — родовое название раздела на своём языке и canonical,
   * который от базы не зависит вовсе. Тело страницы при этом остаётся
   * ГРОМКИМ (`db.story.findUnique` ниже, без try): рассказ — содержимое,
   * и показывать пустую страницу вместо него было бы враньём. Обе
   * половины заперты в `src/lib/db-read-resilience.test.ts`.
   */
  let story: {
    title: string;
    titleEs: string | null;
    level: string;
    description: string | null;
    descriptionRu: string | null;
  } | null = null;
  try {
    story = await getStoryById(id);
  } catch (error) {
    console.error(
      "[stories/[id]] не удалось прочитать рассказ для метаданных — отдаю запасной заголовок",
      error
    );
    return { ...FALLBACK_STORY_METADATA[lang], alternates };
  }
  if (!story) return {};
  const rawDescription =
    (lang === "ru" ? (story.descriptionRu ?? story.description) : story.description) ??
    (lang === "ru"
      ? `Рассказ на русском языке, уровень ${story.level}, в RusoFácilapp.`
      : `Cuento en ruso, nivel ${story.level}, en RusoFácilapp.`);
  // 190 of the 650 story descriptions ran past the ~155 characters Google
  // shows in a snippet, up to 283 (measured on the live site 30.08.2026).
  // truncateForMeta is the same cap the glossary and the lessons already
  // use. Frozen stories keep the untruncated string: 10 of them are over
  // the cap and are queued with the rest of that backlog.
  const description = isFrozenPage(id) ? rawDescription : truncateForMeta(rawDescription);
  // 17 of the 520 non-frozen story URLs were over Google's ~70-character
  // title ceiling (measured on the live sitemap 29.08.2026), the worst at
  // 95. The 65 stories in the experiment keep their old title byte for
  // byte, 3 of which are over the ceiling — queued for after the 25.09
  // readout, see PROGRESS.md and lib/frozen-pages.ts.
  const qualifier =
    lang === "ru" ? `рассказ на русском (${story.level})` : `cuento en ruso (${story.level})`;
  const shortQualifier = lang === "ru" ? `рассказ (${story.level})` : `cuento (${story.level})`;
  // База заголовка — та же строка, что напечатана в `<h1>` крупно: на
  // `/es` испанская, когда она есть, иначе русская. Русский оригинал в
  // `<title>` не добавляется: потолок SERP — 70 знаков (`fitTitle`), и
  // второе название вытеснило бы из выдачи уровень, то есть заплатило бы
  // тем, ради чего заголовок и подгоняется. У замороженных страниц
  // `storyTitles` и без того отдаёт русское название, а
  // `contentPageTitle` — старую форму строки; так две ветки заморозки
  // говорят одно и то же.
  const title = contentPageTitle(id, storyTitles(story, lang).primary, qualifier, shortQualifier);
  return { title, description, alternates };
}

/** `Story.sentenceOffsetsJson` -> offsets, or null if the row is unusable.
 * Returns null rather than throwing: without offsets the reader loses
 * sentence highlighting and keeps the story. */
function parseSentenceOffsets(json: string | null): number[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number" && Number.isFinite(n))) {
      console.error("[story] sentenceOffsetsJson is not an array of numbers — highlighting disabled");
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("[story] sentenceOffsetsJson is not valid JSON — highlighting disabled", error);
    return null;
  }
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
    getStoryById(id),
    getEntitlementTier(),
    getAllMedia(),
  ]);
  if (!story) notFound();

  // ДЕНЬ ЗАНЯТИЯ СТАВИТ ДЕЙСТВИЕ, А НЕ ОТКРЫТИЕ (17.09.2026, заход
  // 7.204). Рассказ ставит день, когда прочитан ХОТЯ БЫ ДО ПОЛОВИНЫ, —
  // `POST /api/reading-progress`, порог STUDY_DAY_READ_PERCENT.

  const titles = storyTitles(story, lang);

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
  // Значок платности — через общий признак, а не через ещё одно
  // повторение правила: `storyRequirement` и `getStoryAccess` сверены
  // друг с другом тестом по всем восьми сочетаниям колонок.
  // 7.196: и сорт, и состояние доступа решает одно правило. Внутри
  // оболочки 👑 стоит у премиального рассказа при любой роли — человек,
  // который платит за Premium, обязан видеть, за что именно; в вебе
  // возвращается прежний ответ, знак в знак.
  // 7.212: рассказ — единица целиком (`wholeUnit` по умолчанию), и
  // прежний вердикт `closed: !entitled` был тем же ответом другими
  // словами: согласие `meetsRequirement(storyRequirement(...), tier)` с
  // `getStoryAccess(...).entitled` заперто пробой `access-marks.test.ts`
  // по всем восьми сочетаниям колонок.
  const storySign = accessSignFor(storyRequirement(story), tier, {
    nativeShell: await isNativeShellRequest(),
  });

  // descriptionRu is null for every row today (see schema.prisma) — this
  // fallback is what keeps /ru showing the Spanish summary instead of
  // hiding the block, until the Russian text exists.
  const localizedDescription = lang === "ru" ? (story.descriptionRu ?? story.description) : story.description;

  const paragraphs = splitStoryParagraphs(story.text);
  const visibleParagraphs = entitled ? paragraphs : paragraphs.slice(0, 1);

  // Reads the whole story, but can only ever emit single dictionary words
  // and grammar-topic links — never a sentence, and never a summary. The
  // paywalled text itself stays truncated to visibleParagraphs above,
  // untouched. Pilot-gated (see src/lib/story-pilot.ts): 50 A1 stories,
  // with 15 more A1 stories deliberately left as an untouched control.
  const insights = isPilotStory(story) ? await getContentInsights(story.text) : null;

  // Hand-written origin note, for the 40 classic (non-original) stories
  // outside the frozen experiment — see src/lib/story-culture.ts. Written
  // from sources about the text, not derived from the text, so it says
  // nothing the paywall is protecting.
  const culturalNote = getCulturalNote(story, lang);

  const translationParagraphs = story.translationEs ? splitStoryParagraphs(story.translationEs) : [];
  const visibleTranslationParagraphs = entitled
    ? translationParagraphs
    : translationParagraphs.slice(0, 1);

  // Narration clips live in the shared AudioAsset cache, indexed against
  // the FULL story text, so they stay aligned even when visibleParagraphs
  // is truncated to the free preview — just drop clips for paragraphs the
  // reader can't see. Fetched for EVERY reader, entitled or not: the
  // filter below hands out exactly the narration of the paragraphs the
  // page already prints, so a locked story's preview is read aloud in the
  // same studio voice the buyer hears instead of falling through to the
  // browser's system voice (PROGRESS.md 7.160/7.161, debt 114 — the free
  // preview of 323 of 325 stories was narrated by the OS: Milena on
  // macOS/iOS, "Google русский" on Android). No leak and no new clips: the
  // truncation is the same one applied to the text and the translation
  // above, and `fullAudioUrl` (the whole story end to end) stays withheld
  // below.
  //
  // ОТКАЗ ЭТОГО ЧТЕНИЯ СТОИТ ПРОИГРЫВАТЕЛЯ, А НЕ РАССКАЗА — 21.09.2026,
  // заход 7.222, строка долга 295.
  //
  // До правки чтение стояло голым, и это единственное место из 25,
  // которое перепись 7.220 назвала поимённо как НЕзаконно громкое:
  // «озвучка — украшение: рассказ читается и без неё». Стоило оно всей
  // страницы — 650 адресов рассказов отдавали бы 500 при следующей
  // аварии квоты Turso (строка 135), потеряв текст, перевод, разбор и
  // ссылки ради кнопки воспроизведения.
  //
  // Деградация ровно в ту сторону, в какую можно: без клипов остаются
  // пустые `audioSegments`, `StoryText` печатает тот же текст и рисует
  // те же абзацы, а `fullAudioUrl` (ниже) от этого чтения не зависит
  // вовсе — он колонка самой строки рассказа.
  //
  // ПЛАТНАЯ ГРАНИЦА ЭТИМ НЕ СДВИНУТА. Отсечение по `visibleParagraphs`
  // применяется к тому, что вернулось, и пустой список отсекается в
  // пустой; проглоченный отказ не может показать НИ ОДНОГО лишнего
  // клипа — только меньше. Это отказ в сторону меньшего, ровно как у
  // шапки в `getCurrentUserForChrome` (7.220).
  let audioAssetRows: Array<{ itemKey: string; audioUrl: string; durationSeconds: number | null }> = [];
  try {
    audioAssetRows = await db.audioAsset.findMany({
      where: { contentType: "story", contentId: story.id },
      select: { itemKey: true, audioUrl: true, durationSeconds: true },
    });
  } catch (error) {
    console.error(
      "[stories/[id]] не удалось прочитать клипы озвучки — рассказ отдаётся без проигрывателя",
      error
    );
  }
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
  // Guarded because this is DB content and the story is the product: the
  // offsets only drive per-sentence audio highlighting, so a malformed row
  // must cost the highlighting, not the page. Same class as incident №1 —
  // a value from the database reaching a parser that can throw during
  // render, with the whole page downstream of it. See PROGRESS.md 7.40.
  const sentenceOffsets = parseSentenceOffsets(entitled ? story.sentenceOffsetsJson : null);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: titles.primary,
          // Русское название — второе имя того же объекта, а не другой
          // объект. `alternateName` печатается только когда оно ДРУГОЕ,
          // иначе на `/ru` и у рассказов без испанского названия
          // разметка носила бы одну строку дважды.
          ...(titles.secondary ? { alternateName: titles.secondary } : {}),
          ...(localizedDescription ? { description: localizedDescription } : {}),
          author: { "@type": "Person", name: story.author },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
          inLanguage: "ru",
          datePublished: story.createdAt.toISOString(),
          dateModified: story.updatedAt.toISOString(),
          url: `${SITE_URL}/${lang}/stories/${story.id}`,
          ...paywallJsonLd(entitled, ".paywall-lock"),
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.stories, url: `${SITE_URL}/${lang}/stories` },
          { name: titles.primary, url: `${SITE_URL}/${lang}/stories/${story.id}` },
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
        {/* Тот же один признак, что на карточке в каталоге: значок видит
            только тот, кто не может открыть, и он всегда один. */}
        {storySign && (
          <AccessMark
            mark={storySign.mark}
            label={
              storySign.labelKey === "premiumTierBadge"
                ? dict.access.premiumTierBadge
                : dict.access.subscriptionBadge
            }
          />
        )}
      </div>

      <StoryTitle as="h1" titles={titles} className="mt-3 text-3xl font-semibold tracking-tight" />
      <p className="mt-1 text-foreground/60">
        {dict.stories.byAuthor} {story.author}
      </p>
      {localizedDescription && <p className="mt-3 text-foreground/70">{localizedDescription}</p>}

      {/* КНОПКА «DESCARGAR» — ЗАХОД 7.231 (ОФЛАЙН-3). Стоит НАД текстом,
          а не под ним: человек решает «взять с собой» до чтения, а не
          после. Кнопка сама узнаёт, что уже скачано, и сама отказывает
          закрытому — см. `src/components/DownloadButton.tsx`. */}
      <div className="mt-6">
        <DownloadButton lang={lang} />
      </div>

      <p className="mt-8 text-xs font-medium uppercase tracking-wide text-foreground/40">
        {dict.stories.translationHint}
      </p>
      <div className="mt-3">
        <StoryText
          storyId={entitled ? story.id : null}
          audioStoryId={story.id}
          title={titles.primary}
          author={story.author}
          paragraphs={visibleParagraphs}
          translationParagraphs={visibleTranslationParagraphs}
          audioSegments={audioSegments}
          fullAudioUrl={fullAudioUrl}
          // Аварийный браузерный синтез — только полноправному читателю.
          // В превью читать нечем, кроме настоящих клипов видимого абзаца
          // (они отданы выше): если их нет, органа управления не будет
          // вовсе, а не «будет и заговорит системным голосом» — долг 114.
          sentenceOffsets={sentenceOffsets}
          dict={{
            translationLoading: dict.stories.translationLoading,
            translationError: dict.stories.translationError,
            wordListenLabel: dict.stories.wordListenLabel,
            wordStressDependsOnMeaning: dict.stories.wordStressDependsOnMeaning,
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

      {culturalNote && (
        <CulturalNote heading={dict.stories.culturalNoteHeading} text={culturalNote} />
      )}

      {!entitled && (
        <Card tone="premium" padding="lg" className="paywall-lock mt-10">
          <h2 className="font-medium">
            {needsPremiumUpgrade ? dict.stories.premiumTierLockTitle : dict.stories.premiumLockTitle}
          </h2>
          {/* ДОЛГ 191. Здесь стоял ТЕКСТ замка из словаря, и заход 7.193
              оставил его на месте намеренно — «он говорит, что материал
              закрыт, и это правда». Правда, да не вся: русская редакция
              этой строки читается «Вы видите бесплатный отрывок — первый
              абзац. ОФОРМИТЕ ПОДПИСКУ, чтобы читать историю полностью»,
              испанская — «Suscríbete para leer la historia completa». Это
              призыв к покупке, и внутри оболочки его быть не может.
              Перестроенный прибор нашёл его первым же прогоном: 8
              срабатываний на двух рассказах в двух ролях и двух обличьях.
              Заголовок замка остаётся — он про положение дел. */}
          <p className="mt-2 text-sm text-foreground/70">
            {(await isNativeShellRequest())
              ? nativeLockBody(lang, "story", storySign?.mark === "premium-tier")
              : needsPremiumUpgrade
                ? // Уровень подставляется из строки рассказа, а не вшит в
                  // словарь: замок ставит колонка `premiumOnly`, а не уровень
                  // (`getStoryAccess`), поэтому запертыми оказываются и не-C1
                  // рассказы — 33 из 98 на 09.09.2026 (долг 115). Литерал
                  // «C1» в словаре врал каждому из них подписчику `standard`.
                  dict.stories.premiumTierLockBody.replace("{level}", story.level)
                : dict.stories.premiumLockBody}
          </p>
          {(await isNativeShellRequest()) ? (
            <p className="mt-4 text-sm text-foreground/60">{nativeAccessCopy(lang).closedNote}</p>
          ) : (
            <Link
              href={`/${lang}/pricing?next=/${lang}/stories/${story.id}`}
              className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
            >
              {dict.stories.premiumLockCta}
            </Link>
          )}
        </Card>
      )}

      {insights && (
        <ContentInsights
          lang={lang}
          insights={insights}
          dict={{
            vocabHeading: dict.stories.insightsVocabHeading,
            vocabNote: dict.stories.insightsVocabNote,
            grammarHeading: dict.stories.insightsGrammarHeading,
            grammarNote: dict.stories.insightsGrammarNote,
            exampleLabel: dict.stories.insightsExampleLabel,
            glossaryAllLink: dict.crossLinks.glossaryAllLink,
          }}
        />
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
