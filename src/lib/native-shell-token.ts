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
