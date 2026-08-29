import type { Locale } from "@/i18n/config";
import type { WordGameType } from "./types";
import { getTopicInfo, topicLabel } from "./topics";

/**
 * Titles and descriptions for the word-game pages, built from each puzzle's
 * own data.
 *
 * Why this file exists. Measured on the live site 29.08.2026: all 160
 * puzzle URLs (80 free puzzles x 2 locales) plus both hubs served the HOME
 * PAGE's title and description verbatim — the route had no metadata of its
 * own, so the layout fallback answered for it. 162 URLs telling a crawler
 * they are the same page as the home page, and as each other.
 *
 * What a puzzle can honestly be titled — and what changed on 02.09.2026.
 * Until then there was no topic to name: the generator sampled a
 * LEVEL-WIDE pool per rung, and a measurement of all 80 free puzzles
 * against the 23 public vocabulary categories found 5-14 different
 * categories inside every single puzzle, the largest covering 11-44% of
 * its words and never 50%. Naming a theme would have been a caption for
 * content that wasn't there.
 *
 * So the content was changed instead of the caption: 69 of the 80 free
 * puzzles are now built from a single vocabulary category (see
 * word-games/topics.ts) and carry it in WordGamePuzzle.topic. Those get a
 * title that says what the puzzle is actually about, which is also what a
 * Spanish speaker searches for — "sopa de letras de comida en ruso", not
 * "sopa de letras nivel A2 nº 7".
 *
 * The remaining 11 rungs have no category with enough words for their
 * length band and still draw from the mixed pool. They keep the old title
 * unchanged. The branch is on the ROW's topic, never on the lookup table,
 * so a puzzle that comes back mixed on a later rerun stops claiming a
 * theme by itself rather than keeping a title its words no longer support.
 *
 * What every title says regardless: the game type, the level, and — for
 * the untitled-by-topic ones — the rung and how many words the puzzle
 * actually holds.
 *
 * Word count comes from the row itself rather than from the rung tables in
 * the generator: today it happens to be 8+2n for WORD_SEARCH and 6+2n for
 * CROSSWORD at every level (measured), but that is a property of the
 * current generator's tables, not a contract, and a regenerated ladder
 * must not silently make every title wrong.
 */

const BRAND = " | RusoFácilapp";

/** Google truncates SERP titles on pixel width; ~70 characters is the safe
 * ceiling for Spanish and Russian alike, and BRAND already spends 15 of
 * them. Enforced by word-games/metadata.test.ts over every real puzzle
 * coordinate, not just asserted here. */
export const TITLE_MAX = 70;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 155;

const TYPE_NOUN: Record<Locale, Record<WordGameType, string>> = {
  es: { WORD_SEARCH: "Sopa de letras", CROSSWORD: "Crucigrama" },
  ru: { WORD_SEARCH: "Филворд", CROSSWORD: "Кроссворд" },
};

export function puzzleTitle(
  lang: Locale,
  type: WordGameType,
  level: string,
  sequence: number,
  wordCount: number,
  topic?: string | null,
): string {
  const noun = TYPE_NOUN[lang][type];
  const info = getTopicInfo(topic);
  if (info) {
    // The rung number is deliberately absent: within one (type, level)
    // ladder a category is used at most once, so type + topic + level
    // already identifies the puzzle, and "nº 7" spends characters a
    // searcher never types. Uniqueness across every real coordinate is
    // asserted in metadata.test.ts rather than assumed here.
    const label = topicLabel(info, lang);
    const base =
      lang === "ru"
        ? `${noun} на русском: ${label} (${level})`
        : `${noun} de ${label} en ruso (${level})`;
    return `${base}${BRAND}`;
  }
  const base =
    lang === "ru"
      ? `${noun} по русскому языку, уровень ${level} № ${sequence} (${wordCount} слов)`
      : `${noun} en ruso, nivel ${level} nº ${sequence} (${wordCount} palabras)`;
  return `${base}${BRAND}`;
}

export function puzzleDescription(
  lang: Locale,
  type: WordGameType,
  level: string,
  sequence: number,
  wordCount: number,
  topic?: string | null,
): string {
  const info = getTopicInfo(topic);
  if (info) {
    const label = topicLabel(info, lang);
    if (lang === "ru") {
      return type === "WORD_SEARCH"
        ? `Филворд на русском языке по теме «${label}», уровень ${level}: найдите в сетке ${wordCount} слов. Бесплатно, без регистрации, с переводом каждого слова.`
        : `Кроссворд на русском языке по теме «${label}», уровень ${level}: ${wordCount} определений на испанском, ответы кириллицей. Бесплатно и без регистрации.`;
    }
    return type === "WORD_SEARCH"
      ? `Sopa de letras en ruso con ${wordCount} palabras de ${label}, nivel ${level}. Encuéntralas todas en la cuadrícula: gratis, sin registro y con traducción.`
      : `Crucigrama en ruso de ${label}, nivel ${level}: ${wordCount} definiciones en español y respuestas en cirílico. Gratis, sin registro y con traducción.`;
  }
  if (lang === "ru") {
    return type === "WORD_SEARCH"
      ? `Филворд по русскому языку уровня ${level}: найдите ${wordCount} русских слов в сетке. Головоломка № ${sequence} в серии, бесплатно и без регистрации.`
      : `Кроссворд по русскому языку уровня ${level}: ${wordCount} определений на испанском, ответы кириллицей. Головоломка № ${sequence}, бесплатно и без регистрации.`;
  }
  return type === "WORD_SEARCH"
    ? `Sopa de letras en ruso de nivel ${level}: encuentra ${wordCount} palabras rusas escondidas en la cuadrícula. Puzle nº ${sequence} de la serie, gratis y sin registro.`
    : `Crucigrama en ruso de nivel ${level}: ${wordCount} definiciones en español y respuestas en cirílico. Puzle nº ${sequence} de la serie, gratis y sin registro.`;
}

/** The hub. Deliberately NOT phrased like /es/sopa-de-letras-ruso or
 * /es/crucigramas-ruso-principiantes, which are single-puzzle landing
 * pages aimed at exactly those two queries — the hub's job is the ladder,
 * so it says "by level" and lets the landing pages keep their query. */
export function hubMetadata(lang: Locale): { title: string; description: string } {
  if (lang === "ru") {
    return {
      title: `Игры со словами по русскому языку, по уровням${BRAND}`,
      description:
        "Филворды и кроссворды для тренировки русской лексики, по уровням от A1 до C1. Первые головоломки каждого уровня открыты без подписки.",
    };
  }
  return {
    title: `Juegos de palabras en ruso por niveles${BRAND}`,
    description:
      "Sopas de letras y crucigramas para practicar vocabulario ruso, por niveles del A1 al C1. Los primeros puzles de cada nivel son gratis, sin registro.",
  };
}
