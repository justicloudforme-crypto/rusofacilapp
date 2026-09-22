/**
 * Признаки нативной оболочки — БЕЗ единого серверного импорта.
 *
 * Отдельный файл, а не часть `src/lib/native-shell.ts`, ровно по одной
 * причине: эти константы читает `src/proxy.ts`, а он исполняется в
 * middleware, где `next/headers` и `server-only` запрещены. Разбор того,
 * зачем признаков два и почему одного User-Agent мало, — в шапке
 * `src/lib/native-shell.ts`; здесь только значения.
 */

// Написание НЕ брендовое и намеренно, по двум причинам сразу. Значение
// User-Agent обязано быть ASCII, а в имени продукта есть «á», и в
// заголовок оно не кладётся; а написать то же имя без диакритики
// запрещает `npm run check:brand` — он ловит это во всём репозитории.
// Поэтому токен чисто технический и с именем продукта не пересекается.
//
// Тот же литерал стоит в `capacitor.config.ts`, и сторож
// `npm run check:native-payments` сличает два файла текстом.
export const NATIVE_USER_AGENT_TOKEN = "RFNativeShell";

/**
 * Имя куки, которой оболочка представляется серверу на всех последующих
 * запросах — включая те, что за неё делает service worker.
 *
 * НЕ httpOnly намеренно: её ставит и читает ещё и клиент
 * (`src/lib/native-shell-client.ts`). Ничего секретного в ней нет —
 * значение ровно одно и означает «эта страница открыта в приложении».
 */
export const NATIVE_SHELL_COOKIE = "rf_native_shell";

/** Значение куки. Одно-единственное: кука либо стоит, либо нет. */
export const NATIVE_SHELL_COOKIE_VALUE = "1";

/** Год. Оболочка переставит куку сама на любом запросе с токеном, так что
 *  срок здесь — только про то, чтобы она не пропала между запусками. */
export const NATIVE_SHELL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** true, если строка User-Agent принадлежит нативной оболочке. */
export function userAgentIsNativeShell(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && userAgent.includes(NATIVE_USER_AGENT_TOKEN);
}

/**
 * ВЕРСИЯ ОБОЛОЧКИ — ТРЕТЬЕ ЗНАЧЕНИЕ В ТОМ ЖЕ КАНАЛЕ (долг 235, заход
 * 7.223).
 *
 * ЧЕГО НЕ ХВАТАЛО. Признаков оболочки два, и оба бесверсионные по
 * построению: токен `RFNativeShell` — литерал без чисел, кука
 * `rf_native_shell` имеет единственное значение `"1"`. Сайт не мог
 * отличить залитую в закрытый тест сборку 7202 (`versionCode 2`) от
 * любой следующей, а на `versionCode 4` это понадобится: касса Google
 * должна включаться ТОЛЬКО в той оболочке, которая её умеет, и «у меня
 * просто не работает» у части людей — это ровно то, чего стоит незнание
 * версии.
 *
 * ГДЕ ЖИВЁТ ЧИСЛО. Там же, где признак, и обоими его обличьями сразу:
 *
 *   1. ТОКЕН. `capacitor.config.ts` дописывает к User-Agent
 *      `RFNativeShell/3`. Его несут те запросы, которые webview делает
 *      САМ.
 *   2. КУКА. Запрос, который за webview выполняет наш service worker,
 *      токена не несёт вовсе (разбор — в шапке `src/lib/native-shell.ts`).
 *      Поэтому `src/proxy.ts` кладёт то же число в отдельную куку
 *      {@link NATIVE_SHELL_VERSION_COOKIE}, и дальше версия доезжает с
 *      любым запросом своего источника.
 *
 * ПОЧЕМУ КУКА ОТДЕЛЬНАЯ, А НЕ НОВОЕ ЗНАЧЕНИЕ СТАРОЙ. У старой куки
 * значение ровно одно и сличается оно строгим равенством
 * (`isNativeShellRequest`). Положи мы туда «3» — оболочка 7202 и
 * оболочка 3 стали бы для сервера РАЗНЫМИ вещами, и один и тот же
 * человек на обновлении на секунду перестал бы быть оболочкой вовсе:
 * нативная витрина исчезла бы, а веб-касса появилась. Признак и версия —
 * разные вопросы, и мешать их в одно поле нельзя.
 *
 * ПОЧЕМУ У ОТСУТСТВИЯ ВЕРСИИ ЕСТЬ ИМЯ, А НЕ `null`. Бесверсионной
 * оболочки существует ровно ОДНА — 7202, `versionCode 2`: до неё
 * опубликованных пакетов не было ни одного, а все следующие версию
 * несут. Значит «оболочка без версии» — это не «неизвестно сколько», а
 * именно двойка, и записывать её догадкой на стороне вызывающего значило
 * бы завести эту догадку в каждом месте по отдельности.
 */

