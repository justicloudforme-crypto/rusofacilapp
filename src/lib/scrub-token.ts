/**
 * ВТОРАЯ СТЕНА ДОЛГА 164: одноразовый токен не уезжает в Sentry ни при
 * каком стечении обстоятельств.
 *
 * Первая стена — сам перенос: токен едет во фрагменте адреса, которого
 * сервер не видит, и стирается из адреса сразу после чтения
 * (src/components/auth/HashTokenForm.tsx). Но `location.href`, который
 * браузерный SDK прикладывает к каждому событию, включает и фрагмент
 * тоже, а между загрузкой страницы и первым эффектом React есть окно в
 * несколько миллисекунд. Ошибка, случившаяся в это окно, увезла бы
 * действующий токен. Здесь это окно закрывается.
 *
 * Стена нарочно ТУПАЯ и работает по тексту, а не по разбору адреса:
 * `beforeSend` получает и адреса страниц, и адреса запросов в крошках, и
 * строки, которые адресами только выглядят. Разбор через `new URL` на
 * половине из них бросает, а здесь важнее не пропустить, чем красиво
 * разобрать.
 *
 * Чистится значение, а не сам параметр: длина и форма адреса остаются
 * узнаваемыми, и по событию по-прежнему видно, НА КАКОЙ странице упало.
 */
const TOKEN_PARAM = /([?#&](?:token|t)=)[^&#\s"']+/gi;

export function scrubTokenFromUrl(value: string): string {
  return value.replace(TOKEN_PARAM, "$1[вырезано]");
}

/** Тот же проход по всем местам события Sentry, где может лежать адрес. */
export function scrubTokensFromEvent<T>(event: T): T {
  const e = event as unknown as {
    request?: { url?: unknown; headers?: Record<string, unknown> };
    breadcrumbs?: Array<{ data?: Record<string, unknown>; message?: unknown }>;
    transaction?: unknown;
  };
  if (e.request && typeof e.request.url === "string") e.request.url = scrubTokenFromUrl(e.request.url);
  if (e.request?.headers) {
    for (const key of Object.keys(e.request.headers)) {
      const header = e.request.headers[key];
      if (typeof header === "string") e.request.headers[key] = scrubTokenFromUrl(header);
    }
  }
  if (typeof e.transaction === "string") e.transaction = scrubTokenFromUrl(e.transaction);
  for (const crumb of e.breadcrumbs ?? []) {
    if (typeof crumb.message === "string") crumb.message = scrubTokenFromUrl(crumb.message);
    for (const key of Object.keys(crumb.data ?? {})) {
      const field = crumb.data?.[key];
      if (typeof field === "string" && crumb.data) crumb.data[key] = scrubTokenFromUrl(field);
    }
  }
  return event;
}
