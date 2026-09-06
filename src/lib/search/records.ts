import type { Dictionary } from "@/i18n/dictionaries";
import { levelSlugs, lessonSlugsFor, isFreeTrialLesson, type LevelSlug } from "@/lib/courses";
import { VOCABULARY_CATEGORY_PAGES, PUBLIC_VOCABULARY_LEVELS } from "@/lib/vocabulary-categories";
import { GRAMMAR_GUIDES, GRAMMAR_INDEX_PATH } from "@/lib/gramatica/guides";
import { TOPIC_LANDINGS, landingPath } from "@/lib/word-games/topic-landings";
import { ALPHABET_PAGE_PATH } from "@/lib/alphabet/cyrillic-alphabet";
import { ABOUT_CONTENT } from "@/lib/about-content";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "@/lib/legal/content";
import { puzzleTitle } from "@/lib/word-games/metadata";
import { localizeExamText } from "@/lib/exams/localize";
import type { WordGameType } from "@/lib/word-games/types";
import type { SearchRecord } from "./types";

/**
 * Сборка индекса поиска из уже прочитанного содержимого сайта.
 *
 * Модуль чистый: он ничего не читает сам — ни базы, ни файлов. Всё
 * приходит в `SearchSources`. Так сделано ради двух вещей сразу: юнит-тест
 * собирает индекс из выдуманных пяти строк и проверяет ПРАВИЛА, не
 * открывая соединения (`check:no-db-in-tests`), а сторож
 * `check:search-coverage` собирает его из настоящей базы и проверяет
 * ПОЛНОТУ. Одно и то же место, две разные проверки.
 *
 * Что сюда НЕ попадает ни в каком виде: текст. Ни абзаца рассказа, ни
 * условия упражнения, ни определения термина. Индекс несёт название,
 * раздел и адрес — и это не экономия места, а правило: выдача с цитатой
 * из платного рассказа была бы раздачей платного содержания в окне
 * поиска.
 */

export interface SearchSources {
  dictionaries: Record<"es" | "ru", Dictionary>;
  exams: Array<{ level: string; slug: string; title: string }>;
  stories: Array<{ id: string; title: string; level: string; isPremium: boolean; premiumOnly: boolean }>;
  media: Array<{ id: string; title: string; level: string; free?: boolean }>;
  flashcards: Array<{ id: string; russian: string; translationEs: string; transcription: string; category: string; level: string }>;
  idioms: Array<{ id: string; phrase: string; spanishEquivalent: string; level: string }>;
  glossary: Array<{ slug: string; term: string; russianEquivalent: string }>;
  puzzles: Array<{ type: string; level: string; sequence: number; topic: string | null; wordCount: number; premiumOnly: boolean; curved: boolean }>;
}

const CATEGORY_TO_VOCABULARY_SLUG = new Map(VOCABULARY_CATEGORY_PAGES.map((p) => [p.category as string, p.slug]));
const PUBLIC_LEVELS = new Set<string>(PUBLIC_VOCABULARY_LEVELS);

/** `puzzleTitle` дописывает « | RusoFácilapp» — это для вкладки браузера,
 * не для поиска. */
const BRAND_SUFFIX = " | RusoFácilapp";
function stripBrand(title: string): string {
  return title.endsWith(BRAND_SUFFIX) ? title.slice(0, -BRAND_SUFFIX.length) : title;
}

/**
 * Статические страницы и лендинги.
 *
 * Восемь пунктов меню, по которым поиск умел искать до сих пор, — это
 * первые восемь строк ниже. Они остаются, и намеренно: замер 7.127
 * показал, что `/es/pricing` не находится по своему же заголовку
 * «Planes y precios», потому что подпись в меню — «Precios». Теперь у
 * записи есть и то и другое: подпись меню как заголовок и заголовок
 * страницы в `terms`.
 */
