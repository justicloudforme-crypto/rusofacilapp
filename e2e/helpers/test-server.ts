/**
 * СКОЛЬКО ТЕСТОВЫЙ СЕРВЕР ДЕРЖИТ ПРОСТАИВАЮЩЕЕ СОЕДИНЕНИЕ — ДОЛГ 412 (с влитыми 415, 422, 423), ЗАХОД 7.306.
 *
 * Что было. Пять случаев за 19–24.11.2026, три файла тестов
 * (`lesson-credit-best-attempt` ×3, `search-demand-log`, `access-code`):
 * СОБСТВЕННЫЙ запрос теста (`context.request` / `request`) падал с
 * «apiRequestContext.get: read ECONNRESET», тест проходил повтором.
 *
 * Причина — гонка за простаивающее соединение, и она измерена:
 *  - клиент запросов Playwright (`APIRequestContext`) держит соединения
 *    в общем пуле с `keepAlive: true` и БЕЗ срока: подсказку сервера
 *    `Keep-Alive: timeout=5` Node применяет, только если у агента задан
 *    свой `timeout` (`Agent.keepSocketAlive`: «hint < agentTimeout»; у
 *    Playwright он 0), — замер 7.306: соединение, простоявшее 4,5 / 5,5 /
 *    5,9 с, берётся снова;
 *  - `next start` — обычный сервер Node: простаивающее соединение он
 *    закрывает через `keepAliveTimeout` (5 с) + `keepAliveTimeoutBuffer`
 *    (1 с) = 6 с;
 *  - запрос, отправленный в то же мгновение, когда сервер закрывает
 *    соединение, получает RST → «read ECONNRESET». Трассы CI: перед
 *    оборванным запросом соединение простаивало 5,999 / 5,958 / 5,989 /
 *    5,933 с (в пятом случае соединение пришло из пула от прошлого теста).
 *    Стенд 7.306 (Node 22.23.4 — как в CI, Playwright 1.62.1): простой
 *    5 995–5 998 мс → ровно «apiRequestContext.get: read ECONNRESET».
 *
 * Браузер такой запрос на заново открытом соединении молча повторяет сам,
 * поэтому обрывались только запросы самих тестов, а не страницы.
 *
 * Правка — на стороне стенда, не сайта: сервер тестов держит простаивающее
 * соединение дольше, чем живёт само задание CI (у задания e2e срока нет —
 * значит, предел GitHub 6 ч). Тогда закрывает соединение только клиент, и
 * гонки нет. Повторы не тронуты, сервер не заглушён, на боевом сайте
 * (Vercel) ничего не меняется.
 *
 * Значение обязано быть меньше 2^31 − 1 мс за вычетом запаса Node (1 с):
 * больше — Node пишет TimeoutOverflowWarning и ставит срок 1 мс, то есть
 * закрывал бы соединения сразу. Это тоже проверяет сторож
 * `e2e/test-server-keepalive.spec.ts`.
 */
export const TEST_SERVER_KEEP_ALIVE_MS = 6 * 60 * 60 * 1000;

/** Предел таймера Node (мс) — больше него `setTimeout` превращается в 1 мс. */
export const NODE_TIMER_MAX_MS = 2 ** 31 - 1;

/**
 * Судья: по ответу сервера (заголовки `connection`/`keep-alive`) сказать,
 * может ли сервер сам закрыть простаивающее соединение раньше, чем кончится
 * задание CI. Возвращает список нарушений (пустой — нарушений нет).
 */
export function keepAliveProblems(headers: Record<string, string>, minSeconds: number): string[] {
  const problems: string[] = [];
  const connection = (headers["connection"] ?? "").toLowerCase();
  const hint = headers["keep-alive"];
  if (connection === "close") problems.push("сервер закрывает соединение после каждого ответа (Connection: close)");
  if (!hint) {
    problems.push("в ответе нет заголовка Keep-Alive — срок простоя сервера не виден, судить нечем");
    return problems;
  }
  const match = /timeout=(\d+)/i.exec(hint);
  if (!match) {
    problems.push(`заголовок Keep-Alive без срока: «${hint}»`);
    return problems;
  }
  const seconds = Number(match[1]);
  if (seconds < minSeconds) {
    problems.push(
      `сервер закрывает простаивающее соединение через ${seconds} с (Keep-Alive: ${hint}) — раньше, чем кончается задание CI (${minSeconds} с); ` +
        "клиент Playwright держит соединения без срока, и запрос на закрываемом соединении получит «read ECONNRESET» (долг 412)",
    );
  }
  if (seconds * 1000 + 1000 >= NODE_TIMER_MAX_MS) {
    problems.push(`срок ${seconds} с больше предела таймера Node — Node поставит 1 мс и будет закрывать соединения сразу`);
  }
  return problems;
}
