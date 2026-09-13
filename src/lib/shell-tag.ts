/**
 * Метка «это пришло из нативной оболочки», которой помечается КАЖДОЕ
 * событие Sentry.
 *
 * ЗАЧЕМ (долг 174, заход 7.189). Оболочка Capacitor не несёт внутри себя
 * сайт: она грузит боевой адрес удалённо и запрашивает те же страницы,
 * что и браузер. Из этого следует неприятное: ошибка, случившаяся в
 * приложении на телефоне, приезжала в Sentry НЕОТЛИЧИМОЙ от ошибки в
 * мобильном браузере — тот же адрес страницы, тот же движок, тот же
 * `environment` (`vercel-production`). То есть вопрос «сломалось ли что-то
 * именно у установивших приложение» в Sentry нельзя было даже задать, а
 * это единственный канал, по которому о поломке в оболочке вообще можно
 * узнать: экран у ученика один, жалоб он не пишет.
 *
 * Метка ставится по признаку, который оболочка УЖЕ шлёт и который был
 * введён для другого (долг 79): токен в User-Agent. Ничего нового в
 * запрос не добавляется, и веб-ответ не меняется ни на байт.
 *
 * Почему литерал токена написан здесь ЗАНОВО, а не импортирован из
 * `src/lib/native-shell.ts`: тот модуль помечен `import "server-only"` и
 * в браузерную сборку не попадает вовсе, а метка нужна в первую очередь
 * браузерному SDK. Третий литерал того же токена лежит в
 * `capacitor.config.ts`. Все три сличает `npm run check:native-shell` —
 * тем же приёмом, каким `check:native-payments` сличает два первых.
 */

/** Тот же токен, что `NATIVE_USER_AGENT_TOKEN` в `src/lib/native-shell.ts`
 *  и `appendUserAgent` в `capacitor.config.ts`. */
export const NATIVE_SHELL_UA_TOKEN = "RFNativeShell";

/** Имя метки в Sentry. */
export const SHELL_TAG_KEY = "client";

export const SHELL_TAG_NATIVE = "native-shell";
export const SHELL_TAG_WEB = "web";

export type ShellTag = typeof SHELL_TAG_NATIVE | typeof SHELL_TAG_WEB;

/** Метка по строке User-Agent. Пустая строка и `null` — это «веб»: метка
 *  обязана иметь значение ВСЕГДА, иначе в Sentry появится третья,
 *  необъяснимая категория «без метки», и фильтр «только телефон» опять
 *  перестанет делить события надвое. */
export function shellTagFromUserAgent(userAgent: string | null | undefined): ShellTag {
  return typeof userAgent === "string" && userAgent.includes(NATIVE_SHELL_UA_TOKEN)
    ? SHELL_TAG_NATIVE
    : SHELL_TAG_WEB;
}

/** User-Agent серверного события Sentry. Имена заголовков регистра не
 *  держат (ПРАВИЛА ЗАМЕРА 4.2 — то же правило, что для атрибутов HTML),
 *  поэтому ключ ищется регистронезависимо, а не по строке `"user-agent"`. */
export function userAgentFromSentryEvent(event: {
  request?: { headers?: Record<string, string | undefined> | undefined } | undefined;
}): string | null {
  const headers = event.request?.headers;
  if (!headers) return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "user-agent" && typeof value === "string") return value;
  }
  return null;
}

/**
 * Ставит метку на событие и возвращает его же. Уже стоящую метку НЕ
 * перезаписывает: событие, помеченное ближе к месту ошибки, знает о себе
 * больше, чем общий `beforeSend`.
 */
export function tagShellOnEvent<T extends { tags?: Record<string, unknown> | undefined }>(
  event: T,
  userAgent: string | null | undefined,
): T {
  const existing = event.tags?.[SHELL_TAG_KEY];
  if (typeof existing === "string" && existing) return event;
  event.tags = { ...event.tags, [SHELL_TAG_KEY]: shellTagFromUserAgent(userAgent) };
  return event;
}
