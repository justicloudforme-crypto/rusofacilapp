/**
 * СКАЧАННОЕ НА ТЕЛЕФОН — ЗАХОД 7.231 (ОФЛАЙН-3), СТРОКИ 308 И 311.
 *
 * ====================================================================
 * ЧЕМ СКАЧАННОЕ ОТЛИЧАЕТСЯ ОТ ПРОСТО ПРОСМОТРЕННОГО
 * ====================================================================
 *
 * С 7.230 страница кладёт свою копию на телефон САМА, без просьбы: открыл
 * урок с сетью — копия легла. Это дёшево и это правильно, но у такой
 * копии три чужих правила, и человек ни на одно из них не подписывался:
 *
 *   1. ПОТОЛОК. Кеш содержания держит 36 записей (`CONTENT_MAX_ENTRIES`),
 *      кеш разделов — 4. Тридцать седьмой материал молча выбрасывает
 *      первый. Для «я листал» это верно; для «я взял это в самолёт» —
 *      нет.
 *   2. СРОК. Тридцать суток, и они считаются от сохранения, а не от
 *      чтения.
 *   3. ВЫКАТ САЙТА (долг 308). В имени кеша содержания стоит отпечаток
 *      сборки (долг 14), и первый же выкат сайта уносит всё сохранённое
 *      целиком. Это осознанная цена: сохранённый HTML ссылается на чанки
 *      своей сборки. Но для СКАЧАННОГО эта цена неприемлема — человек
 *      нажал кнопку и получил обещание.
 *
 * Поэтому у скачанного СВОЙ кеш, и в его имени отпечатка сборки НЕТ:
 * `rf-pages-downloads`. Ни потолка записей, ни срока у него тоже нет —
 * есть потолок по ОБЩЕМУ ВЕСУ (`DOWNLOADS_MAX_BYTES`), потому что на
 * телефоне дорог не счёт записей, а мегабайты.
 *
 * ====================================================================
 * ПОЧЕМУ ИМЯ ВСЁ-ТАКИ НАЧИНАЕТСЯ С `rf-pages`
 * ====================================================================
 *
 * На этом префиксе висят две уже оплаченные вещи, и первая нужна здесь
 * дословно: выход из учётной записи стирает такие кеши ЦЕЛИКОМ
 * (`personalPageCaches`, `src/lib/signed-out.ts`). Скачанный платный урок
 * обязан исчезать при выходе — у общего телефона цена ошибки ровно эта.
 *
 * Вторая — выбрасывание чужих отпечатков на новой сборке
 * (`staleCacheNames`) — здесь НЕ нужна, и поэтому имя внесено в
 * `pageCacheNames` как постоянное: оно попадает в список «свои» при
 * ЛЮБОМ отпечатке и не выбрасывается ни одним выкатом. Это и есть
 * закрытие долга 308 для скачанного (для просто просмотренного долг 308
 * остаётся как есть — честно так и написано в отчёте захода).
 *
 * ЧТО С БЕСПЛАТНЫМ ПРИ ВЫХОДЕ. Стирается тоже — вместе со всем. Отделять
 * «бесплатное скачанное» от «платного скачанного» при выходе значило бы
 * вести на устройстве вторую правду о платности и доверять ей в момент,
 * когда сервера рядом нет. Цена ошибки в эту сторону — чужой платный
 * урок на общем телефоне; цена ошибки в ту — повторное скачивание
 * бесплатного рассказа. Выбрано второе.
 */
import { type SavedKind, savedKindOf } from "./sw-cache-policy";
import { DOWNLOADS_CACHE_NAME } from "./sw-cache-names";

/** Имя кеша скачанного. БЕЗ отпечатка сборки — см. шапку. Объявлено в
 *  `sw-cache-names.ts`, потому что его обязан знать `staleCacheNames`. */
export { DOWNLOADS_CACHE_NAME };

/**
 * Адрес описи скачанного. Как и у описи 7.230, начинается с двух
 * подчёркиваний и не отвечает ни одному маршруту сайта: запись обязана
 * лежать в том же кеше (её стирает тот же выход), но не должна совпасть
 * ни с одной навигацией — иначе человек однажды увидел бы JSON.
 */
export const DOWNLOADS_INDEX_PATH = "/__rf-downloads-index";

