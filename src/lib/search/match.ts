import type { Locale } from "@/i18n/config";
import { accessMarkFor, type AccessRequirement } from "@/lib/access-marks";
import { fold, tokenize, tokensAreClose } from "./normalize";
import {
  COLLAPSED_SECTIONS,
  PER_SECTION_LIMIT,
  SEARCH_SECTIONS,
  TOTAL_RESULT_LIMIT,
  type SearchHit,
  type SearchRecord,
  type SearchResponse,
  type SearchSection,
  type SearchSectionResult,
} from "./types";

/**
 * Сопоставление запроса с индексом. Чистая функция: ни базы, ни сети —
 * поэтому её проверяет обычный юнит-тест, которому запрещено открывать
 * соединение (`check:no-db-in-tests`).
 */

/** Разряды совпадения, от лучшего к худшему. Ранжирования у прежнего
 * поиска не было вовсе — порядок выдачи был порядком массива (7.127). */
const SCORE_EXACT = 100;
const SCORE_PREFIX = 80;
const SCORE_SUBSTRING = 60;
const SCORE_TOKENS = 40;
const SCORE_FUZZY = 20;

/** Порядок разделов в выдаче при равном разряде. Первыми — то, ради чего
 * на сайт приходят учиться; страницы и игры замыкают. */
const SECTION_ORDER: Record<SearchSection, number> = {
  page: 0,
  lesson: 1,
  story: 2,
  media: 3,
  flashcard: 4,
  vocabularyTopic: 5,
  idiom: 6,
  glossary: 7,
  grammar: 8,
  alphabet: 9,
  exam: 10,
  game: 11,
};

interface Candidate {
  record: SearchRecord;
  score: number;
}

/** Подпись записи в данной локали. `titleRu` задан только там, где он
 * отличается от общего названия, — см. комментарий в types.ts. */
export function titleOf(record: SearchRecord, lang: Locale): string {
  return (lang === "ru" ? record.titleRu : undefined) ?? record.title;
}

export function subtitleOf(record: SearchRecord, lang: Locale): string | undefined {
  return (lang === "ru" ? record.subtitleRu : undefined) ?? record.subtitle;
}

/** Строки одной записи, по которым ищут в данной локали. */
export function searchableStrings(record: SearchRecord, lang: Locale): string[] {
  return [titleOf(record, lang), subtitleOf(record, lang), ...(record.terms ?? [])].filter(
    (s): s is string => Boolean(s),
  );
}

function scoreStrict(queryFolded: string, queryTokens: string[], haystacks: string[]): number {
  let best = 0;
  for (const raw of haystacks) {
    const folded = fold(raw);
    if (!folded) continue;
    if (folded === queryFolded) return SCORE_EXACT;
    if (folded.startsWith(queryFolded)) best = Math.max(best, SCORE_PREFIX);
    else if (folded.includes(queryFolded)) best = Math.max(best, SCORE_SUBSTRING);
    else if (queryTokens.length > 1) {
      // Слова запроса могут стоять в названии в другом порядке и не
      // подряд: «letras sopa» — это тот же запрос, что «sopa de letras».
      const tokens = tokenize(folded);
      const all = queryTokens.every((q) => tokens.some((t) => t.startsWith(q)));
      if (all) best = Math.max(best, SCORE_TOKENS);
    }
  }
  return best;
}

function scoreFuzzy(queryTokens: string[], haystacks: string[]): number {
  // Запрос без единого слова — это не «похоже на всё», а «сравнивать
  // нечем».
  //
  // Замер на живом проде 06.09.2026 (PROGRESS.md 7.129, часть 1):
  // строка `***` возвращала ВЕСЬ индекс — 10 720 записей, все двенадцать
  // разделов, `fuzzy: true`. Механизм: `tokenize("***")` даёт пустой
  // массив, строгая ступень на нём не находит ничего, а `every` на пустом
  // массиве истинен для любой записи. То есть человек, набравший `?` или
  // `...`, получал 24 случайные строки и подпись «найдено 10 720», а
  // сервер — полный нечёткий проход по всему каталогу на каждый такой
  // ввод.
  if (queryTokens.length === 0) return 0;

  for (const raw of haystacks) {
    const tokens = tokenize(fold(raw));
    if (tokens.length === 0) continue;
    if (queryTokens.every((q) => tokens.some((t) => tokensAreClose(q, t)))) return SCORE_FUZZY;
  }
  return 0;
}

/** Ссылка записи в данной локали, или `null`, если в этой локали её нет. */
export function hrefFor(record: SearchRecord, lang: Locale): string | null {
  if (record.esOnly && lang !== "es") return null;
  const path = lang === "ru" ? (record.pathRu === undefined ? record.path : record.pathRu) : record.path;
  if (path === null) return null;
  return `/${lang}${path}`;
}

export interface SearchOptions {
  lang: Locale;
  /** Уровень доступа посетителя. От него зависит только пометка «нужна
   * подписка» — состав выдачи он не меняет НИКОГДА: поиск, который прячет
   * от неоплатившего сам факт существования рассказа, превращается в
   * «ничего не найдено» на живой объект. */
  tier: "free" | "standard" | "premium";
  /** Куда ведёт свёрнутая строка раздела. */
  collapsedHrefs: Partial<Record<SearchSection, string>>;
  perSectionLimit?: number;
  totalLimit?: number;
}

