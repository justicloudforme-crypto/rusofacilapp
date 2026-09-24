import { test, expect } from "./helpers/test";
import type { Page } from "@playwright/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * КАРКАС БЕЗ СЕТИ — ЗАХОД 7.227 (ОФЛАЙН-1).
 *
 * ЧТО БЫЛО ИЗМЕРЕНО ДО ПРАВКИ, 23.09.2026, на собранном приложении
 * (Chromium, профиль Pixel 7, `setOffline(true)`): переход на адрес,
 * которого нет в кеше, давал экран, у которого `header` отсутствует, а
 * ссылок **0**. Уйти с него было некуда — приложение выглядело умершим,
 * и это главный риск отказа Google Play по «минимальной
 * функциональности».
 *
 * ЧТО ЗАПИРАЕТСЯ ЗДЕСЬ: шапка, пять вкладок нижней панели, язык по
 * адресу, работающее меню (переход на адрес, который в кеше ЕСТЬ,
 * открывает настоящую страницу) и возврат сети без ручной перезагрузки.
 *
 * ПОЧЕМУ ЭТА ПРОБА ВООБЩЕ ВОЗМОЖНА, хотя `e2e/offline.spec.ts` с августа
 * говорит обратное. Там записано, что `context.setOffline(true)` вместе с
 * навигацией, перехваченной воркером, даёт «Navigation interrupted by
 * another navigation». Перемерено 23.09.2026: отказ приходит в
 * `page.goto`, а СТРАНИЦА при этом отрисована верно — то есть ронять
 * пробу должен не отказ навигации, а содержимое документа. Поэтому
 * каждый переход здесь обёрнут, а утверждения сняты с того, что в
 * документе, и только с него.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ — В ТОМ ЖЕ ПРОГОНЕ, последним шагом первого теста:
 * регистрация воркера снимается, кеши стираются, сеть остаётся
 * выключенной — и каркаса не должно быть. Без него «каркас показан»
 * и «прибор видит что угодно» читались бы одинаково.
 */

/**
 * ПЕРЕХОД БЕЗ СЕТИ — С ПОВТОРОМ, И ЭТО ЗАМЕР ПРИБОРА, А НЕ ПРОДУКТА.
 *
 * Снято 23.09.2026, четыре прогона подряд на одной и той же сборке:
 * ПЕРВЫЙ `page.goto` при выключенной сети отказывает «Navigation … is
 * interrupted by another navigation» 2 раза из 2, ВТОРОЙ проходит 2 раза
 * из 2 и отдаёт правильный документ. Это ровно та ненадёжность, которая
 * записана в `e2e/offline.spec.ts` с августа: Playwright не умеет
 * отследить навигацию, ответ на которую синтезировал воркер. Повторяется
 * ПОДГОТОВКА (человек в этот момент просто видит экран), а утверждения
 * снимаются с документа — и только с него.
 */
async function visit(page: Page, path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const arrived = await page
      .goto(path, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (arrived) return;
    await page.waitForTimeout(500);
  }
}

/** Что сейчас в документе. Каркас узнаётся по ПРИЗНАКУ, а не по тексту:
 *  текст меняется вместе с состоянием (долг 278). */
async function surface(page: Page) {
  return page.evaluate(() => ({
    shell: document.body?.dataset.offlineShell === "1",
    header: Boolean(document.querySelector("header")),
    tabs: document.querySelectorAll("nav.tabs a").length,
    lang: document.documentElement.lang,
    text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim(),
  }));
}

test("без сети каркас на месте, меню работает, язык — по адресу, а сеть вернулась — повтор сам", async ({
  page,
  context,
}) => {
  // Бюджет теста называется числом, потому что ожиданий здесь много и они
  // длинные: установка воркера, три перехода без сети (у каждого свой
  // повтор) и возврат сети. Без этого отказ пришёл бы по общему потолку в
  // 30 с и указал бы на невиновный вызов (правило `check:e2e-live-probes`).
  test.setTimeout(180_000);

  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  // Один адрес кладётся в кеш намеренно: меню без сети обязано не просто
  // рисоваться, а КУДА-ТО ВЕСТИ.
  await page.goto("/ru/courses");
  await page.waitForTimeout(700);

  await context.setOffline(true);

  await visit(page, "/ru/glossary");
  await expect(page.locator('h1[data-state="offline"]'), "экран не дошёл до состояния «нет соединения»").toBeVisible({
    timeout: 20_000,
  });
  const offlineScreen = await surface(page);
  expect(offlineScreen.shell, "без сети показан не каркас").toBe(true);
  expect(offlineScreen.header, "у каркаса нет шапки — ровно состояние ДО захода 7.227").toBe(true);
  expect(offlineScreen.tabs, "вкладок в нижней панели не пять").toBe(5);
  expect(offlineScreen.lang, "язык каркаса взят не из адреса").toBe("ru");
  expect(offlineScreen.text, "каркас заговорил по-испански на русском адресе").toMatch(/Нет соединения/);
  expect(offlineScreen.text, "каркас снова печатает две локали разом").not.toMatch(/sin conexión/i);

  // МЕНЮ РАБОТАЕТ: уходим по вкладке на адрес, который в кеше есть.
  await page.getByRole("link", { name: "Курсы" }).click();
  await page.waitForURL("**/ru/courses", { timeout: 20_000 }).catch(() => undefined);
  const fromCache = await surface(page);
  expect(fromCache.shell, "вкладка меню привела снова в каркас — значит меню никуда не ведёт").toBe(false);
  expect(fromCache.text, "по вкладке открылась не страница курсов").toMatch(/Курсы|курс/i);

  // СЕТЬ ВЕРНУЛАСЬ — БЕЗ РУЧНОЙ ПЕРЕЗАГРУЗКИ. Возвращаемся на адрес, где
  // сейчас каркас, включаем сеть и НИЧЕГО не нажимаем.
  await visit(page, "/ru/glossary");
  await expect(page.locator("body[data-offline-shell]")).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
  await page.waitForFunction(() => document.body?.dataset.offlineShell !== "1", null, { timeout: 30_000 });
  const back = await surface(page);
  expect(back.shell, "после возврата сети страница осталась каркасом").toBe(false);

  // ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ПРОГОНЕ: без воркера и без precache
  // каркаса взяться неоткуда, и проба обязана это увидеть.
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    for (const name of await caches.keys()) await caches.delete(name);
  });
  await context.setOffline(true);
  await visit(page, "/ru/stories");
  const bare = await page
    .evaluate(() => document.body?.dataset.offlineShell === "1")
    .catch(() => false);
  expect(bare, "ПРИБОР СЛЕП: каркас «показан» и без воркера — значит проба меряет не воркер").toBe(false);
});