/** Кука, в которой едет ЧИСЛО версии оболочки. Значение — десятичное
 *  целое, ничего больше. Не httpOnly по той же причине, что и признак:
 *  секрета в ней нет. */
export const NATIVE_SHELL_VERSION_COOKIE = "rf_shell_version";

/** Версия оболочки, которая про свою версию не говорит. Такая ровно
 *  одна — 7202 (`versionCode 2`, `versionName 1.0.1`), залитая в
 *  закрытый тест Google Play 21.09.2026. */
export const LEGACY_NATIVE_SHELL_VERSION = 2;

/**
 * Минимальная поддерживаемая версия оболочки.
 *
 * РАВНА ВЕРСИИ 7202 НАМЕРЕННО. Тестировщики обновляются не в один день, и
 * обе сборки живут одновременно; подними это число вперёд выката — и в
 * день включения часть людей получила бы блокирующий экран вместо
 * приложения. Число двигается ОСОЗНАННО и отдельной правкой, а не вместе
 * с очередной сборкой.
 */
export const MIN_SUPPORTED_NATIVE_SHELL_VERSION = 2;

/**
 * `…RFNativeShell/3` → "3". Косая черта и число, и ничего кроме: токен
 * без них — это законная старая оболочка, а не поломка.
 *
 * РАЗБОР СТРОКАМИ, А НЕ СОБРАННОЙ РЕГУЛЯРКОЙ, и это не вкус. Правило
 * 7.210 (`src/lib/data-into-parser.test.ts`): выражение, собранное
 * подстановкой значения, обязано это значение экранировать — иначе
 * однажды подставится то, в чём есть `(` или `+`, и шаблон начнёт
 * означать не то, что написано. Здесь подстановки нет вовсе: место
 * токена ищется `indexOf`, а регулярка стоит только над цифрами хвоста
 * и записана литералом.
 */
function versionDigitsAfterToken(userAgent: string): string | null {
  const at = userAgent.indexOf(`${NATIVE_USER_AGENT_TOKEN}/`);
  if (at === -1) return null;
  const tail = userAgent.slice(at + NATIVE_USER_AGENT_TOKEN.length + 1);
  return /^\d+/.exec(tail)?.[0] ?? null;
}

function parsePositiveInt(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Версия оболочки, открывшей страницу, — или `null`, если это браузер.
 *
 * Порядок источников не случаен: токен говорит про ЭТОТ запрос, кука —
 * про то, что оболочка сказала когда-то раньше. Расходятся они ровно на
 * обновлении приложения, и правым там обязан быть токен.
 *
 * @param userAgent    заголовок `User-Agent` запроса
 * @param versionCookie значение куки {@link NATIVE_SHELL_VERSION_COOKIE}
 * @param shellCookie   значение куки {@link NATIVE_SHELL_COOKIE}
 */
export function nativeShellVersion({
  userAgent,
  versionCookie,
  shellCookie,
}: {
  userAgent?: string | null;
  versionCookie?: string | null;
  shellCookie?: string | null;
}): number | null {
  if (userAgentIsNativeShell(userAgent)) {
    const fromToken =
      typeof userAgent === "string" ? parsePositiveInt(versionDigitsAfterToken(userAgent)) : null;
    // Токен есть, числа при нём нет — это 7202 и только она.
    return fromToken ?? LEGACY_NATIVE_SHELL_VERSION;
  }
  const fromCookie = parsePositiveInt(versionCookie);
  if (fromCookie !== null) return fromCookie;
  // Признак оболочки без версии: запрос из service worker старой сборки.
  if (shellCookie === NATIVE_SHELL_COOKIE_VALUE) return LEGACY_NATIVE_SHELL_VERSION;
  return null;
}

/** true, если страницу открыла оболочка СТАРШЕ или РАВНАЯ названной
 *  версии. Браузер — всегда false: web не «старая оболочка», он вообще
 *  не оболочка. */
export function nativeShellAtLeast(
  version: number,
  source: Parameters<typeof nativeShellVersion>[0],
): boolean {
  const actual = nativeShellVersion(source);
  return actual !== null && actual >= version;
}
