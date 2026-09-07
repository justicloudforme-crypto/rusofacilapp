/**
 * Маршруты, которые существуют ТОЛЬКО на `/es`.
 *
 * Каждый из них стоит под `if (lang !== "es") notFound()` в своей
 * `page.tsx`: страница отвечает на испанский поисковый запрос
 * («sopa de letras de comida en ruso», «alfabeto cirílico»), у которого
 * нет русского эквивалента, поэтому второго адреса под `/ru` заводить не
 * стали. Перепись 7.131 насчитала 16 таких адресов и записала их 404 в
 * норму — и это верно ровно до тех пор, пока на них никто не СССЫЛАЕТСЯ
 * с префиксом текущей локали.
 *
 * 07.09.2026 оказалось, что ссылается: вводная дека строила адрес как
 * `/${lang}${link.href}`, и на `/ru` кнопка «Открыть кириллицу» вела в
 * `/ru/alfabeto-cirilico` — 404. Отсюда правило проекта: из русской
 * локали ссылка либо ведёт на существующий адрес, либо не печатается
 * вовсе; молча уводить человека в 404 нельзя нигде.
 *
 * Список — ПРИЗНАК, а не пересказ. Он один, его сверяет с файловой
 * системой `spanish-only-routes.test.ts` в обе стороны (в списке нет
 * лишнего, и ни один маршрут с испанской заглушкой не пропущен), и
 * строить локализованный адрес полагается только через
 * {@link localeHref}. Условие «ну это же испанская страница», написанное
 * прозой в четвёртом месте, переживает переименование маршрута молча —
 * ровно то, из-за чего `isFreeWordGamePuzzle` в своё время собрали в
 * одну функцию (см. word-games/free-tier.ts).
 *
 * `[categoria]` — динамический сегмент: сопоставляется по ФОРМЕ пути, а
 * не по подстроке, иначе `/vocabulary` (двуязычная, 200 в обеих
 * локалях) попала бы в тот же мешок, что `/vocabulary/comida`.
 */
export const SPANISH_ONLY_ROUTES = [
  "/alfabeto-cirilico",
  "/crucigramas-ruso-principiantes",
  "/gramatica",
  "/gramatica/alfabeto-ruso",
  "/gramatica/genero-sustantivos-ruso",
  "/gramatica/plural-sustantivos-ruso",
  "/gramatica/verbos-reflexivos-ruso",
  "/juegos-para-aprender-ruso",
  "/sopa-de-letras-alfabeto-cirilico",
  "/sopa-de-letras-ruso",
  "/sopa-de-letras-ruso-ciudad",
  "/sopa-de-letras-ruso-clima",
  "/sopa-de-letras-ruso-comida",
  "/sopa-de-letras-ruso-compras",
  "/sopa-de-letras-ruso-familia",
  "/sopa-de-letras-ruso-ropa",
  "/vocabulary/[categoria]",
] as const;

/** Путь БЕЗ префикса локали (`/alfabeto-cirilico`) — есть ли он только на `/es`. */
export function isSpanishOnlyRoute(path: string): boolean {
  const clean = ("/" + path.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
  const parts = clean.split("/").filter(Boolean);
  return SPANISH_ONLY_ROUTES.some((route) => {
    const pattern = route.split("/").filter(Boolean);
    if (pattern.length !== parts.length) return false;
    return pattern.every((seg, i) => (seg.startsWith("[") ? parts[i].length > 0 : seg === parts[i]));
  });
}

/**
 * Единственный правильный способ построить внутренний адрес из пути без
 * локали.
 *
 * Для двуязычного маршрута — префикс текущей локали. Для испанского —
 * `/es` ЯВНО, из обеих локалей: увести русскоязычного посетителя на
 * испанскую страницу честнее, чем в 404, и это решение владельца от
 * 07.09.2026. Ссылку, которую нельзя увести никуда, печатать не надо —
 * такое место в коде решает само, вызывая {@link isSpanishOnlyRoute}.
 */
export function localeHref(lang: string, path: string): string {
  return `/${isSpanishOnlyRoute(path) ? "es" : lang}${path}`;
}