function pageRecords(dict: Record<"es" | "ru", Dictionary>): SearchRecord[] {
  const es = dict.es;
  const ru = dict.ru;

  const records: SearchRecord[] = [
    { section: "page", id: "home", path: "", title: es.nav.home, titleRu: ru.nav.home, terms: [es.meta.title, ru.meta.title] },
    { section: "page", id: "courses", path: "/courses", title: es.nav.courses, titleRu: ru.nav.courses, terms: [es.courses.pageTitle, ru.courses.pageTitle] },
    { section: "page", id: "stories", path: "/stories", title: es.nav.stories, titleRu: ru.nav.stories, terms: [es.stories.pageTitle, ru.stories.pageTitle] },
    { section: "page", id: "media", path: "/media", title: es.nav.media, titleRu: ru.nav.media, terms: [es.media.pageTitle, ru.media.pageTitle] },
    { section: "page", id: "vocabulary", path: "/vocabulary", title: es.nav.vocabulary, titleRu: ru.nav.vocabulary, terms: [es.vocabulary.pageTitle, ru.vocabulary.pageTitle] },
    { section: "page", id: "word-games", path: "/word-games", title: es.nav.wordGames, titleRu: ru.nav.wordGames, terms: [es.wordGames.title, ru.wordGames.title] },
    { section: "page", id: "pricing", path: "/pricing", title: es.nav.pricing, titleRu: ru.nav.pricing, terms: [es.pricing.title, ru.pricing.title] },
    { section: "page", id: "glossary", path: "/glossary", title: es.nav.glossary, titleRu: ru.nav.glossary, terms: [es.glossary.pageTitle, ru.glossary.pageTitle] },

    { section: "page", id: "about", path: "/sobre-nosotros", title: ABOUT_CONTENT.es.title, titleRu: ABOUT_CONTENT.ru.title, terms: [es.nav.about, ru.nav.about] },
    { section: "page", id: "terms", path: "/terms", title: TERMS_CONTENT.es.title, titleRu: TERMS_CONTENT.ru.title },
    { section: "page", id: "privacy", path: "/privacy", title: PRIVACY_CONTENT.es.title, titleRu: PRIVACY_CONTENT.ru.title },

    // Лендинги под испанский поисковый спрос. Русской версии у них нет
    // (см. `notFound()` в каждом page.tsx), поэтому `esOnly`.
    { section: "page", id: "landing-juegos", path: "/juegos-para-aprender-ruso", esOnly: true, title: "Juegos para aprender ruso" },
    { section: "page", id: "landing-sopa", path: "/sopa-de-letras-ruso", esOnly: true, title: "Sopa de letras en ruso" },
    { section: "page", id: "landing-crucigramas", path: "/crucigramas-ruso-principiantes", esOnly: true, title: "Crucigrama de ruso para principiantes" },
    { section: "page", id: "landing-alfabeto-sopa", path: "/sopa-de-letras-alfabeto-cirilico", esOnly: true, title: "Sopa de letras del alfabeto cirílico" },
  ];

  for (const landing of TOPIC_LANDINGS) {
    records.push({
      section: "page",
      id: `landing-${landing.slug}`,
      path: landingPath(landing),
      esOnly: true,
      title: landing.h1,
    });
  }

  // Адрес как строка поиска.
  //
  // Замер 05.09.2026: `pricing` → 0, `glossary` → 0, `word-games` → 0,
  // `/es/stories` → 0 — при том, что все четыре адреса в списке
  // назначений были. Искали только по видимой подписи, и это ровно тот
  // случай, когда человек знает, куда идёт, но набирает не то слово,
  // которым это названо в меню. Три формы, потому что набирают все три.
  for (const record of records) {
    const path = record.path || "/";
    const paths = record.esOnly ? [path, `/es${path}`] : [path, `/es${path}`, `/ru${path}`];
    record.terms = [...(record.terms ?? []), ...paths];
  }

  return records;
}

function lessonRecords(dict: Record<"es" | "ru", Dictionary>): SearchRecord[] {
  const records: SearchRecord[] = [];
  for (const level of levelSlugs) {
    for (const slug of lessonSlugsFor(level)) {
      const index = Number(slug) - 1;
      const titleEs = dict.es.courses.levels[level as LevelSlug].lessons[index];
      const titleRu = dict.ru.courses.levels[level as LevelSlug].lessons[index];
      // Титул может отсутствовать, если словарь короче объявленного числа
      // уроков. Молча подставлять «Урок N» нельзя: это спрятало бы
      // расхождение словаря с courses.ts, которое сторож обязан увидеть.
      if (!titleEs || !titleRu) continue;
      records.push({
        section: "lesson",
        id: `${level}-${slug}`,
        path: `/courses/${level}/${slug}`,
        title: titleEs,
        titleRu,
        subtitle: `${dict.es.lesson.lessonLabel} ${slug} · ${level.toUpperCase()}`,
        subtitleRu: `${dict.ru.lesson.lessonLabel} ${slug} · ${level.toUpperCase()}`,
        // «Lección 1» / «Урок 1» — форма, которой урок называют, а не
        // его содержательное название. Замер 05.09.2026 назвал её
        // отдельной строкой, дававшей ноль. Слово берётся из словаря
        // (`lesson.lessonLabel`), а не вписано сюда по-испански.
        terms: [
          `${dict.es.lesson.lessonLabel} ${slug}`,
          `${dict.ru.lesson.lessonLabel} ${slug}`,
          `${level}${slug}`,
          `${level} ${slug}`,
        ],
        level: level.toUpperCase(),
        // Первый урок каждого уровня открыт целиком; у остальных
        // грамматика видна всем, а упражнения и слайды — по подписке.
        requires: isFreeTrialLesson(level, slug) ? null : "free",
      });
    }
  }
  return records;
}

