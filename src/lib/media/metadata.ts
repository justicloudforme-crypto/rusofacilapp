import { shortenTitle, truncateForMeta } from "@/lib/site";

/**
 * The meta description for one media page.
 *
 * Why the Russian side needed its own builder. Measured on the live site
 * 30.08.2026: all 275 /ru media pages shared FIVE descriptions between
 * them — the text was one sentence with only the level substituted in, so
 * 70 pages could carry the identical string. The Spanish side already had
 * `item.description`, hand-written per item. Naming the item in the Russian
 * sentence makes each page describe itself, and the titles are unique, so
 * the descriptions are too.
 *
 * Pure and exported so the test can check it against the real
 * mediaData.json rather than against a copy of this logic.
 */
const KIND_RU: Record<string, string> = {
  song: "песня",
  movie: "фильм",
  video: "видео",
  grammar: "видеоурок грамматики",
};

/** Leaves room for the fixed part of the Russian sentence below inside the
 * 155 characters Google shows; the longest media title is 112. */
const TITLE_BUDGET = 60;

export function mediaDescription(
  lang: string,
  item: { title: string; level: string; category: string; description: string },
): string {
  if (lang !== "ru") return truncateForMeta(item.description);
  const kind = KIND_RU[item.category] ?? "видео";
  return truncateForMeta(
    `«${shortenTitle(mediaTitle(lang, item.title), TITLE_BUDGET)}» — ${kind} уровня ${item.level} с субтитрами, разбором лексики и упражнениями.`,
  );
}

/**
 * `description` разметки `LearningResource` (application/ld+json) — ЗАХОД
 * 7.276, решение владельца 18.10.2026.
 *
 * До 7.276 в разметке на обеих локалях стоял `item.description` — абзац,
 * написанный по-испански для каждой записи. Мета-описание `/ru` русское с
 * 30.08.2026 (`mediaDescription`), а разметка той же страницы говорила
 * по-испански: замер 7.275 на проде — 20 из 20. Теперь на `/ru` это ровно
 * та же строка, что в `<meta name="description">`: одна страница — одно
 * описание, как у рассказов с 7.275 (`storyArticleDescription`). На `/es`
 * не изменилось ничего: полный испанский абзац, как и был.
 */
export function mediaJsonLdDescription(
  lang: string,
  item: { title: string; level: string; category: string; description: string },
): string {
  return lang === "ru" ? mediaDescription(lang, item) : item.description;
}

/**
 * ВИДИМЫЙ АБЗАЦ ПОД ЗАГОЛОВКОМ МЕДИА — ЗАХОД 7.277, решение владельца
 * 19.10.2026 (вариант «а» раздела 7 после 7.276).
 *
 * `item.description` написан по-испански для каждой записи, и до 7.277 он
 * печатался под русским заголовком и на `/ru` — тот же класс, что у
 * рассказов до 7.275 (`storyVisibleDescription`, долг 204). Теперь на `/ru`
 * абзаца нет: русского абзаца у записей медиа нет ни у одной, а выдумывать
 * его отрисовкой нельзя. На `/es` — испанский абзац записи, как и был
 * (у `history-gagarin` и `video-saludos-presentaciones` он и на `/es` не
 * испанский — их не трогаем, решение владельца).
 */
export function mediaVisibleDescription(lang: string, item: { description: string }): string | null {
  return lang === "ru" ? null : item.description || null;
}

/**
 * НАЗВАНИЕ ЗАПИСИ МЕДИА НА ЯЗЫКЕ СТРАНИЦЫ — ЗАХОД 7.279, решение владельца
 * 19.10.2026 (вариант «б» раздела 7 после 7.278).
 *
 * У части русских названий в `mediaData.json` в конце стоит испанская
 * пояснительная скобка — «Катюша (canción folclórica)». На `/es` она к месту,
 * на `/ru` это испанский хвост под русским названием (замер 7.278: 35 из 275
 * названий с испанской скобкой где-либо). Данные не меняются: скобку снимает
 * отрисовка, одно правило на все места `/ru`, где видно название (каталог,
 * список ссылок, страница записи, `<title>`, ld+json, мета-описание, блоки
 * «похожее» у рассказов и уроков, поиск).
 *
 * Что снимается. Только ПОСЛЕДНЯЯ скобка в конце названия, и только у
 * русского названия (вне скобки есть кириллица): целиком испанские названия
 * («Los casos rusos explicados en español (nominativo y acusativo)», их 54)
 * владелец решает отдельно — их правило не трогает. Скобка делится по
 * запятым; испанская часть (латиницы больше, чем кириллицы) уходит, остальное
 * остаётся: «(estrada clásica, 1982)» → «(1982)», как у соседних «(1982)».
 * Русские скобки («(1975, Юрий Норштейн)») и скобки внутри названия не
 * трогаются. На `/es` — название как есть.
 */
export function mediaTitle(lang: string, title: string): string {
  if (lang !== "ru") return title;
  const tail = /^(.*\S)\s*\(([^()]*)\)\s*$/u.exec(title);
  if (!tail || !/\p{Script=Cyrillic}/u.test(tail[1])) return title;
  const parts = tail[2].split(",").map((part) => part.trim());
  const kept = parts.filter((part) => !isSpanishPart(part));
  if (kept.length === parts.length) return title;
  return kept.length ? `${tail[1]} (${kept.join(", ")})` : tail[1];
}

function isSpanishPart(text: string): boolean {
  const latin = (text.match(/\p{Script=Latin}/gu) ?? []).length;
  const cyrillic = (text.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  return latin > cyrillic;
}

/** What the page served before 30.08.2026. Frozen media pages must keep
 * serving exactly this until the 25.09 readout, so it lives here next to
 * its replacement rather than inline in the page, where the two could
 * drift apart unnoticed. */
export function frozenMediaDescription(
  lang: string,
  item: { level: string; description: string },
): string {
  return lang === "ru"
    ? `Изучайте русский язык через видео и музыку с субтитрами и упражнениями, уровень ${item.level}, в RusoFácilapp.`
    : item.description;
}