/**
 * Значок строки выдачи — тем же вызовом, каким его берут каталоги.
 *
 * Своего правила здесь больше нет. Раньше их было два — это и
 * `accessMarkFor` — и различались они не только формой: «значок видит
 * только тот, кто не может открыть» здесь соблюдалось, а вот ЧТО
 * требуется, каждый раздел индекса решал сам (см. types.ts).
 */
function lockOf(
  record: SearchRecord,
  tier: SearchOptions["tier"],
): { locked: boolean; lockReason?: Exclude<AccessRequirement, "free"> } {
  const mark = accessMarkFor(record.requires ?? "free", tier);
  return mark ? { locked: true, lockReason: mark } : { locked: false };
}

export function searchRecords(
  records: readonly SearchRecord[],
  rawQuery: string,
  options: SearchOptions,
): SearchResponse {
  const { lang, tier } = options;
  const perSectionLimit = options.perSectionLimit ?? PER_SECTION_LIMIT;
  const totalLimit = options.totalLimit ?? TOTAL_RESULT_LIMIT;

  const queryFolded = fold(rawQuery);
  const queryTokens = tokenize(queryFolded);
  if (!queryFolded) {
    return { query: rawQuery, total: 0, shown: 0, sections: [], fuzzy: false };
  }

  // Записи, которых в этой локали нет вовсе, отсекаются ДО сопоставления:
  // строка выдачи без адреса — это не результат.
  const visible = records.filter((r) => hrefFor(r, lang) !== null);

  const strict: Candidate[] = [];
  for (const record of visible) {
    const score = scoreStrict(queryFolded, queryTokens, searchableStrings(record, lang));
    if (score > 0) strict.push({ record, score });
  }

  // Нестрогая ступень включается ТОЛЬКО когда строгая не нашла ничего.
  //
  // Иначе она бы дописывала к честной выдаче похожие-но-не-те строки:
  // «comida» нашла бы ещё и «comidas», «comido», «cómoda» — и человек,
  // набравший точное название, получил бы его четвёртым. Цена решения
  // названа прямо: опечатка, у которой ЕСТЬ строгое совпадение хоть у
  // одной записи, исправлена не будет.
  let candidates = strict;
  let fuzzy = false;
  if (candidates.length === 0) {
    const loose: Candidate[] = [];
    for (const record of visible) {
      const score = scoreFuzzy(queryTokens, searchableStrings(record, lang));
      if (score > 0) loose.push({ record, score });
    }
    candidates = loose;
    fuzzy = loose.length > 0;
  }

  const bySection = new Map<SearchSection, Candidate[]>();
  for (const candidate of candidates) {
    const bucket = bySection.get(candidate.record.section);
    if (bucket) bucket.push(candidate);
    else bySection.set(candidate.record.section, [candidate]);
  }

  const sections: SearchSectionResult[] = [];
  let shown = 0;
  let total = 0;

  for (const section of [...SEARCH_SECTIONS].sort((a, b) => SECTION_ORDER[a] - SECTION_ORDER[b])) {
    const bucket = bySection.get(section);
    if (!bucket || bucket.length === 0) continue;
    total += bucket.length;

    // Свёртка — ЛЕКАРСТВО ОТ ВЫТЕСНЕНИЯ, а не свойство раздела, и потому
    // включается по числу совпадений, а не по имени раздела.
    //
    // Что было до 07.09.2026 и почему это чинилось. Условие стояло
    // `COLLAPSED_SECTIONS.includes(section)` — безусловно, сколько бы
    // пазлов ни совпало. Замер на живом проде (PROGRESS.md 7.133, часть 2):
    // восемь запросов, каждый — ПОЛНОЕ название ОДНОГО пазла, совпало 1–2
    // объекта, и все восемь раз выдача отдавала одну свёрнутую строку на
    // `/es|ru/word-games`. То есть у объекта был свой адрес, он лежал в
    // индексе — а поиск уводил в общее меню раздела, ровно как жаловался
    // владелец. Своих адресов это касалось 3277 из 10 720 записей (30,6%).
    //
    // Почему порог именно `perSectionLimit`. Причина свёртки названа в
    // types.ts числом: `sopa de letras` совпадает с 1796 пазлами, и
    // поштучно они вытеснили бы из выдачи все остальные одиннадцать
    // разделов сразу. Раздел, уложившийся в свои пять строк, не вытесняет
    // НИКОГО — бюджет выдачи он тратит ровно тот же, что любой другой
    // раздел. Порог, взятый как «пять» отдельным числом, был бы подгонкой;
    // взятый как «столько, сколько раздел и так печатает», он повторяет
    // уже принятое решение.
    if (COLLAPSED_SECTIONS.includes(section) && bucket.length > perSectionLimit) {
      sections.push({
        section,
        total: bucket.length,
        hits: [],
        collapsed: true,
        collapsedHref: options.collapsedHrefs[section],
      });
      shown += 1;
      continue;
    }

    const room = Math.max(0, totalLimit - shown);
    const take = Math.min(perSectionLimit, room);
    const ordered = [...bucket].sort(
      (a, b) =>
        b.score - a.score ||
        titleOf(a.record, lang).localeCompare(titleOf(b.record, lang), lang),
    );

    const hits: SearchHit[] = ordered.slice(0, take).map((c) => {
      const lock = lockOf(c.record, tier);
      return {
        section,
        id: c.record.id,
        href: hrefFor(c.record, lang)!,
        title: titleOf(c.record, lang),
        subtitle: subtitleOf(c.record, lang),
        ...lock,
      };
    });

    sections.push({ section, total: bucket.length, hits, collapsed: false });
    shown += hits.length;
  }

  return { query: rawQuery, total, shown, sections, fuzzy };
}