function examRecords(exams: SearchSources["exams"], dict: Record<"es" | "ru", Dictionary>): SearchRecord[] {
  return exams.map((exam) => {
    // Названия экзаменов написаны по-испански — одно поле на обе локали
    // (PROGRESS.md 7.129, часть 4). Русская подпись собирается из того же
    // шаблона словаря, которым названа испанская, и ТОЛЬКО когда
    // испанская строка этому шаблону отвечает: переименованный через
    // админку экзамен проходит насквозь и остаётся собой.
    const titleRu = localizeExamText(exam.title, "ru", dict.ru.courses.examNames);
    return {
      section: "exam" as const,
      id: `${exam.level}-${exam.slug}`,
      path: `/courses/${exam.level}/exam/${exam.slug}`,
      title: exam.title,
      // `titleRu` задаётся только когда он ДРУГОЙ — общее правило индекса
      // (см. types.ts). Испанское название при этом остаётся строкой
      // поиска и на `/ru`: человек, видевший его на странице курса до
      // этой правки, найдёт экзамен и по нему.
      ...(titleRu === exam.title ? {} : { titleRu, terms: [exam.title] }),
      subtitle: exam.level.toUpperCase(),
      level: exam.level.toUpperCase(),
      requires: "free" as const,
    };
  });
}

function storyRecords(stories: SearchSources["stories"]): SearchRecord[] {
  return stories.map((story) => ({
    section: "story" as const,
    id: story.id,
    path: `/stories/${story.id}`,
    title: story.title,
    subtitle: story.level,
    level: story.level,
    // Ровно то же правило, что применяет сама страница рассказа
    // (getStoryAccess в entitlement.ts), пересказанное не словами, а
    // теми же двумя условиями.
    requires: story.premiumOnly || story.level === "C1" ? "premium" : story.isPremium ? "free" : null,
  }));
}

function mediaRecords(media: SearchSources["media"]): SearchRecord[] {
  return media.map((item) => ({
    section: "media" as const,
    id: item.id,
    path: `/media/${item.id}`,
    title: item.title,
    subtitle: item.level,
    level: item.level,
    requires: item.free ? null : ("free" as const),
  }));
}

function flashcardRecords(cards: SearchSources["flashcards"]): SearchRecord[] {
  return cards.map((card) => {
    const slug = CATEGORY_TO_VOCABULARY_SLUG.get(card.category);
    // Куда ведёт карточка. Своей страницы у карточки нет; ближайшее
    // место, где она напечатана, — тематическая страница словаря, и та
    // существует только по-испански и только для уровней A1–B2 (C1
    // физически отсутствует в её HTML, см. vocabulary-categories.ts).
    // Всё, что под это не подходит, ведёт на сам словарь — туда же, куда
    // человек попал бы, нажав раздел в меню.
    const onTopicPage = slug !== undefined && PUBLIC_LEVELS.has(card.level);
    return {
      section: "flashcard" as const,
      id: card.id,
      path: onTopicPage ? `/vocabulary/${slug}` : "/vocabulary",
      pathRu: "/vocabulary",
      title: `${card.russian} — ${card.translationEs}`,
      subtitle: card.level,
      // Русское слово и испанский перевод уже стоят в подписи, и поиск
      // ищет по ней же — повторять их здесь значило бы удвоить самый
      // большой раздел индекса ради нуля. Транскрипции в подписи нет.
      terms: [card.transcription],
      level: card.level,
      requires: card.level === "C1" ? ("premium" as const) : null,
    };
  });
}

