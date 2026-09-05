import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { levelSlugs, lessonSlugsFor } from "@/lib/courses";
import { flashcardLevels } from "@/lib/flashcards/types";
import { freeSequencesFor, freeWordGameWhere } from "@/lib/word-games/free-tier";
import { db } from "@/lib/db";
import { getAllMedia } from "@/lib/media/data";
import { SITE_URL } from "@/lib/site";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";

import {
  FREE_INDEX_PATHS_ES_ONLY,
  FREE_INDEX_PATHS_EVERY_LOCALE,
  freeIndexLastModified,
} from "@/lib/word-games/free-index";
import { TOPIC_LANDINGS, TOPIC_LANDING_PATHS, landingPath } from "@/lib/word-games/topic-landings";
import { isFrozenStory } from "@/lib/story-pilot";
import { PUBLIC_VOCABULARY_LEVELS } from "@/lib/vocabulary-categories";
import { lastModifiedField, latestLastModified, rowLastModified } from "@/lib/sitemap-lastmod";

// Next.js Metadata Route convention — served automatically at /sitemap.xml,
// same pattern as manifest.ts/robots.ts. Lives outside `[lang]` so it isn't
// subject to locale-prefix redirecting (see proxy.ts's matcher).
//
// Forced dynamic (rendered per-request, never at build time): without this,
// Next.js treats sitemap.ts as static-by-default (no Request-time API used
// inside it) and tries to pre-render /sitemap.xml during `next build` —
// which runs with no TURSO_DATABASE_URL on Vercel (see
// prisma/ensure-schema-sync.ts's own build-time skip for the same reason),
// so db.story.findMany() below hit a real prod deploy failure: "no such
// table: main.Story" against the empty local build-time SQLite fallback.
// The production database is only ever reachable at request time, not
// build time, in this project's setup.
export const dynamic = "force-dynamic";
//
// Also: only lists routes a signed-out visitor (and so a crawler) can actually
// read: static public pages, all stories (non-premium ones show the full
// text, premium ones show a snippet + paywall — both are legitimate
// indexable pages), all media items (same free/gated split), the course
// level listings, and — since 2026-08-28 — every individual lesson page:
// each one now shows its real grammar explanation to every visitor
// regardless of subscription (only vocabulary/exercises/slides are
// locked, see [lesson]/page.tsx), so all 120 are genuine, indexable pages
// now, not just each level's lesson 1. Milestone exams are NOT listed —
// those still redirect an anonymous visitor to /pricing with no
// free-content exception worth indexing.
//
// The free word-game puzzles (see freeSequencesFor in word-games/free-tier.ts,
// which is the same rule the paywall applies) ARE listed, also since
// 2026-08-28 — they don't redirect, but the
// /word-games picker only server-renders links for whichever (type, level)
// tab is selected by default (a client-side "use client" picker — see its
// own comment), so 7 of the 8 (type, level) combinations among the free
// puzzles have no other discoverable path at all without this.
//
// The 3 game landing pages (/sopa-de-letras-ruso, etc. — see their own
// page.tsx files) are Spanish-search-intent pages with no Russian
// equivalent query behavior, so they're only listed for "es", not looped
// over `locales` like everything else here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "",
    "/pricing",
    "/stories",
    "/media",
    "/courses",
    "/word-games",
    "/glossary",
    "/vocabulary",
    "/sobre-nosotros",
    // Added 31.08.2026. These were the inconsistency a link crawl found
    // that a sitemap crawl could not: robots.txt allows them, the footer
    // links to them from every page, they render real content and carry
    // their own title and description — but they were absent here, so the
    // sitemap disagreed with the site about what is public. Legal pages
    // are also a standard trust signal for a site that takes payments, so
    // the resolution is to list them rather than to disallow them.
    //
    // /download is deliberately NOT here: it is noindex until the app is
    // actually in a store (see its own generateMetadata).
    "/terms",
    "/privacy",
  ];

  // Spanish-search-intent landing pages — no Russian-language equivalent
  // query behavior expected, so "es" only (see [lang]!=="es" -> notFound()
  // in each page.tsx).
  const esOnlyPaths = [
    "/sopa-de-letras-ruso",
    "/crucigramas-ruso-principiantes",
    "/sopa-de-letras-alfabeto-cirilico",
    "/juegos-para-aprender-ruso",
    // Grammar guides + their index. Same ES-only reasoning as above:
    // these explain Russian grammar BY comparing it to Spanish, so a
    // Russian-interface copy would be the same Spanish text twice.
    "/gramatica",
    "/gramatica/alfabeto-ruso",
    "/gramatica/genero-sustantivos-ruso",
    "/gramatica/plural-sustantivos-ruso",
    "/gramatica/verbos-reflexivos-ruso",
    // The six themed sopa-de-letras landings (02.09.2026). Taken from the
    // table rather than retyped, so adding a seventh cannot leave it out
    // of the map — the crawlable-surface test enumerates the same routes
    // from the filesystem and would fail if the two ever disagreed.
    ...TOPIC_LANDING_PATHS,
  ];

  // `lastModified` on the puzzle URLs, and only where it is a REAL date.
  //
  // Why this matters here more than anywhere else: on 02.09.2026 the 80
  // free puzzles were regenerated and 138 of their URLs changed title and
  // content. Search Console's manual "request indexing" is capped at ~10
  // URLs a day, so a 138-URL queue is not a mechanism. The sitemap is —
  // but only if it says when each URL actually changed. Before this
  // change the file emitted no lastmod at all, so nothing told a crawler
  // that anything had moved.
  //
  // The date comes from the row's own `updatedAt`, which Prisma stamps on
  // every write (see schema.prisma). Rows written before that column
  // existed have no date and are emitted WITHOUT lastmod rather than with
  // a fallback: a made-up date on an unchanged URL is worse than silence,
  // because a sitemap whose lastmod is not trustworthy gets its lastmod
  // ignored wholesale.
  // Wrapped, and deliberately so. On 29.08.2026 this exact select brought
  // the WHOLE sitemap down with a 500 in production: `updatedAt` was in
  // schema.prisma but not in the database, because ensure-schema-sync.ts
  // could not see the field (its model parser stopped at the first "}" in
  // a comment — fixed, with a test, in prisma/ensure-schema-sync.ts).
  //
  // A sitemap that 500s is invisible to every crawler, which is a far
  // worse outcome than a sitemap without lastmod. So a failure to read the
  // dates degrades this file to the state it was in before lastmod existed
  // instead of taking it off the air. The error is logged rather than
  // swallowed, because silently serving a sitemap with no dates for weeks
  // is its own kind of failure.
  let puzzleLastMod = new Map<string, Date | undefined>();
  let puzzleRows: Array<{
    type: string;
    level: string;
    sequence: number;
    topic: string | null;
    updatedAt: Date | null;
    createdAt: Date;
  }> = [];
  try {
    puzzleRows = await db.wordGamePuzzle.findMany({
      // Заведомо надмножество бесплатных: точный ответ даёт
      // freeSequencesFor ниже, а не этот запрос (free-tier.ts).
      where: freeWordGameWhere(),
      // `createdAt` читается ради 18 URL, у которых `<lastmod>` не было:
      // девять строк банка написаны до того, как колонка `updatedAt`
      // появилась (29.08.2026), и молчали не потому, что даты нет, а
      // потому, что она лежит в соседнем столбце. Правило подстановки и
      // доказательство, что она не выдуманная — в sitemap-lastmod.ts.
      // `topic` — ради шести тематических лендингов ниже.
      select: { type: true, level: true, sequence: true, topic: true, updatedAt: true, createdAt: true },
    });
    puzzleLastMod = new Map(
      puzzleRows.map((r) => [`${r.type}/${r.level}/${r.sequence}`, rowLastModified(r)]),
    );
  } catch (error) {
    console.error("[sitemap] could not read WordGamePuzzle.updatedAt; serving without lastmod", error);
  }

  // Страницы-источники бесплатного индекса получают ту же дату.
  //
  // Замер на живом проде 05.09.2026: все 166 бесплатных игровых URL стоят
  // в этом файле, разрешены robots.txt и имеют входящую ссылку из
  // СЕРВЕРНОГО HTML — недостижимых 0, глубина от корня локали 2. Но 73 из
  // 83 рунгов каждой локали висят ровно на одной странице-источнике
  // (пикер клиентский и печатает только пару по умолчанию — на
  // /es/word-games это 198 ссылок из 281, остальные 83 даёт
  // FreePuzzleIndex), и у этих страниц `<lastmod>` не было НИ ОДНОГО.
  // Набор бесплатных рунгов менялся 04.09: HTML всех трёх источников
  // изменился, sitemap промолчал. Переобход страницы-пазла зовут два
  // рычага — её собственная дата и ребро, которое к ней ведёт; второй
  // рычаг был выключен.
  //
  // Дата настоящая: самая поздняя `updatedAt` среди строк, которые
  // ПРАВИЛО зовёт бесплатными, а не среди всех прочитанных (запрос —
  // надмножество). Не прочиталось — `undefined`, и записи `<lastmod>` не
  // будет вовсе, ровно как у самих пазлов.
  const freeIndexLastMod = freeIndexLastModified(puzzleRows);

  // Дата шести тематических лендингов `/es/sopa-de-letras-ruso-<тема>`:
  // самая поздняя среди строк ИМЕННО ЭТОЙ темы. Тот же приём, что у
  // страниц-источников выше, и по той же причине — страница печатает эти
  // строки, значит меняется вместе с ними. Три общих лендинга
  // (`/es/sopa-de-letras-ruso`, `/es/crucigramas-ruso-principiantes`,
  // `/es/sopa-de-letras-alfabeto-cirilico`) сюда НЕ входят: у первых двух
  // встроен один жёстко выбранный пазл, не связанный с тем, что страница
  // обещает, а у третьего сетка вообще лежит константой в коде
  // (alphabetShowcasePuzzle.ts) и даты не имеет ни в каком столбце.
  const topicLastMod = new Map<string, Date | undefined>();
  for (const landing of TOPIC_LANDINGS) {
    topicLastMod.set(
      landingPath(landing),
      latestLastModified(puzzleRows.filter((row) => row.topic === landing.topic)),
    );
  }

  // Обёрнуто по тому же правилу, что и чтение пазлов выше, и добавлено
  // 29.08.2026 после того, как аудит нашёл: из трёх обращений к базе в
  // этом файле защищено было ОДНО. Отказ здесь стоил всей карты; теперь
  // он стоит URL этого семейства, а не 1912.
  let stories: { id: string; title: string; level: string; updatedAt: Date }[] = [];
  try {
    stories = await db.story.findMany({ select: { id: true, title: true, level: true, updatedAt: true } });
  } catch (error) {
    console.error("[sitemap] could not read Story; serving without story URLs", error);
  }

  // Обёрнуто тоже, 29.08.2026, и это был самый острый из оставшихся
  // краёв: запрос выбирает `updatedAt` — ровно ту колонку, чьё
  // отсутствие когда-то и уронило карту.
  let glossaryTerms: { slug: string; updatedAt: Date }[] = [];
  try {
    glossaryTerms = await db.glossaryTerm.findMany({ select: { slug: true, updatedAt: true } });
  } catch (error) {
    console.error("[sitemap] could not read GlossaryTerm; serving without glossary URLs", error);
  }

  // Даты двух страниц-каталогов. Каталог перечисляет строки, поэтому
  // меняется вместе с ними — это тот же признак, что у страниц-источников
  // бесплатного индекса, и та же функция его считает.
  //
  // Замороженные рассказы дату каталога двигать МОГУТ и это не нарушение:
  // трогать нельзя замороженную страницу, а `/es/stories` в эксперименте
  // не участвует ни одной стороной. На практике двинуть её они и не могут
  // — в них по определению никто не пишет до 25.09.
  //
  // `/media` и `/vocabulary` сюда не входят, и по разным причинам:
  // у медиа нет честной даты ни у одного элемента (см. ниже), а
  // `/vocabulary` — клиентский пикер категорий, в его серверном HTML нет
  // ни одной карточки, так что дата карточек к нему отношения не имеет.
  const catalogLastMod = new Map<string, Date | undefined>([
    ["/stories", latestLastModified(stories)],
    ["/glossary", latestLastModified(glossaryTerms)],
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    const isFreeIndexPage = (FREE_INDEX_PATHS_EVERY_LOCALE as readonly string[]).includes(path);
    for (const lang of locales) {
      entries.push({
        url: `${SITE_URL}/${lang}${path}`,
        changeFrequency: "weekly",
        ...lastModifiedField(isFreeIndexPage ? freeIndexLastMod : catalogLastMod.get(path)),
      });
    }
  }

  for (const path of esOnlyPaths) {
    const isFreeIndexPage = (FREE_INDEX_PATHS_ES_ONLY as readonly string[]).includes(path);
    entries.push({
      url: `${SITE_URL}/es${path}`,
      changeFrequency: "monthly",
      ...lastModifiedField(isFreeIndexPage ? freeIndexLastMod : topicLastMod.get(path)),
    });
  }

  // The 23 per-theme vocabulary pages, ES-only for the same reason as the
  // grammar guides above. Taken from the list rather than hardcoded as a
  // count, so adding a category can't leave its page out of the map. They
  // publish A1-B2 cards only; C1 stays paywalled in full, which is a
  // property of the page, not of this listing.
  // `lastmod` у 23 страниц категорий: самая поздняя `updatedAt` среди
  // карточек, которые страница ПЕЧАТАЕТ, — своей категории и только
  // публичных уровней. C1 в счёт не идёт по той же причине, по которой
  // его нет в HTML: этих карточек на странице физически нет, и правка
  // C1-карточки страницу не меняет. Фильтр берётся из
  // PUBLIC_VOCABULARY_LEVELS, того же списка, что и у самой страницы, —
  // не из пересказа «A1..B2».
  //
  // Встроенный блок тематических пазлов дату не двигает намеренно: он
  // необязателен (пустой список = блока нет), а его строки уже датируют
  // и свои URL, и лендинг темы.
  let vocabularyLastMod = new Map<string, Date | null>();
  try {
    const grouped = await db.flashcardCard.groupBy({
      by: ["category"],
      where: { level: { in: [...PUBLIC_VOCABULARY_LEVELS] } },
      _max: { updatedAt: true },
    });
    vocabularyLastMod = new Map(grouped.map((g) => [g.category, g._max.updatedAt]));
  } catch (error) {
    console.error("[sitemap] could not read FlashcardCard.updatedAt; serving vocabulary URLs without lastmod", error);
  }
  for (const page of VOCABULARY_CATEGORY_PAGES) {
    entries.push({
      url: `${SITE_URL}/es/vocabulary/${page.slug}`,
      changeFrequency: "weekly",
      ...lastModifiedField(vocabularyLastMod.get(page.category) ?? undefined),
    });
  }

  // Уровни НЕ фильтруются по C1, и номера не считаются от 1 до предела:
  // и то и другое — пересказ правила бесплатности своими словами, а
  // правило живёт в free-tier.ts и умеет отвечать за себя само. C1 даёт
  // пустой список, и цикл по нему просто ничего не кладёт.
  for (const level of flashcardLevels) {
    for (const type of ["WORD_SEARCH", "CROSSWORD"] as const) {
      for (const sequence of freeSequencesFor(type, level)) {
        const lastMod = puzzleLastMod.get(`${type}/${level}/${sequence}`);
        for (const lang of locales) {
          entries.push({
            url: `${SITE_URL}/${lang}/word-games/${type}/${level}/${sequence}`,
            changeFrequency: "yearly",
            ...lastModifiedField(lastMod),
          });
        }
      }
    }
  }

  for (const level of levelSlugs) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/courses/${level}`, changeFrequency: "monthly" });
    }
  }

  // `lastmod` у 240 страниц уроков — там, где у урока есть строка.
  //
  // Источник назван точно, потому что их два и они не равны. Страница
  // урока читает `getLessonContent` (lessons/content.ts): сперва строку
  // `Lesson`, и только если её нет — статический `content.json`, который
  // лежит рядом с кодом и даты на запись не имеет. Значит честная дата
  // есть ровно у тех уроков, у кого есть строка, и её отсутствие — это
  // «содержимое пришло из файла», а не «дата потерялась».
  //
  // Отсюда и форма: не «у всех 240», а «у скольких нашлась строка».
  // Локально это 120 из 120 слотов; сколько на проде — скажет карта
  // сайта после выката, и никакая подстановка этого не подменяет.
  //
  // Обёрнуто по тому же правилу, что и остальные три чтения файла: отказ
  // стоит дат у этого семейства, а не 1912 URL.
  let lessonLastMod = new Map<string, Date>();
  try {
    const lessonRows = await db.lesson.findMany({
      select: { level: true, lessonSlug: true, updatedAt: true },
    });
    lessonLastMod = new Map(lessonRows.map((r) => [`${r.level}/${r.lessonSlug}`, r.updatedAt]));
  } catch (error) {
    console.error("[sitemap] could not read Lesson.updatedAt; serving lesson URLs without lastmod", error);
  }

  for (const level of levelSlugs) {
    for (const lessonSlug of lessonSlugsFor(level)) {
      const lastMod = lessonLastMod.get(`${level}/${lessonSlug}`);
      for (const lang of locales) {
        entries.push({
          url: `${SITE_URL}/${lang}/courses/${level}/${lessonSlug}`,
          changeFrequency: "monthly",
          ...lastModifiedField(lastMod),
        });
      }
    }
  }

  // `lastmod` у рассказов: у всех, КРОМЕ 65 замороженных.
  //
  // Было (29.08–05.09.2026): поля не было ни у одного из 650 URL, и
  // формулировка звучала как «рассказы не получают дату до 25.09». Это
  // больше, чем требует заморозка. `lastmod` — сигнал переобхода, и
  // трогать им измеряемую группу нельзя; но измеряемая группа — это
  // ровно 65 рассказов (50 пилот + 15 контроль, и то и другое внутри
  // заморозки, см. PROGRESS.md «ЭКСПЕРИМЕНТЫ»), то есть 130 URL из 650.
  // Остальные 520 в эксперименте не участвуют ни одной стороной, их
  // частота обхода ничего не измеряет, и молчали они не по правилу
  // заморозки, а заодно.
  //
  // Принадлежность спрашивается у кода, а не у списка: `isFrozenStory`
  // — та же функция, которой пользуются сами страницы рассказов, и она
  // покрывает обе группы. Ни один замороженный URL от этой правки не
  // получает поля; проверка — сверка «до/после» и check:frozen.
  //
  // Снимается это 25.09.2026 удалением одной ветки — вместе с остальными
  // пунктами очереди на снятие заморозки.
  for (const story of stories) {
    const frozen = isFrozenStory(story);
    for (const lang of locales) {
      entries.push({
        url: `${SITE_URL}/${lang}/stories/${story.id}`,
        changeFrequency: "monthly",
        ...lastModifiedField(frozen ? undefined : story.updatedAt),
      });
    }
  }

  // Медиа — единственное семейство карты, у которого честной даты нет
  // НИ У ОДНОГО из 550 URL, и это не упущение, а свойство хранилища.
  // Каталог (заголовок, описание, лексика, упражнения) лежит в
  // `src/lib/media/mediaData.json` рядом с кодом и колонки с датой не
  // имеет вовсе. Единственная дата поблизости — `MediaOverride.updatedAt`,
  // и она не про содержимое: `saveEmbedStatuses` переписывает
  // `embedStatus`/`lastCheckedAt` пачкой по всему каталогу при каждой
  // автоматической проверке встраивания, ничего не меняя на странице.
  // Замер по локальной копии: 233 строки на двух соседних датах,
  // 120 и 113 — след двух прогонов проверки, а не 233 правок.
  // Такой `lastmod` обещал бы свежесть, которой нет, — а это ровно то,
  // из-за чего краулер перестаёт верить всей карте.
  //
  // Дата появится, когда появится источник: колонка на самом элементе
  // (правка схемы + перенос JSON в базу) — отдельная работа, названа
  // числом в отчёте, здесь не делается.
  const media = await getAllMedia();
  for (const item of media) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/media/${item.id}`, changeFrequency: "monthly" });
    }
  }

  // Same query shape as glossary/[slug]/page.tsx's generateStaticParams —
  // deliberately not a hardcoded count, so this always matches whatever's
  // actually in the DB (which is also what generateStaticParams pre-renders
  // from at build time) rather than drifting from it.
  // Glossary terms are not part of the experiment, carry a real
  // `updatedAt`, and are edited one at a time — so their dates differ per
  // row and are a genuine signal rather than one batch timestamp.
  //
  for (const term of glossaryTerms) {
    for (const lang of locales) {
      entries.push({
        url: `${SITE_URL}/${lang}/glossary/${term.slug}`,
        changeFrequency: "yearly",
        lastModified: term.updatedAt,
      });
    }
  }

  return entries;
}
