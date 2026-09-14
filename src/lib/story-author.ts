import type { Locale } from "@/i18n/config";

/**
 * `Story.author` is one column serving two locales, and on `/es` it was
 * showing through in Russian.
 *
 * Reported from a phone on production, 30.08.2026: the story card on the
 * Spanish home page and every card in `/es/stories` read
 * «Por Русская народная сказка» — a Spanish preposition welded to a
 * Russian genre label, inside a card whose heading, description and CTA
 * were all Spanish. Worth being precise about the cause, because the three
 * usual suspects were all innocent: `es.json` has no missing key (the two
 * dictionaries have identical key sets, and `es.json` contains no Cyrillic
 * at all), no component hard-codes the string, and locale detection is
 * fine. The Russian is DATA — one column read verbatim in both locales.
 *
 * What this maps, and what it deliberately does not:
 *
 *   - genre labels («Русская народная сказка») and the qualifiers that
 *     ride along with them («(пересказ)», «(обработка)») — these are
 *     interface text that happens to live in a data column, and they are
 *     what makes the card read as half-translated;
 *   - the classic authors' names, transliterated the way a Spanish
 *     publisher writes them (Чехов → Chéjov). A name is not interface
 *     text, but leaving twelve Cyrillic names in an otherwise Spanish
 *     column would just move the seam rather than close it;
 *   - "RusoFásil (relato original)" is already Spanish and is left exactly
 *     as it is — it is the marker the project's own originals are
 *     identified by.
 *
 * Anything not in the table passes through unchanged. That matters more
 * than completeness: this table was built from the values actually present
 * (20 distinct `Story.author` values), and production can hold a value
 * this copy has never seen. An unknown author must render as itself, not
 * as a blank or a guess.
 */

/**
 * ОПЕЧАТКА В ИМЕНИ ПРОЕКТА ВНУТРИ ЗНАЧЕНИЯ ДАННЫХ — долг 182.
 *
 * В боевой колонке `Story.author` у 277 рассказов стоит
 * «RusoFásil (relato original)» — через `s`. Бренд пишется «RusoFácil»
 * (и `npm run check:brand` ловит любое другое написание во всём
 * репозитории; это значение — одно из пяти закреплённых исключений,
 * потому что оно КОПИЯ прода, а не наш текст). Владелец увидел опечатку
 * на карточках рассказов в приложении 13.09.2026.
 *
 * Чинится ОТРИСОВКОЙ, а не записью в базу, по двум причинам сразу.
 * Первая: записей в боевую базу в этом заходе нет ни одной. Вторая, и
 * она важнее: то же значение печатается на 130 замороженных страницах
 * рассказов, которые нельзя менять до 25.09.2026, — а через эту функцию
 * проходят ровно две поверхности, и ни одна из них не заморожена (главная
 * и каталог `/stories`; страница самого рассказа автора отсюда не берёт).
 * Замерено, а не предположено: в `docs/frozen-baseline-2026-08-30.json`
 * неверное написание встречается в сличаемых полях 0 раз из 330.
 *
 * Правка НЕ трогает разбор ниже: нормализуется только написание имени, а
 * дальше строка идёт по тем же таблицам, что и раньше.
 */
const BRAND_TYPO = /RusoF[áa]sil/g;
const BRAND = "RusoFácil";

/** Единственное место, где опечатка в имени проекта исправляется в
 *  значении данных. Ни локаль, ни таблицы ниже на это не влияют: имя
 *  пишется одинаково по-испански и по-русски. */
function fixBrandSpelling(author: string): string {
  return author.replace(BRAND_TYPO, BRAND);
}

/** Whole-value matches, tried first. */
const WHOLE: Record<string, string> = {
  "Русская народная сказка": "Cuento popular ruso",
  "Русская народная сказка (обработка)": "Cuento popular ruso (adaptación)",
};

/** Personal names, matched against the part before any qualifier. */
const NAMES: Record<string, string> = {
  "А.П. Чехов": "A. P. Chéjov",
  "Л.Н. Толстой": "L. N. Tolstói",
  "А.С. Пушкин": "A. S. Pushkin",
  "И.А. Крылов": "I. A. Krylov",
  "Н.В. Гоголь": "N. V. Gógol",
  "И.С. Тургенев": "I. S. Turguénev",
  "И.А. Бунин": "I. A. Bunin",
  "А.И. Куприн": "A. I. Kuprín",
  "Н.С. Лесков": "N. S. Leskov",
  "М.Е. Салтыков-Щедрин": "M. E. Saltykov-Shchedrín",
  "М. Горький": "M. Gorki",
};

/** Trailing qualifiers, e.g. "А.П. Чехов (пересказ)". */
const QUALIFIERS: Record<string, string> = {
  пересказ: "versión libre",
  обработка: "adaptación",
};

/**
 * ИСПАНСКИЙ В КОЛОНКЕ, И ОН ВИДЕН НА `/ru` — 7.196, часть 4а.
 *
 * Прежняя редакция этой функции исходила из того, что колонка написана
 * по-русски, а лечить надо только `/es`. Замер 14.09.2026 по боевой базе
 * это опровергает: из 325 значений `Story.author` **277 — испанские**
 * («RusoFásil (relato original)»), и владелец снял их на телефоне в
 * русском каталоге: «Автор: RusoFácil (relato original)» под русским
 * заголовком. Русскими написаны только 48 строк — классики и народные
 * сказки.
 *
 * Лечится тем же приёмом и в ту же сторону: одной таблицей, отрисовкой, в
 * базу не записывается ничего. Таблица ровно на одно значение, потому что
 * испанское значение в колонке ровно одно.
 *
 * ГРАНИЦА, КОТОРУЮ ЭТА ПРАВКА НЕ ПЕРЕСЕКАЕТ. Через эту функцию проходят
 * ДВЕ поверхности — главная и каталог `/stories`, — и обе не заморожены.
 * Страница самого рассказа автора отсюда не берёт, и это важно числом:
 * `byline` входит в сличаемые поля заморозки, и у **57 из 65**
 * замороженных страниц `/ru/stories/…` там стоит ровно
 * «Автор: RusoFásil (relato original)». Правка подписи на самой странице
 * рассказа уронила бы `check:frozen` на 57 адресах — она отложена до
 * снятия заморозки 25.09.2026 (долг).
 */
const AUTHOR_MARKER_RU: Record<string, string> = {
  // Написание уже нормализовано `fixBrandSpelling`, поэтому ключ один.
  "RusoFácil (relato original)": "RusoFácil (оригинальный рассказ)",
};

/**
 * How the byline should read to a visitor of `lang`.
 */
export function localizeStoryAuthor(author: string, lang: Locale): string {
  // Написание имени проекта чинится ДО всего остального и в обеих
  // локалях — долг 182, см. комментарий к fixBrandSpelling выше.
  const fixed = fixBrandSpelling(author);
  if (lang !== "es") return AUTHOR_MARKER_RU[fixed.trim()] ?? fixed;
  const trimmed = fixed.trim();
  if (!trimmed) return fixed;

  const whole = WHOLE[trimmed];
  if (whole) return whole;

  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(trimmed);
  if (!match) return NAMES[trimmed] ?? fixed;

  const [, head, qualifier] = match;
  const headEs = WHOLE[head] ?? NAMES[head];
  const qualifierEs = QUALIFIERS[qualifier.trim()];
  // Half a translation is worse than none: "А.П. Чехов (versión libre)"
  // is the same defect in a smaller font. Only rewrite when both halves
  // are known.
  if (!headEs || !qualifierEs) return fixed;
  return `${headEs} (${qualifierEs})`;
}
