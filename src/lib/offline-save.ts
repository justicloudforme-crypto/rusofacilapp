/**
 * СТРАНИЦА СОХРАНЯЕТ СЕБЯ САМА — ЗАХОД 7.230 (ОФЛАЙН-2б, строка 309).
 *
 * ====================================================================
 * ЧТО ИМЕННО БЫЛО СЛОМАНО И ПОЧЕМУ ЭТОГО НЕ ВИДЕЛИ ПРИБОРЫ 7.229
 * ====================================================================
 *
 * Владелец 25.09.2026 на POCO со сборкой 1.0.5 прошёл с Wi-Fi главную,
 * «Cursos», A1, урок 1 со всеми вкладками, «Cuentos» с двумя рассказами
 * и «Vocabulario» с карточками, убил приложение, выключил Wi-Fi и
 * открыл его заново. Три раза подряд — КАРКАС, ни одной синей полосы
 * «сохранённая копия», и нажатия всех вкладок давали тот же каркас.
 *
 * Читалка 7.229 при этом работает: её проба в браузере рисует урок из
 * `Cache Storage` знак в знак. Разница не в читалке, а в том, что ЧИТАТЬ
 * БЫЛО НЕЧЕГО.
 *
 * ПРИЧИНА. Внутри оболочки навигацию обслуживает java-посредник
 * Capacitor (`WebViewLocalServer.handleProxyRequest`), а не воркер, —
 * это доказано ещё в 7.228 и 7.229 (на сборке 1.0.3 отказ навигации без
 * сети кончался НАТИВНЫМ экраном: ответь воркер, экрана бы не было).
 * Заход 7.229 сделал из этого один вывод — «читать сохранённое обязан
 * сам каркас» — и пропустил второй, который следует из того же факта
 * дословно: **runtime-кеширование воркера живёт в его обработчике
 * `fetch`, и если навигация до воркера не доходит, то она не только не
 * ОТДАЁТСЯ из кеша — она в кеш и не КЛАДЁТСЯ.** То есть
 * `rf-pages-content-*` внутри приложения не наполнялся никогда, и
 * читалка каждый раз открывала пустой ящик.
 *
 * Приборы 7.229 этого не увидели по одной строке: проба
 * `e2e/offline-saved-content.spec.ts` сперва открывала страницы С
 * воркером (он их и сохранял), и только ПОТОМ снимала его регистрацию,
 * изображая оболочку. Порядок «сначала сохранил воркер, потом воркера
 * убрали» в приложении не наступает никогда.
 *
 * ====================================================================
 * ЛЕЧЕНИЕ: САМА СТРАНИЦА КЛАДЁТ СВОЮ КОПИЮ
 * ====================================================================
 *
 * `Cache Storage` — API документа, а не воркера (на этом же построена
 * читалка 7.229). Значит страница, которая уже открыта и уже отрисована,
 * может положить собственную разметку в тот же кеш сама, и участие
 * воркера при этом не нужно ни на шаг. Работает это одинаково в
 * браузере и в оболочке, потому что не зависит от того, кто ответил на
 * навигацию.
 *
 * ИМЯ КЕША СПРАШИВАЕТСЯ У ВОРКЕРА, А НЕ УГАДЫВАЕТСЯ. Отпечаток сборки
 * в имени обязателен (долг 14, строка 308), и вычислить его на странице
 * нечем: он считается из precache-манифеста внутри воркера. Поэтому
 * страница спрашивает имена сообщением (`rf-cache-names`), а воркер
 * отвечает своими. Совпадение получается ПО ПОСТРОЕНИЮ, а не по
 * совпадению чисел в двух файлах; держит это сторож
 * `npm run check:offline-cache-names` и живая проба того же захода.
 *
 * ПРАВИЛА 7.229 СОХРАНЕНЫ ДОСЛОВНО и держатся теперь с ДВУХ сторон —
 * воркерной (плагин `CLOSED_CONTENT_NOT_STORED`) и страничной (здесь):
 *   * закрытое этому посетителю не кладётся и уже лежащее СТИРАЕТСЯ;
 *   * потолок 40 записей содержания и 30 суток;
 *   * выход из учётной записи стирает кеш целиком (префикс `rf-pages`).
 *
 * ПОЧЕМУ У СТРАНИЦЫ СВОЙ УЧЁТ СРОКОВ. `ExpirationPlugin` воркера ведёт
 * свой список в IndexedDB и знает только о том, что положил сам.
 * Запись, положенную страницей, он не увидит и не вычистит никогда —
 * значит потолок и срок обязаны считаться здесь. Список сохранённого
 * («опись») лежит отдельной записью в том же кеше и служит сразу двум
 * делам: по нему считается потолок и по нему же каркас рисует список
 * «Guardado en este teléfono» — с НАЗВАНИЕМ страницы, которого из
 * одного адреса не достать.
 */
