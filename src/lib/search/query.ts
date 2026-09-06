import type { Locale } from "@/i18n/config";
import type { SearchSection } from "./types";

/** Потолок длины запроса. Строка длиннее не бывает осмысленным названием
 * ни одного объекта сайта, а обрезать дешевле, чем сравнивать 10 720
 * названий с абзацем текста. */
export const MAX_QUERY_LENGTH = 80;

/** Задержка ввода перед запросом. Та же величина, что у поиска по
 * карточкам (`SEARCH_DEBOUNCE_MS` в FlashcardsApp) — одна привычка на
 * оба поля ввода. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Куда ведёт свёрнутая строка раздела. Сегодня свёрнут один раздел —
 * игры, и подборка у него одна: хаб игр со словами. */
export function collapsedHrefsFor(lang: Locale): Partial<Record<SearchSection, string>> {
  return { game: `/${lang}/word-games` };
}
