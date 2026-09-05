/**
 * Разбор серверного HTML на рёбра графа ссылок.
 *
 * Зачем модуль, а не функции внутри скрипта. Замер достижимости делался
 * руками уже четырежды — 7.102, 7.111, 7.112, 7.113/7.114, — и каждый раз
 * извлекатель ссылок писался заново в одноразовом файле. Цена такой
 * привычки уже записана в проекте дважды: `robots-matcher.ts` появился
 * после того, как очередной аудит пересказал правило `Allow`/`Disallow`
 * прозой и ошибся молча, а 7.114 потерял ровно половину якорей на
 * регулярке с флагом `g` внутри `.test()`. Здесь то же самое: правило
 * живёт в одном месте, и у него есть тесты.
 */

/** Один разобранный документ: откуда пришли и на что он ссылается. */
export interface PageEdges {
  from: string;
  targets: string[];
}

/**
 * Приводит `href` к абсолютному виду в пределах одного origin.
 *
 * Возвращает `null` для чужого хоста, `mailto:`, `tel:` и всего, что не
 * разбирается. Якорь и строка запроса отбрасываются: `?page=2` и `#top` —
 * это тот же документ, и считать их отдельными URL значит выдумать графу
 * вершины, которых нет в карте сайта.
 */
export function normalizeUrl(href: string, from: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(href, from);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.search = "";
  const path = url.pathname.replace(/\/+$/, "");
  return origin + (path === "" ? "/" : path);
}

/**
 * Вырезает `<section …data-testid="X"…>…</section>` вместе с содержимым,
 * считая вложенные `<section>`.
 *
 * Нужно ровно для одного: посчитать граф, каким он был ДО того, как в него
 * добавили секцию, не пересобирая приложение и не откатывая код. Секции
 * серверных списков ссылок (`story-link-index`, `media-link-index`,
 * `free-puzzle-index`) помечены `data-testid`, поэтому «до» снимается с
 * того же живого прода, что и «после», — и разница между двумя числами не
 * может уехать из-за того, что базы или сборки разные.
 *
 * Регулярное выражение здесь не годится: секции вложены друг в друга, а
 * `[\s\S]*?` до первого `</section>` отрезал бы половину.
 */
export function dropSection(html: string, testId: string): string {
  const marker = `data-testid="${testId}"`;
  const at = html.indexOf(marker);
  if (at === -1) return html;
  const start = html.lastIndexOf("<section", at);
  if (start === -1) return html;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const open = html.indexOf("<section", i + 1);
    const close = html.indexOf("</section", i + 1);
    if (close === -1) return html.slice(0, start);
    if (open !== -1 && open < close) {
      depth += 1;
      i = open;
      continue;
    }
    if (depth === 0) {
      const end = html.indexOf(">", close);
      return html.slice(0, start) + html.slice(end === -1 ? close : end + 1);
    }
    depth -= 1;
    i = close;
  }
  return html.slice(0, start);
}

/**
 * Все цели `<a href>` документа, по одной штуке на цель.
 *
 * Имя атрибута читается без учёта регистра — правило 4.2, то же, по
 * которому `hrefLang` когда-то ускользнул от замера. Регулярка строится
 * ЛОКАЛЬНО на каждый вызов: общая с флагом `g` хранит `lastIndex` между
 * вызовами и пропускает совпадения через одно (7.114, 175 якорей вместо
 * 349).
 */
export function anchorTargets(html: string, from: string, origin: string, dropTestIds: readonly string[] = []): string[] {
  const body = dropTestIds.reduce(dropSection, html);
  const re = /<a\b[^>]*?\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const url = normalizeUrl(m[2] ?? m[3] ?? m[4] ?? "", from, origin);
    if (url) out.add(url);
  }
  return [...out];
}

/**
 * Семейство URL — по СЕГМЕНТАМ пути, а не по подстроке.
 *
 * В 7.94 подстрочный фильтр назвал сиротой сам хаб `/es/stories`, потому
 * что путь карточки начинается теми же знаками. Здесь `/es/stories` и
 * `/es/stories/<id>` — разные ответы, и это свойство разбора, а не удача
 * порядка проверок.
 */
export function urlFamily(url: string, origin: string): string {
  const segments = url.slice(origin.length).split("/").filter(Boolean);
  if (segments.length === 0) return "корень";
  if (segments.length === 1) return "корень локали";
  const second = segments[1];
  const deep = segments.length > 2;
  switch (second) {
    case "stories":
      return deep ? "рассказ" : "каталог";
    case "media":
      return deep ? "медиа" : "каталог";
    case "courses":
      return deep ? "урок" : "каталог";
    case "vocabulary":
      return deep ? "категория словаря" : "каталог";
    case "flashcards":
    case "glossary":
      return deep ? "словарь" : "каталог";
    case "word-games":
      return deep ? "пазл" : "каталог";
    case "exams":
      return "экзамен";
    default:
      return "статика/лендинги";
  }
}