import { CACHE_BUDGET_BY_KEY, type SavedKind, savedKindOf } from "./sw-cache-policy";

export type { SavedKind };
export { savedKindOf };

/**
 * Адрес описи. Начинается с двух подчёркиваний и не отвечает ни одному
 * маршруту сайта намеренно: запись обязана лежать в том же кеше, что и
 * страницы (её стирают те же два рубежа), но не должна совпасть ни с
 * одной навигацией — иначе читалка однажды показала бы человеку JSON.
 */
export const OFFLINE_INDEX_PATH = "/__rf-offline-index";

/** Одна строка описи. */
export interface SavedRow {
  /** Полный адрес — ключ записи в кеше. */
  url: string;
  /** Путь без источника — по нему каркас решает, к какой вкладке это. */
  path: string;
  kind: SavedKind;
  /** Название страницы человеческими словами (из `<title>`, обрезанное). */
  title: string;
  lang: "es" | "ru";
  /** Когда положено, миллисекунды эпохи. */
  savedAt: number;
  /** Сколько весит разметка. Нужно, чтобы потолок можно было назвать в мегабайтах. */
  bytes: number;
}

/** Потолки берутся из ОДНОЙ таблицы бюджетов, а не объявляются второй раз. */
export function maxEntriesFor(kind: SavedKind): number {
  return CACHE_BUDGET_BY_KEY[kind === "section" ? "section" : "content"].maxEntries;
}

export function maxAgeSecondsFor(kind: SavedKind): number {
  return CACHE_BUDGET_BY_KEY[kind === "section" ? "section" : "content"].maxAgeSeconds;
}

/** Опись из чего угодно, что пришло из кеша: чужое и поломанное — вон. */
export function parseIndex(raw: unknown): SavedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<SavedRow>;
    if (typeof row.url !== "string" || typeof row.path !== "string") continue;
    if (row.kind !== "lesson" && row.kind !== "story" && row.kind !== "vocabulary" && row.kind !== "section") continue;
    if (typeof row.savedAt !== "number" || !Number.isFinite(row.savedAt)) continue;
    out.push({
      url: row.url,
      path: row.path,
      kind: row.kind,
      title: typeof row.title === "string" ? row.title : "",
      lang: row.lang === "ru" ? "ru" : "es",
      savedAt: row.savedAt,
      bytes: typeof row.bytes === "number" && Number.isFinite(row.bytes) ? row.bytes : 0,
    });
  }
  return out;
}

/** Та же страница второй раз — это ОДНА строка, а не две. */
export function withRow(rows: readonly SavedRow[], row: SavedRow): SavedRow[] {
  return [row, ...rows.filter((existing) => existing.url !== row.url)];
}

export function withoutUrl(rows: readonly SavedRow[], url: string): SavedRow[] {
  return rows.filter((row) => row.url !== url);
}

/**
 * Что остаётся и что выбрасывается. Считается ОТДЕЛЬНО по видам: у
 * разделов свой маленький потолок, и вытеснять ими уроки нельзя —
 * иначе шесть каталогов съели бы шестую часть месяца занятий.
 */
export function trimIndex(
  rows: readonly SavedRow[],
  nowMs: number,
): { keep: SavedRow[]; drop: SavedRow[] } {
  const keep: SavedRow[] = [];
  const drop: SavedRow[] = [];
  const seen: Record<string, number> = { content: 0, section: 0 };
  // Свежее первым: потолок обязан выбрасывать САМОЕ СТАРОЕ, а не то,
  // что попалось. Сортировка по убыванию `savedAt`, устойчивая к равным.
  const sorted = [...rows].sort((a, b) => b.savedAt - a.savedAt);
  for (const row of sorted) {
    const bucket = row.kind === "section" ? "section" : "content";
    const tooOld = nowMs - row.savedAt > maxAgeSecondsFor(row.kind) * 1000;
    if (tooOld || seen[bucket] >= maxEntriesFor(row.kind)) {
      drop.push(row);
      continue;
    }
    seen[bucket] += 1;
    keep.push(row);
  }
  return { keep, drop };
}

/** Заголовок страницы человеческими словами: хвост бренда не нужен. */
export function tidyTitle(raw: string): string {
  const cut = raw.split(/\s+[—|–|]\s+/)[0]?.trim() ?? "";
  const title = (cut || raw).trim();
  return title.length > 90 ? `${title.slice(0, 87)}…` : title;
}