/** Один клип в скачанном материале: адрес и настоящий вес из ответа. */
export interface DownloadedClip {
  url: string;
  /** Байты из `Content-Length` ответа HEAD/GET. Ноль — «не удалось спросить». */
  bytes: number;
}

/** Одна строка описи скачанного. */
export interface DownloadedRow {
  /** Полный адрес страницы — он же ключ записи с её разметкой. */
  url: string;
  path: string;
  kind: SavedKind;
  title: string;
  lang: "es" | "ru";
  /** Когда скачано, миллисекунды эпохи. */
  savedAt: number;
  /** Вес разметки страницы в байтах. */
  pageBytes: number;
  clips: DownloadedClip[];
  /**
   * ЛИСТЫ СТИЛЕЙ, ПОЛОЖЕННЫЕ ВМЕСТЕ С МАТЕРИАЛОМ — ЗАХОД 7.233, СТРОКА 314.
   *
   * Адреса `/_next/static/css/…`, которые объявляет сама скачанная
   * разметка. Лежат они в ТОМ ЖЕ кеше `rf-pages-downloads`, и это не
   * запас на всякий случай, а закрытие дефекта, снятого на видео
   * 26.09.2026: без них строка скачанного исчезала из списка целиком,
   * хотя страница и все её клипы лежали на телефоне.
   *
   * Разбор — у `sheetUrlsOnPage` в `downloads-client.ts`.
   */
  sheets: string[];
  /** Вес всего материала: разметка плюс все клипы плюс листы стилей. */
  bytes: number;
}

/**
 * ПОТОЛОК СКАЧАННОГО — ПО ВЕСУ, А НЕ ПО ЧИСЛУ ЗАПИСЕЙ.
 *
 * ЧИСЛА ИЗ ЗАМЕРА 26.09.2026 (боевая база, только SELECT; вес клипов —
 * настоящие ответы HEAD на blob-источник, не среднее):
 *
 *   * урок `a1-1`: 65 клипов = 1 483 008 байт, разметка ≈ 252 585 →
 *     1 735 593 байта, 1,66 МБ;
 *   * рассказ «Снегурочка» (A1): 12 клипов по предложениям = 1 219 584
 *     байта, разметка ≈ 240 000 → 1 459 584 байта, 1,39 МБ;
 *   * самый «клиповый» рассказ базы — 59 клипов (число 180 из
 *     комментария воркера устарело: столько нет ни у одного рассказа).
 *
 * Средний материал со звуком — 1,6 МБ. Сто пятьдесят мегабайт — это
 * девяносто с лишним материалов, то есть три месяца занятий по одному в
 * день, и при этом счёт на телефоне остаётся тем, что человек может
 * назвать вслух. Потолок сторожит НЕ вытеснение: скачанное не
 * выбрасывается самo никогда — при переполнении честно отказывает
 * следующее скачивание, и человек сам решает, что удалить.
 */
export const DOWNLOADS_MAX_BYTES = 150 * 1024 * 1024;

/** Опись из чего угодно, что пришло из кеша: чужое и поломанное — вон. */
export function parseDownloads(raw: unknown): DownloadedRow[] {
  if (!Array.isArray(raw)) return [];
  const out: DownloadedRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<DownloadedRow>;
    if (typeof row.url !== "string" || typeof row.path !== "string") continue;
    if (row.kind !== "lesson" && row.kind !== "story" && row.kind !== "vocabulary" && row.kind !== "section") continue;
    if (typeof row.savedAt !== "number" || !Number.isFinite(row.savedAt)) continue;
    const clips: DownloadedClip[] = [];
    if (Array.isArray(row.clips)) {
      for (const clip of row.clips) {
        if (!clip || typeof clip !== "object") continue;
        const one = clip as Partial<DownloadedClip>;
        if (typeof one.url !== "string") continue;
        clips.push({ url: one.url, bytes: numberOr(one.bytes, 0) });
      }
    }
    const pageBytes = numberOr(row.pageBytes, 0);
    const sheets: string[] = [];
    if (Array.isArray(row.sheets)) {
      for (const sheet of row.sheets) if (typeof sheet === "string" && !sheets.includes(sheet)) sheets.push(sheet);
    }
    out.push({
      url: row.url,
      path: row.path,
      kind: row.kind,
      title: typeof row.title === "string" ? row.title : "",
      lang: row.lang === "ru" ? "ru" : "es",
      savedAt: row.savedAt,
      pageBytes,
      clips,
      sheets,
      bytes: numberOr(row.bytes, pageBytes + clips.reduce((sum, clip) => sum + clip.bytes, 0)),
    });
  }
  return out;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Скачать можно только то, что без сети и правда читают. */
