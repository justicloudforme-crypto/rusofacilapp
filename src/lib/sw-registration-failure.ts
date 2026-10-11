/**
 * Ожидаемый ли это отказ регистрации service worker.
 *
 * Отдельный файл, а не строчка в компоненте, ровно по одной причине: у
 * правила должен быть тест. Оно решает, что уйдёт в Sentry, а квота
 * проекта — 5000 ошибок в месяц, и ошибиться здесь можно в обе стороны:
 * пропустить лишнее — потерять квоту, задавить лишнее — ослепнуть.
 *
 * ОЖИДАЕМОЕ — это «браузер отказался ставить worker». Приватное окно
 * Safari (SecurityError, замерено 02.09.2026), выключенные в профиле
 * service workers, режим блокировки, расширение-блокировщик, отсутствие
 * сети в момент загрузки sw.js. Ни один из этих случаев не меняет для
 * читателя ничего: worker добавляет офлайн-кэш, и без него страница
 * работает точно так же. Такое пишется в консоль и НЕ уходит в Sentry.
 *
 * НЕОЖИДАННОЕ — всё остальное. Прежде всего наша собственная поломка:
 * TypeError внутри @serwist/window (кроме чтения `.waiting` у отсутствующей
 * регистрации — с 7.262 это ожидаемый класс, см. `isMissingRegistrationError`),
 * синтаксическая ошибка в собранном sw.js, сломанный ответ на /sw.js.
 * Такое уходит в Sentry как handled=true с тегом — потому что это уже
 * дефект, а не обстоятельство.
 */

/** Имена DOMException, которыми браузеры отвечают «не буду ставить». */
const EXPECTED_DOM_EXCEPTION_NAMES = new Set([
  "SecurityError", // приватное окно Safari; блокировщик; недоверенный контекст
  "NotSupportedError", // service workers выключены в профиле
  "NotAllowedError",
  "AbortError", // страница ушла до конца регистрации
  "InvalidStateError",
]);

/** Формулировки «скрипт не загрузился» у трёх движков. */
const EXPECTED_MESSAGES =
  /load failed|failed to fetch|failed to register a serviceworker|networkerror|network error|the operation is insecure|service ?workers? (are|is) (disabled|not supported)|the document is in an invalid state/i;

/**
 * РЕГИСТРАЦИИ НЕТ — ЗАГЛУШКА ВМЕСТО БРАУЗЕРА (10.10.2026, заход 7.262).
 *
 * Sentry `JAVASCRIPT-NEXTJS-1B`: «Service worker registration for /sw.js was
 * refused — TypeError: Cannot read properties of undefined (reading
 * 'waiting')», Chrome 145 / Windows, `GET /es`, 1 событие. Откуда оно,
 * прочитано в коде: `Serwist.register()` (@serwist/window,
 * dist/index.mjs, стр. 170–177) берёт `navigator.serviceWorker.register()` и
 * СРАЗУ читает у результата `.waiting`. Настоящий браузер отвечает либо
 * объектом регистрации, либо отказом — `undefined` не отдаёт никогда.
 * `undefined` отдаёт заглушка: Playwright с `serviceWorkers: 'block'`
 * (playwright-core подменяет `register` на `async () => undefined`),
 * расширения-блокировщики, обвязки автоматизации. То есть это тот же класс,
 * что и «браузер отказался ставить worker»: для читателя ничего не
 * меняется, офлайн-кэша просто нет.
 *
 * Узнаётся по тексту TypeError трёх движков — только чтение `.waiting` у
 * `undefined`/`null`; любое другое свойство (`scriptURL`, `active`) — уже не
 * этот случай и уходит в Sentry как прежде.
 */
const MISSING_REGISTRATION =
  /cannot read propert(?:y|ies) of (?:undefined|null) \(reading 'waiting'\)|(?:undefined|null) is not an object \(evaluating '[\w$.]*\.waiting'\)|can't access property "waiting",? [\w$.]+ is (?:undefined|null)/i;

export function isMissingRegistrationError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return name === "TypeError" && MISSING_REGISTRATION.test(message);
}

export function isExpectedServiceWorkerFailure(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if (isMissingRegistrationError(error)) return true;
  const name = typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  const message =
    typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);

  if (EXPECTED_DOM_EXCEPTION_NAMES.has(name)) return true;
  // `instanceof DOMException` намеренно НЕ используется: у события,
  // прилетевшего из другого realm (iframe, расширение), проверка на
  // конструктор ложно даёт false, а имя переживает границу.
  return EXPECTED_MESSAGES.test(message);
}
