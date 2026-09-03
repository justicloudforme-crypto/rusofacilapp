import { test, expect } from "./helpers/test";

/**
 * СТОРОЖ: отказ регистрации service worker не имеет права дойти до окна
 * как НЕОБРАБОТАННЫЙ отказ промиса.
 *
 * Что здесь ловится. 01.09.2026 в Sentry пришла SecurityError «Script
 * https://rusofacilapp.com/sw.js load failed» из Safari 26.5, handled=no,
 * mechanism auto.browser.global_handlers.onunhandledrejection. Обработчик в
 * SerwistRegister.tsx на тот момент уже стоял и отрабатывал — а событие
 * всё равно уходило, потому что регистрацию делал ВТОРОЙ, невидимый в
 * репозитории вызов: `@serwist/next` подшивает в начало входного чанка свой
 * модуль sw-entry, и его `window.serwist.register()` не обёрнут ничем.
 * Опция плагина `register` по умолчанию `true`; `register={false}` у
 * <SerwistProvider> гасит другой вызов и на плагин не влияет. Починка —
 * `register: false` в next.config.ts.
 *
 * Замер, а не рассуждение: `navigator.serviceWorker` подменяется так, как
 * он выглядит в приватном окне Safari — объект СУЩЕСТВУЕТ, а register()
 * отвергает промис с SecurityError.
 *
 * Позитивный контроль — второй тест: голый отвергнутый промис на той же
 * странице обязан быть пойман слушателем. Без него «ноль отказов» в первом
 * тесте не значило бы ничего (PROGRESS.md 4.1).
 */

// Регистрация живёт в [lang]/layout.tsx и одинакова на всех страницах,
// поэтому берётся главная, а не страница пазла из боевого события: у той
// свой пропуск (подписка), и тест перестал бы мерить то, ради чего он есть.
const PUZZLE_URL = "/es";

const PLANT_REJECTING_REGISTER = () => {
  (window as unknown as { __unhandled: string[] }).__unhandled = [];
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { name?: string; message?: string } | undefined;
    (window as unknown as { __unhandled: string[] }).__unhandled.push(
      reason?.name ? `${reason.name}: ${reason.message}` : String(event.reason),
    );
  });
  const rejection = () =>
    Promise.reject(
      typeof DOMException === "function"
        ? new DOMException("Script http://localhost/sw.js load failed", "SecurityError")
        : Object.assign(new Error("Script load failed"), { name: "SecurityError" }),
    );
  const stub = {
    controller: null,
    ready: new Promise(() => {}),
    register: rejection,
    getRegistrations: () => Promise.resolve([]),
    addEventListener() {},
    removeEventListener() {},
  };
  try {
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, get: () => stub });
  } catch {
    // Движок не даёт подменить — тест ниже это увидит по serviceWorkerPresent.
  }
};

test("отказ register() не уходит в окно необработанным", async ({ page }) => {
  await page.addInitScript(PLANT_REJECTING_REGISTER);
  await page.goto(PUZZLE_URL);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);

  const present = await page.evaluate(() => "serviceWorker" in navigator);
  expect(present, "подсадка не встала — замер недействителен").toBe(true);

  const unhandled = await page.evaluate(() => (window as unknown as { __unhandled: string[] }).__unhandled);
  expect(unhandled).toEqual([]);
});

test("позитивный контроль: подсаженный отвергнутый промис ловится", async ({ page }) => {
  await page.addInitScript(PLANT_REJECTING_REGISTER);
  await page.addInitScript(() => {
    // Голый отвергнутый промис без единого обработчика — ровно то, чем был
    // вызов из sw-entry. Слушатель обязан его увидеть.
    setTimeout(() => {
      void Promise.reject(Object.assign(new Error("контрольный отказ"), { name: "ControlError" }));
    }, 400);
  });
  await page.goto(PUZZLE_URL);
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);

  const unhandled = await page.evaluate(() => (window as unknown as { __unhandled: string[] }).__unhandled);
  expect(unhandled.join(" ")).toContain("ControlError");
});
