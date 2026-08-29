import type { Locale } from "@/i18n/config";
import type { WordGameType } from "./types";

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
 * What a puzzle can honestly be titled. There is no topic or category
 * column on WordGamePuzzle (see prisma/schema.prisma), and the word lists
 * do not carry one either: prisma/generate-word-games.ts samples a
 * LEVEL-WIDE pool per rung, and a measurement of all 80 free puzzles
 * against the 23 public vocabulary categories found 5-14 different
 * categories inside every single puzzle, with the largest one covering
 * 11-44% of its words and never 50%. So there is no theme to name, and
 * inventing one ("Sopa de letras de comida") would be a caption for
 * content that isn't there.
 *
 * What is left is real and per-puzzle: the game type, the level, the rung
 * within that level, and how many words the puzzle actually holds. That is
 * what these titles say, in the phrasing a Spanish speaker searches with
 * ("sopa de letras en ruso", "crucigrama en ruso").
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
): string {
  const noun = TYPE_NOUN[lang][type];
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
): string {
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