export function downloadableKindOf(pathname: string): SavedKind | null {
  const kind = savedKindOf(pathname);
  // Корень раздела кнопки «скачать» не получает: каталог без сети и так
  // ложится сам (7.230), а звука у него нет — качать было бы нечего.
  return kind === "section" ? null : kind;
}

export function totalBytes(rows: readonly DownloadedRow[]): number {
  return rows.reduce((sum, row) => sum + row.bytes, 0);
}

/** Влезет ли ещё столько. Потолок — по общему весу, см. шапку. */
export function fitsBudget(rows: readonly DownloadedRow[], addBytes: number, url?: string): boolean {
  const without = url ? rows.filter((row) => row.url !== url) : rows;
  return totalBytes(without) + addBytes <= DOWNLOADS_MAX_BYTES;
}

export function withDownload(rows: readonly DownloadedRow[], row: DownloadedRow): DownloadedRow[] {
  return [row, ...rows.filter((existing) => existing.url !== row.url)];
}

export function withoutDownload(rows: readonly DownloadedRow[], url: string): DownloadedRow[] {
  return rows.filter((row) => row.url !== url);
}

export function findDownload(rows: readonly DownloadedRow[], url: string): DownloadedRow | null {
  return rows.find((row) => row.url === url) ?? null;
}

/**
 * Вес человеческими словами. Запятая как разделитель дроби в обеих
 * локалях — так пишут и по-испански, и по-русски; точка прочиталась бы
 * испаноговорящим как разделитель тысяч.
 */
export function formatWeight(bytes: number, lang: "es" | "ru"): string {
  const unit = lang === "ru" ? "МБ" : "MB";
  const mb = bytes / (1024 * 1024);
  if (bytes > 0 && mb < 0.1) return `0,1 ${unit}`;
  const shown = mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
  return `${shown.replace(".", ",")} ${unit}`;
}

/**
 * Все адреса, которые скачивание кладёт на телефон под эту строку.
 *
 * ЛИСТЫ СТИЛЕЙ ВХОДЯТ СЮДА НАРАВНЕ С КЛИПАМИ (строка 314): скачанное без
 * своих стилей показать нельзя, и «лежит целиком» без них было бы
 * неправдой ровно того рода, которую снял владелец на видео.
 *
 * Дубли убираются: один и тот же лист стилей объявляют все страницы
 * сайта, и удалять его по разу за строку — значит удалить его у соседа.
 */
export function urlsOf(row: DownloadedRow): string[] {
  return [...new Set([row.url, ...row.clips.map((clip) => clip.url), ...row.sheets])];
}

/**
 * ЯЗЫК СТРАНИЦЫ — ИЗ ЕЁ ЖЕ АДРЕСА, ЗАХОД 7.233, СТРОКА 316.
 *
 * Две локали одной страницы — это два РАЗНЫХ адреса и две разные копии,
 * но название у них бывает одно на двоих: «Снегурочка» и по-испански
 * «Снегурочка». Владелец 26.09.2026 получил в списке две строки
 * «Снегурочка · Cuento · Descargado · 1,4 MB», различить которые
 * нечем. Пометка языка берётся из адреса, а не из описи: адрес есть у
 * строки всегда, даже у восстановленной из ключей кеша.
 */
export function langOfPath(pathname: string): "es" | "ru" {
  return /^\/ru(\/|$)/.test(pathname) ? "ru" : "es";
}

/** Пометка языка на экране. Два знака и без перевода: они одинаково
 *  читаются и по-испански, и по-русски, и не спорят с языком оболочки. */
export function langMark(lang: "es" | "ru"): string {
  return lang === "ru" ? "RU" : "ES";
}

/**
 * ДУБЛЕЙ ОДНОГО АДРЕСА В СПИСКЕ НЕ БЫВАЕТ (строка 316). Побеждает первая
 * строка: опись отсортирована свежим вперёд, а восстановленное из кешей
 * дописывается после неё.
 */
export function withoutDuplicates(rows: readonly DownloadedRow[]): DownloadedRow[] {
  const seen = new Set<string>();
  const out: DownloadedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out;
}
