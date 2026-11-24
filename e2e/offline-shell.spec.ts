import { test, expect } from "./helpers/test";
import type { Page } from "@playwright/test";
import { loginWithSubscription } from "./helpers/auth";
import { expectNothingPersonalAfterSignOut, ownerScope, personalLeft } from "./helpers/signed-out-caches";

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

/**
 * ДОЛГ 278, ЗАХОД 7.304 — ПРИЧИНА НАЗВАНА.
 *
 * Жалоба 20.09.2026 (рассказ на несколько секунд подменился «Estás sin
 * conexión» при живом интернете) пришла в день аварии квоты Turso: в Sentry
 * в тот же день 126 событий `BLOCKED` ровно на `/[lang]/stories/[id]`
 * (долг 290). Проба «жива ли сеть», поставленная в 7.227, спрашивает
 * `/api/health`, а он проверяет БАЗУ: при лежащей базе отвечает 503
 * `RF-DOWN`, при медленной — не успевает за 2,5 с. Воркер читал это как
 * «сервера нет» и отдавал каркас, каркас дважды спрашивал то же самое и
 * печатал «нет соединения». Сеть при этом жива: сервер ответил.
 *
 * Здесь подсажено ровно это: `/api/health` отвечает 503 `RF-DOWN`, первый
 * запрос документа оборван. На коде до 7.304 — каркас «Нет соединения».
 */
test("долг 278: база лежит (/api/health 503) и один запрос оборван — «нет соединения» не показывается", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);

  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  // Документ воркер берёт «предзагрузкой навигации», а её запрос Playwright
  // не перехватывает. Без предзагрузки воркер идёт за документом сам — тот
  // же путь `NetworkFirst` → `handlerDidError`, только видимый пробе.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.navigationPreload?.disable();
  });

  let healthAsked = 0;
  await context.route("**/api/health**", async (route) => {
    healthAsked += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "RF-DOWN", ok: false, db: "down", reason: "db_unreachable" }),
    });
  });
  let documentAborted = 0;
  await context.route("**/ru/glossary", async (route) => {
    if (documentAborted === 0) {
      documentAborted += 1;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await visit(page, "/ru/glossary");
  await page.waitForTimeout(6000);

  expect(documentAborted, "запрос документа не был оборван — мерить нечего").toBe(1);
  expect(healthAsked, "воркер не спросил /api/health — подсадка не дошла").toBeGreaterThan(0);
  const offlineShown = await page
    .locator('h1[data-state="offline"]')
    .isVisible()
    .catch(() => false);
  expect(offlineShown, "при живой сети и лежащей базе показано «нет соединения» — долг 278").toBe(false);
  const state = await surface(page);
  expect(state.shell, "страница подменена каркасом, хотя сервер ответил").toBe(false);
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
  /**
   * ДОЛГ 318 (7.291). Прежде здесь утверждалось «после выхода в кешах
   * документов ровно 0 записей» — и это расходилось с правильным
   * поведением: вышедший человек уже гость, и воркер за ≈0,3 с кладёт
   * гостевые `/ru`, `/ru/login`, заготовки ссылок (замер 7.291). Ноль
   * держался на скорости (1 из 569 в 7.233, повтор в CI #528). Теперь
   * личное узнаётся по метке владельца, а не по счёту записей
   * (`helpers/signed-out-caches.ts`), и проверяется ДВАЖДЫ: сразу после
   * уборки и после того, как гостевая страница дошла до покоя.
   */
  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  // Страницы платного раздела, открытые подписчиком: их копии и есть то,
  // что не должно достаться следующему человеку на этом устройстве.
  await page.goto("/ru/vocabulary");
  await page.goto("/ru/stories");
  await page.waitForTimeout(1000);

  const scope = await ownerScope(page);
  const before = await personalLeft(page, scope);
  expect(before.length, "ОБРАТНЫЙ КОНТРОЛЬ: до выхода личных копий не было вовсе — значит «после выхода ноль» ничего не доказывает").toBeGreaterThan(0);

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
  await expectNothingPersonalAfterSignOut(page, scope);

  await context.setOffline(true);
  await visit(page, "/ru/profile");
  const cabinet = await surface(page);
  expect(cabinet.shell, "без сети после выхода показался кабинет, а не каркас").toBe(true);
  await visit(page, "/ru/vocabulary");
  const paid = await surface(page);
  expect(paid.shell, "без сети после выхода показалась страница, открытая прежним человеком").toBe(true);
  await context.setOffline(false);
});

test("долг 318: воркер принимает «выход» и сам стирает личные кеши", async ({ page }) => {
  test.setTimeout(90_000);

  /**
   * Замок выхода живёт в воркере (`src/lib/signed-out-lock.ts`); порядок
   * «запрос начат до выхода — ответ лёг после» проверен юнит-тестом на
   * подставных кешах. Здесь — что СОБРАННЫЙ воркер этот замок носит:
   * отвечает на сообщение выхода и стирает кеши сам, без страницы.
   * Позитивный контроль на коде до 7.291: ответа нет вовсе (тайм-аут).
   */
  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto("/ru/stories");
  await page.waitForTimeout(1000);
  const scope = await ownerScope(page);
  expect((await personalLeft(page, scope)).length, "до сообщения личных копий нет — стирать нечего").toBeGreaterThan(0);

  const reply = await page.evaluate(async () => {
    const worker = (await navigator.serviceWorker.getRegistration())?.active;
    if (!worker) return null;
    return new Promise<{ deleted?: string[] } | null>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 10_000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data as { deleted?: string[] });
      };
      worker.postMessage({ type: "rf-signed-out" }, [channel.port2]);
    });
  });
  expect(reply, "воркер не ответил на «выход» — замка в нём нет").not.toBeNull();
  expect(reply!.deleted ?? [], "воркер ответил, но не стёр ни одного личного кеша").toEqual(
    expect.arrayContaining([expect.stringMatching(/^rf-pages/)]),
  );
  // Страница не делала ничего: всё стёр воркер.
  expect(await personalLeft(page, scope), "после ответа воркера личное осталось").toEqual([]);
});
