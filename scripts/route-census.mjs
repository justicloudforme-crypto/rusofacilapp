/**
 * МНОЖЕСТВО АДРЕСОВ САЙТА — СОБИРАЕТСЯ, А НЕ ПЕРЕЧИСЛЯЕТСЯ РУКОЙ.
 *
 * ====================================================================
 * ОТКУДА ЭТОТ ФАЙЛ
 * ====================================================================
 *
 * Три захода подряд сторож платных поверхностей отчитывался «ноль», а
 * владелец находил кнопку покупки на живом телефоне. Каждый раз причину
 * называли и чинили, и каждый раз оставался рукописный список адресов:
 * 4 штуки в 7.192, 11 штук в 7.193. Рукописный список не может быть
 * полным по построению — он полон ровно настолько, насколько полна была
 * память того, кто его писал, и стареет молча при каждой новой странице.
 *
 * Здесь список собирается из двух независимых источников, и оба —
 * машинные:
 *
 *   1. МАРШРУТЫ APP ROUTER. Обход `src/app/**\/page.tsx`. Даёт КАЖДЫЙ
 *      шаблон маршрута, какой есть в коде, включая те, которых нет в
 *      карте сайта вовсе: `/login`, `/profile`, `/register`, `/groups`,
 *      весь `/admin`. Карта сайта их не знает и знать не должна.
 *   2. КАРТА САЙТА (`/sitemap.xml`). Даёт ЖИВЫЕ адреса для шаблонов с
 *      переменной частью: какой именно рассказ, какое видео, какой урок.
 *      Выдумать `/es/stories/<id>` из шаблона нельзя, а из карты сайта —
 *      можно взять настоящий.
 *
 * ====================================================================
 * ПОЧЕМУ НЕ ВСЕ 1913 АДРЕСА КАРТЫ САЙТА, А ПРЕДСТАВИТЕЛИ
 * ====================================================================
 *
 * Кнопка покупки живёт в КОДЕ, а код у всех адресов одного шаблона один
 * и тот же файл. Пройти 1913 адресов тремя ролями в браузере — это
 * порядка 11 500 открытий страницы; такой прогон не влезает ни в
 * `verify`, ни в CI, то есть на деле не гонялся бы никогда, а сторож,
 * который не гоняется, не сторож.
 *
 * Поэтому от каждого шаблона берётся `perDynamic` живых представителей
 * (по умолчанию 2: первый и последний по порядку карты сайта — они
 * обычно различаются платностью, и это ровно то различие, которое тут
 * важно). Граница названа честно и печатается числом: сколько шаблонов,
 * сколько адресов карты сайта прочитано, сколько адресов в итоговом
 * множестве и сколько адресов карты сайта представитель заменяет.
 *
 * ШАБЛОН БЕЗ ПРЕДСТАВИТЕЛЯ — ЭТО НЕ «ПРОПУСТИТЬ». Статический шаблон
 * (без `[...]`) подставляется сам собой. Шаблон с переменной частью, для
 * которой в карте сайта не нашлось ни одного адреса, попадает в
 * `unreachable` и печатается поимённо: молча выбросить страницу из
 * замера — это отдельный класс промаха, и он в этом проекте уже
 * оплачен (PROGRESS.md 4.5).
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const APP_DIR = "src/app";
export const LOCALES = ["es", "ru"];

/** Все шаблоны маршрутов из app router. Группы `(...)`, параллельные
 *  `@...` и перехватывающие `(.)` сегменты в адрес не входят. */
export function routePatterns(appDir = APP_DIR) {
  const out = [];
  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Группа маршрутов в адресе не участвует; приватные папки (`_`)
        // и параллельные слоты (`@`) маршрутами не являются вовсе.
        if (entry.startsWith("_") || entry.startsWith("@")) continue;
        const isGroup = entry.startsWith("(") && entry.endsWith(")");
        walk(full, isGroup ? segments : [...segments, entry]);
      } else if (entry === "page.tsx" || entry === "page.ts") {
        out.push("/" + segments.join("/"));
      }
    }
  };
  walk(appDir, []);
  return out.sort();
}

/** Регулярка, по которой живой адрес узнаётся как экземпляр шаблона. */
function patternToRegExp(pattern) {
  const body = pattern
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      // `[lang]` — не «любой сегмент», а ровно две локали: иначе шаблон
      // `/[lang]/stories` совпал бы с чем угодно двухуровневым.
      if (segment === "[lang]") return "(?:es|ru)";
      if (segment.startsWith("[...") || segment.startsWith("[[...")) return "(?:[^/]+/)*[^/]+";
      if (segment.startsWith("[")) return "[^/]+";
      // Сегменты приходят из имён папок, а не от человека, но экранируются
      // всё равно — правило 4.4 PROGRESS.md не знает исключений.
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^/${body}$`);
}

/** Все `<loc>` карты сайта, приведённые к пути без хоста. */
export async function sitemapPaths(base) {
  const res = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`/sitemap.xml ответил ${res.status} — собрать адреса не из чего`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map((loc) => {
    try {
      return new URL(loc).pathname;
    } catch {
      return loc;
    }
  });
}

/**
 * Итоговое множество адресов.
 *
 * @returns {Promise<{patterns: string[], sitemapCount: number, addresses: string[],
 *                    unreachable: string[], represented: number}>}
 */
export async function collectAddresses(base, { perDynamic = 2, appDir = APP_DIR } = {}) {
  const patterns = routePatterns(appDir);
  const sitemap = await sitemapPaths(base);
  const addresses = [];
  const unreachable = [];
  let represented = 0;

  for (const pattern of patterns) {
    const dynamic = pattern.includes("[");
    if (!dynamic) {
      // `[lang]` — единственная переменная часть, общая всем; статическим
      // шаблоном здесь называется тот, у которого других нет.
      addresses.push(pattern);
      continue;
    }
    const byLocale = new Map(LOCALES.map((l) => [l, []]));
    // `[lang]` подставляется обеими локалями, остальные переменные части
    // берутся из карты сайта.
    if (pattern.replace("/[lang]", "").includes("[")) {
      const re = patternToRegExp(pattern);
      for (const live of sitemap) {
        if (!re.test(live)) continue;
        const locale = live.split("/")[1];
        const list = byLocale.get(locale);
        if (list) list.push(live);
      }
      let any = false;
      for (const [, list] of byLocale) {
        if (list.length === 0) continue;
        any = true;
        represented += list.length;
        const picked = list.length <= perDynamic ? list : [list[0], list[list.length - 1]].slice(0, perDynamic);
        addresses.push(...picked);
      }
      if (!any) unreachable.push(pattern);
    } else {
      addresses.push(pattern);
    }
  }

  // Шаблоны, в которых переменная часть — только `[lang]`, разворачиваются
  // в обе локали здесь, одним местом.
  const expanded = [];
  for (const address of addresses) {
    if (address.includes("[lang]")) {
      for (const locale of LOCALES) expanded.push(address.replace("[lang]", locale));
    } else {
      expanded.push(address);
    }
  }

  return {
    patterns,
    sitemapCount: sitemap.length,
    addresses: [...new Set(expanded)].sort(),
    unreachable,
    represented,
  };
}
