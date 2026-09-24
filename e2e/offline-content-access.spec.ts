import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ОФЛАЙН-2, ВТОРАЯ ПОЛОВИНА: ЧТО НА ТЕЛЕФОНЕ НЕ ОСТАЁТСЯ И ГДЕ СТОИТ
 * КАРКАС — ЗАХОД 7.229.
 *
 * ПОЧЕМУ ЭТИ ДВА ТЕСТА ЖИВУТ ОТДЕЛЬНО ОТ `offline-saved-content.spec.ts`,
 * И ЭТО ЗАМЕР, А НЕ ВКУСОВЩИНА. Та спека выключает сеть и ходит по
 * адресам — а WebKit под Playwright навигацию при `setOffline(true)` до
 * документа не доводит (прогон 24.09.2026: из четырёх тестов падают
 * ДВА, оба про навигацию без сети; тот же класс, что у трёх проб,
 * вынесенных раньше), поэтому вся она стоит в `testIgnore` проекта
 * `mobile-iphone`. Здешние два теста сети НЕ выключают: один судит по
 * тому, что легло в кеш при живой сети, второй — по геометрии каркаса.
 * Значит они могут и обязаны идти на ОБОИХ движках, и вынести их вместе
 * с остальными значило бы потерять покрытие без причины.
 */

test("платное: закрытая страница на телефоне не сохраняется, а сохранённая стирается, когда доступа не стало", async ({
  page,
}) => {
  test.setTimeout(180_000);

  const savedLesson = () =>
    page.evaluate(async () => {
      for (const name of await caches.keys()) {
        if (!/^rf-pages-content-[a-z0-9]+$/.test(name)) continue;
        const hit = await (await caches.open(name)).match("/ru/courses/a1/2", { ignoreVary: true });
        if (hit) return true;
      }
      return false;
    });

  // (а) ЧЕЛОВЕК БЕЗ ДОСТУПА. Страницу урока ему показывают — теория
  //     открыта всем ради индексации (7.226, часть 6), — но закрытая
  //     часть не отдана, и копии на телефоне остаться не должно.
  await loginWithoutSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto("/ru/courses/a1/2");
  await page.waitForTimeout(1200);
  const lockedMarkup = await page.content();
  expect(
    lockedMarkup.includes('"isAccessibleForFree":false'),
    "сервер не пометил страницу закрытой — тогда правило проверять нечем",
  ).toBe(true);
  expect(await savedLesson(), "закрытый урок лёг на телефон — платное стало доступно офлайн кому угодно").toBe(false);

  // (б) ДОСТУП ВЫДАН — копия появляется. Это вторая сторона замера: без
  //     неё «не сохранилось» означало бы «не сохраняется никогда».
  const granted = await page.context().request.post("/api/test/grant-subscription", { data: {} });
  expect(granted.ok()).toBe(true);
  await page.goto("/ru/courses/a1/2");
  await page.waitForTimeout(1200);
  expect(await savedLesson(), "у подписчика урок на телефоне не сохранился — офлайн-2 не работает вовсе").toBe(true);

  // (в) ДОСТУПА НЕ СТАЛО — при первом же заходе С СЕТЬЮ сервер печатает
  //     закрытую страницу, и прежняя копия обязана исчезнуть. Ровно это
  //     и означает «подписка кончилась».
  const revoked = await page.context().request.post("/api/test/revoke-subscription", { data: {} });
  expect(revoked.ok(), "отзыв доступа не состоялся — третью сторону замера проверять нечем").toBe(true);
  await page.goto("/ru/courses/a1/2");
  await page.waitForTimeout(1500);
  expect(
    await savedLesson(),
    "подписка кончилась, а сохранённый урок остался на телефоне — доступ за один месяц стал вечным",
  ).toBe(false);
});

test("каркас без сети стоит НИЖЕ строки состояния и ВЫШЕ кнопок навигации", async ({ page }) => {
  test.setTimeout(90_000);

  /**
   * НАХОДКА ВЛАДЕЛЬЦА 24.09.2026 (POCO, сборка 1.0.4): каркас рисовался
   * ПОД системными полосами — имя «RusoFácilapp» поверх часов, подписи
   * вкладок под кнопками ◼ ● ◀. Настоящие страницы на том же телефоне
   * стояли правильно.
   *
   * Величины полос в браузере равны нулю ВСЕГДА: их присылает
   * `MainActivity.pushSafeAreaInsets` переменными `--android-inset-*`.
   * Поэтому здесь они подставляются РУКАМИ, ровно тем же способом и с
   * теми же числами, что у POCO, — и замер двусторонний: без них каркас
   * стоит по краям окна (это браузер, и так и должно быть), с ними —
   * отодвинут ровно на присланную величину.
   */
  await page.setViewportSize({ width: 393, height: 780 });
  await page.goto("/offline.html");
  await page.waitForTimeout(400);

  const boxes = () =>
    page.evaluate(() => {
      const brand = document.querySelector("header .brand")!.getBoundingClientRect();
      const tab = document.querySelector("nav.tabs a")!.getBoundingClientRect();
      return { brandTop: Math.round(brand.top), tabBottom: Math.round(tab.bottom), height: window.innerHeight };
    });

  const bare = await boxes();
  expect(bare.brandTop, "в браузере полос нет — шапка обязана стоять у самого верха").toBeLessThan(27);
  expect(bare.tabBottom, "в браузере полос нет — панель обязана стоять у самого низа").toBe(bare.height);

  await page.evaluate(() => {
    const style = document.documentElement.style;
    style.setProperty("--android-inset-top", "27px");
    style.setProperty("--android-inset-bottom", "48px");
  });
  await page.waitForTimeout(200);

  const withBars = await boxes();
  expect(
    withBars.brandTop,
    "имя приложения по-прежнему лезет под часы — ровно то, что владелец снял 24.09.2026",
  ).toBeGreaterThanOrEqual(27);
  expect(
    withBars.tabBottom,
    "подписи вкладок по-прежнему под кнопками навигации — ровно то, что владелец снял 24.09.2026",
  ).toBeLessThanOrEqual(withBars.height - 48);
});
