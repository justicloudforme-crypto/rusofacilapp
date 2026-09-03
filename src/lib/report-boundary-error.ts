/**
 * Что граница ошибок отправляет в Sentry, а что — нет.
 *
 * До 02.09.2026 все шесть `error.tsx` делали одно и то же: `captureException(error)`
 * без разбора. Замерено в WebKit 02.09.2026: этот вызов даёт ровно ту
 * подпись, что стоит в боевом событии — `mechanism: generic, handled: true`,
 * `transaction: /:lang/word-games/:type/:level/:sequence`. То есть «handled = yes»
 * в отчёте — это наши собственные границы, а не чужая библиотека.
 *
 * ПРАВИЛО. Глушится ТОЛЬКО отменённое: запрос, оборванный уходом со
 * страницы или сменой маршрута. Такой отказ ничего не говорит о сайте —
 * его вызвал сам читатель, закрыв вкладку или нажав «назад» посреди
 * загрузки, — и на квоту (5000 событий в месяц) он тратится зря.
 *
 * Настоящий отказ сети или API остаётся видимым. Разница между ними — не
 * в тексте ошибки: WebKit пишет «TypeError: Load failed» и там, и там.
 * Разница в СОСТОЯНИИ СТРАНИЦЫ в момент отказа: документ, который уже
 * уходит (`pagehide` случился) или спрятан (`visibilityState === "hidden"`),
 * рвёт свои запросы сам. Поэтому решение принимается по состоянию, а не по
 * строке — строка врёт одинаково в обоих случаях.
 *
 * Отдельно и всегда глушится `AbortError`: это единственный отказ, который
 * по определению значит «мы сами отменили».
 */

/** Ставится один раз на модуль: `pagehide` уже случился — документ уходит. */
let pageIsUnloading = false;

if (typeof window !== "undefined") {
  // `pagehide`, а не `beforeunload`: на iOS Safari второй не срабатывает
  // при уходе в другое приложение или при закрытии вкладки жестом.
  window.addEventListener("pagehide", () => {
    pageIsUnloading = true;
  });
  // Возврат из bfcache — страница снова живая, и следующий отказ уже
  // настоящий. Без этого одна отмена глушила бы всё до конца сессии.
  window.addEventListener("pageshow", () => {
    pageIsUnloading = false;
  });
}

function isAbort(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name: unknown }).name) : "";
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return name === "AbortError" || /aborted|cancell?ed/i.test(message);
}

function isNetworkFailure(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  // «Load failed» — WebKit, «Failed to fetch» — Chromium, «NetworkError…» — Firefox.
  return /load failed|failed to fetch|networkerror when attempting to fetch/i.test(message);
}

export interface PageState {
  unloading: boolean;
  hidden: boolean;
}

function currentPageState(): PageState {
  return {
    unloading: pageIsUnloading,
    hidden: typeof document !== "undefined" && document.visibilityState === "hidden",
  };
}

/**
 * true — событие отправлять НЕ надо: это запрос, оборванный уходом со
 * страницы. Состояние страницы передаётся явным аргументом, чтобы правило
 * можно было проверить тестом, а не только в браузере.
 */
export function isCancelledByLeaving(error: unknown, page: PageState = currentPageState()): boolean {
  if (isAbort(error)) return true;
  if (!isNetworkFailure(error)) return false;
  return page.unloading || page.hidden;
}
