/**
 * Якоря глубоких ссылок: как поиск называет конкретный объект внутри
 * существующей страницы.
 *
 * Зачем отдельный модуль. Строку `#card-<id>` пишет индекс поиска
 * (`src/lib/search/records.ts`), а читает её страница
 * (`/[lang]/vocabulary/[categoria]` и `IdiomsList`). Пока это были две
 * строки в двух файлах, «поиск ведёт на объект» держалось на совпадении
 * двух литералов — то есть на честном слове. Здесь одно определение, и
 * обе стороны берут его отсюда.
 *
 * Почему якорь, а не параметр или новый адрес. Решение владельца
 * 07.09.2026: новых адресов не заводить (см. PROGRESS.md 7.133, часть 5,
 * вариант Б). Якорь браузер на сервер не отправляет вовсе — он не
 * попадает ни в `sitemap.xml`, ни в `canonical`, ни в краулимое
 * множество, и второго канонического адреса из него не получается ни при
 * каком обходе.
 */

export const CARD_ANCHOR_PREFIX = "card-";
export const IDIOM_ANCHOR_PREFIX = "idiom-";

/** `id` элемента карточки на тематической странице словаря. */
export function cardAnchor(cardId: string): string {
  return `${CARD_ANCHOR_PREFIX}${cardId}`;
}

/** `id` элемента идиомы во вкладке идиом. */
export function idiomAnchor(idiomId: string): string {
  return `${IDIOM_ANCHOR_PREFIX}${idiomId}`;
}

/**
 * Идентификатор объекта из `location.hash`, или `null`, если хеш
 * относится к чему-то другому.
 *
 * Хеш приходит закодированным (`#card-abc` не кодируется, но чужой хеш
 * может), поэтому декодируется — и молча, потому что нечитаемый хеш
 * означает «это не наш якорь», а не ошибку.
 */
export function anchorTarget(hash: string, prefix: string): string | null {
  let raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!raw.startsWith(prefix)) return null;
  const id = raw.slice(prefix.length);
  return id.length > 0 ? id : null;
}