test("долг 278: один упавший запрос при живой сети не даёт ни баннера, ни надписи «нет сети»", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  // Запрос падает по-настоящему: адрес, на котором никто не слушает.
  const reallyFailed = await page.evaluate(async () => {
    try {
      await fetch("http://127.0.0.1:1/offline-probe", { mode: "no-cors" });
      return false;
    } catch {
      return true;
    }
  });
  expect(reallyFailed, "запрос не упал — мерить нечего").toBe(true);
  await page.waitForTimeout(1200);

  const banner = await page.evaluate(() => /Нет подключения к интернету/.test(document.body.innerText));
  expect(banner, "один упавший запрос при живой сети поднял баннер офлайна (долг 278)").toBe(false);
  const state = await surface(page);
  expect(state.shell, "один упавший запрос при живой сети подменил страницу каркасом (долг 278)").toBe(false);

  // И сам каркас при ЖИВОЙ сети про сеть ничего не утверждает: проба до
  // своего `/api/health` доходит, значит надпись — «страница не
  // открылась», а не «нет соединения».
  await page.goto("/offline.html");
  await expect(page.locator('h1[data-state="error"]'), "каркас не показал честную надпись").toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.locator('h1[data-state="offline"]'),
    "каркас при ЖИВОЙ сети утверждает «нет соединения» — ровно то, что владелец видел 20.09.2026",
  ).toBeHidden();
});

test("после выхода из аккаунта офлайн не показывается ни кабинет, ни страницы прежнего человека", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);

  /**
   * ЧТО ИМЕННО ДОКАЗЫВАЕТСЯ. Кеш документов заводится на КАЖДУЮ открытую
   * страницу, в том числе на страницы вошедшего человека — в заходе 7.218
   * замерено, что `/ru/profile` лежал на устройстве на 167 965 байт
   * вместе с адресом почты и отдавался офлайн следующему человеку.
   * Заход 7.227 добавил каркас, то есть ещё один экран, который
   * показывается без сети, — и вместе с ним обязанность доказать, что из
   * кешей по-прежнему не всплывает чужой доступ.
   *
   * Замер двусторонний: ДО выхода личных кешей обязано быть не ноль
   * (иначе «после выхода ноль» ничего не значит — стирать было нечего),
   * ПОСЛЕ выхода — ровно ноль.
   */
  const countPersonal = () =>
    page.evaluate(async () => {
      const legacy = ["pages", "pages-rsc", "pages-rsc-prefetch", "others"];
      let entries = 0;
      for (const name of await caches.keys()) {
        if (!(name.startsWith("rf-pages") || legacy.includes(name))) continue;
        entries += (await (await caches.open(name)).keys()).length;
      }
      return entries;
    });

  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  // Страницы платного раздела, открытые подписчиком: их копии и есть то,
  // что не должно достаться следующему человеку на этом устройстве.
  await page.goto("/ru/vocabulary");
  await page.goto("/ru/stories");
  await page.waitForTimeout(1000);

  const before = await countPersonal();
  expect(before, "ОБРАТНЫЙ КОНТРОЛЬ: до выхода личных копий не было вовсе — значит «после выхода ноль» ничего не доказывает").toBeGreaterThan(0);

  // Выход — той же формой, какой его делает человек: маршрут ставит в
  // адрес признак, по которому страница чистит личные кеши.
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    const lang = document.createElement("input");
    lang.name = "lang";
    lang.value = "ru";
    form.appendChild(lang);
    document.body.appendChild(form);
    form.submit();
  });
  await page.waitForURL(/\/ru(\?|$)/, { timeout: 30_000 });
  await page.waitForFunction(
    async () => {
      const legacy = ["pages", "pages-rsc", "pages-rsc-prefetch", "others"];
      const names = (await caches.keys()).filter((n) => n.startsWith("rf-pages") || legacy.includes(n));
      return names.length === 0;
    },
    null,
    { timeout: 20_000 },
  );
  expect(await countPersonal(), "после выхода в кешах документов остались страницы прежнего человека").toBe(0);

  await context.setOffline(true);
  await visit(page, "/ru/profile");
  const cabinet = await surface(page);
  expect(cabinet.shell, "без сети после выхода показался кабинет, а не каркас").toBe(true);
  await visit(page, "/ru/vocabulary");
  const paid = await surface(page);
  expect(paid.shell, "без сети после выхода показалась страница, открытая прежним человеком").toBe(true);
  await context.setOffline(false);
});
