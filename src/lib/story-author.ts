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
 * How the byline should read to a visitor of `lang`.
 *
 * `/ru` gets the column untouched — it is written in that locale already.
 */
export function localizeStoryAuthor(author: string, lang: Locale): string {
  if (lang !== "es") return author;
  const trimmed = author.trim();
  if (!trimmed) return author;

  const whole = WHOLE[trimmed];
  if (whole) return whole;

  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(trimmed);
  if (!match) return NAMES[trimmed] ?? author;

  const [, head, qualifier] = match;
  const headEs = WHOLE[head] ?? NAMES[head];
  const qualifierEs = QUALIFIERS[qualifier.trim()];
  // Half a translation is worse than none: "А.П. Чехов (versión libre)"
  // is the same defect in a smaller font. Only rewrite when both halves
  // are known.
  if (!headEs || !qualifierEs) return author;
  return `${headEs} (${qualifierEs})`;
}