function vocabularyTopicRecords(): SearchRecord[] {
  return VOCABULARY_CATEGORY_PAGES.map((page) => ({
    section: "vocabularyTopic" as const,
    id: page.slug,
    path: `/vocabulary/${page.slug}`,
    esOnly: true,
    title: page.h1,
    terms: [page.slug],
  }));
}

function idiomRecords(idioms: SearchSources["idioms"]): SearchRecord[] {
  return idioms.map((idiom) => ({
    section: "idiom" as const,
    id: idiom.id,
    // Отдельного адреса у идиомы нет ни одного: они живут вкладкой
    // словаря. Ведём на эту вкладку — то есть туда же, куда ведёт сайт
    // сегодня, а не на выдуманный URL.
    path: "/vocabulary?mode=idioms",
    title: idiom.phrase,
    subtitle: idiom.spanishEquivalent,
    level: idiom.level,
    requires: idiom.level === "C1" ? ("premium" as const) : null,
  }));
}

function glossaryRecords(terms: SearchSources["glossary"]): SearchRecord[] {
  return terms.map((term) => ({
    section: "glossary" as const,
    id: term.slug,
    path: `/glossary/${term.slug}`,
    title: term.term,
    subtitle: term.russianEquivalent,
  }));
}

function grammarRecords(): SearchRecord[] {
  const records: SearchRecord[] = [
    {
      section: "grammar",
      id: "gramatica",
      path: GRAMMAR_INDEX_PATH,
      esOnly: true,
      title: "Gramática rusa explicada en español",
    },
  ];
  for (const guide of GRAMMAR_GUIDES) {
    records.push({
      section: "grammar",
      // `href` гидов записан с префиксом локали (`/es/gramatica/...`),
      // а индекс хранит путь без него — иначе адрес собрался бы как
      // `/es/es/gramatica/...`.
      id: guide.href.replace(/^\/es/, ""),
      path: guide.href.replace(/^\/es/, ""),
      esOnly: true,
      title: guide.title,
      // Заголовок самой страницы гида: в индексе гид назван короче, чем на
      // своей странице, и человек ищет то, что видел.
      terms: [guide.pageTitle],
    });
  }
  return records;
}

function alphabetRecords(): SearchRecord[] {
  return [
    {
      section: "alphabet",
      id: "alfabeto-cirilico",
      path: ALPHABET_PAGE_PATH,
      esOnly: true,
      title: "El alfabeto cirílico: las 33 letras rusas con sonido y ejemplos",
      terms: ["alfabeto", "cirílico", "кириллица", "алфавит"],
    },
  ];
}

function gameRecords(puzzles: SearchSources["puzzles"]): SearchRecord[] {
  return puzzles.map((puzzle) => {
    const type = puzzle.type as WordGameType;
    return {
      section: "game" as const,
      id: `${puzzle.type}/${puzzle.level}/${puzzle.sequence}`,
      path: `/word-games/${puzzle.type}/${puzzle.level}/${puzzle.sequence}`,
      // Названия берутся ровно у той функции, которой титулуются сами
      // страницы пазлов, — иначе поиск искал бы по строке, которой на
      // странице нет.
      // Приставка бренда снимается: она стоит в конце каждого из 3277
      // названий, ищут по ней ноль раз, а весит она 92 КБ блоба.
      title: stripBrand(puzzleTitle("es", type, puzzle.level, puzzle.sequence, puzzle.wordCount, puzzle.topic)),
      titleRu: stripBrand(puzzleTitle("ru", type, puzzle.level, puzzle.sequence, puzzle.wordCount, puzzle.topic)),
      level: puzzle.level,
      requires: puzzle.premiumOnly || puzzle.curved ? ("premium" as const) : null,
    };
  });
}

/** Весь индекс, одним массивом. Порядок разделов здесь ни на что не
 * влияет — порядок выдачи задаёт match.ts. */
export function buildSearchRecords(sources: SearchSources): SearchRecord[] {
  return [
    ...pageRecords(sources.dictionaries),
    ...lessonRecords(sources.dictionaries),
    ...examRecords(sources.exams, sources.dictionaries),
    ...storyRecords(sources.stories),
    ...mediaRecords(sources.media),
    ...flashcardRecords(sources.flashcards),
    ...vocabularyTopicRecords(),
    ...idiomRecords(sources.idioms),
    ...glossaryRecords(sources.glossary),
    ...grammarRecords(),
    ...alphabetRecords(),
    ...gameRecords(sources.puzzles),
  ];
}
