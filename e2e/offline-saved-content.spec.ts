import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * ОФЛАЙН-2: РАНЕЕ ОТКРЫТОЕ ЧИТАЕТСЯ БЕЗ СЕТИ — ЗАХОД 7.229, СТРОКА 307.
 *
 * ====================================================================
 * ПОЧЕМУ ПРОБА УСТРОЕНА ИМЕННО ТАК, А НЕ «ВЫКЛЮЧИЛИ СЕТЬ И СМОТРИМ»
 * ====================================================================
 *
 * В БРАУЗЕРЕ офлайн-навигацию обслуживает воркер, и сохранённая страница
 * открывается им — без всякой читалки. В ПРИЛОЖЕНИИ этой дороги нет:
 * доказано отказом сборки 1.0.3, где отсутствие нашего java-клиента
 * оборачивалось НАТИВНЫМ экраном ошибки. Ответь воркер на ту навигацию —
 * экрана бы не было. Значит проба, которая просто выключает сеть в
 * Chromium, меряет дорогу, которой в приложении нет.
 *
 * Поэтому здесь воспроизводится ОБОЛОЧКА:
 *   1. страницы открываются с сетью, воркер кладёт их в свои кеши;
 *   2. РЕГИСТРАЦИЯ ВОРКЕРА СНИМАЕТСЯ — ровно то положение, в котором
 *      оказывается навигация внутри приложения: воркер её не видит;
 *   3. сеть выключается;
 *   4. на документ отвечает КАРКАС по ИСХОДНОМУ адресу — ровно то, что
 *      делает `OfflineShellWebViewClient` (`assets.open("public/offline.html")`,
 *      код 200, адрес не меняется). Файл берётся с диска тот же самый.
 *
 * Всё, что проверяется дальше, каркас обязан сделать САМ, из
 * `Cache Storage`, без единого сетевого запроса.
 *
 * ЧЕГО ЭТА ПРОБА НЕ ДОКАЗЫВАЕТ. Настоящего Android здесь нет (долг 176,
 * 306): java-клиент изображается перехватом Playwright. Доказывается то,
 * что можно доказать браузером, — что каркасу ХВАТАЕТ Cache Storage,
 * чтобы нарисовать сохранённую страницу, и что закрытого он не рисует.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");

/** Оболочка: воркера на навигации нет, а документ отдаёт каркас по
 *  исходному адресу. Включается ПОСЛЕ того, как страницы уже сохранены. */
async function becomeNativeShell(page: Page, context: BrowserContext): Promise<void> {
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: SHELL_HTML });
  });
  await context.setOffline(true);
}

/**
 * ПЕРЕХОД БЕЗ СЕТИ — С ПОВТОРОМ, И ЭТО ЗАМЕР ПРИБОРА, А НЕ ПРОДУКТА
 * (перемерено в 7.227: первый `page.goto` отказывает, второй проходит).
 * Повторяется ПОДГОТОВКА; утверждения снимаются с документа.
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

/** Что сейчас на экране. Сохранённая копия и каркас — РАЗНЫЕ признаки. */
async function surface(page: Page) {
  return page.evaluate(() => ({
    shell: document.body?.dataset.offlineShell === "1",
    copy: document.body?.dataset.offlineCopy === "1",
    styles: document.head.querySelectorAll("style").length,
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    savedBar: document.querySelector(".rf-saved-bar")?.textContent ?? "",
    tabs: document.querySelectorAll("[data-offline-tab]:not([hidden])").length,
    panels: document.querySelectorAll("[data-offline-panel]").length,
    text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim(),
  }));
}

test("сохранённые урок, рассказ и словарь читаются без сети; непосещённое остаётся каркасом", async ({
  page,
  context,
}) => {
  // Бюджет назван числом: установка воркера, четыре страницы с сетью и
  // четыре перехода без сети, у каждого свой повтор.
  test.setTimeout(240_000);

  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  // 1. ЧЕЛОВЕК ОТКРЫЛ ИХ С СЕТЬЮ.
  await page.goto("/ru/courses/a1/2");
  await page.waitForTimeout(800);
  const lessonHeading = (await page.locator("h1").first().textContent())?.trim() ?? "";
  expect(lessonHeading.length, "урок не отрисовался — сохранять нечего").toBeGreaterThan(0);

  await page.goto("/ru/stories");
  const storyHref = await page.locator('a[href^="/ru/stories/"]').first().getAttribute("href");
  expect(storyHref, "в каталоге нет ни одного рассказа — мерить нечего").toBeTruthy();
  await page.goto(storyHref!);
  await page.waitForTimeout(800);

  await page.goto("/es/vocabulary/comida");
  await page.waitForTimeout(800);

  // СОХРАНЁННОЕ ЛЕЖИТ ОТДЕЛЬНО ОТ ВСЕХ ПРОЧИХ ДОКУМЕНТОВ — иначе обход
  // каталогов вытеснял бы его (замер 23.09.2026: 46 адресов → 40 записей
  // общего кеша, открытого первым урока среди них уже нет).
  const saved = await page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => /^rf-pages-content-[a-z0-9]+$/.test(n));
    if (!name) return null;
    const keys = await (await caches.open(name)).keys();
    return keys.map((k) => new URL(k.url).pathname);
  });
  expect(saved, "кеша сохранённого содержания нет вовсе").not.toBeNull();
  expect(saved, "урок не попал в кеш содержания").toContain("/ru/courses/a1/2");
  expect(saved, "словарь темы не попал в кеш содержания").toContain("/es/vocabulary/comida");
  expect(saved!.some((p) => p.startsWith("/ru/stories/")), "рассказ не попал в кеш содержания").toBe(true);

  // 2. СТАЛО ОБОЛОЧКОЙ БЕЗ СЕТИ.
  await becomeNativeShell(page, context);

  // 3. УРОК — ЧИТАЕТСЯ, СО СТИЛЯМИ И РАБОЧИМИ ВКЛАДКАМИ.
  await visit(page, "/ru/courses/a1/2");
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  const lesson = await surface(page);
  expect(lesson.copy, "сохранённый урок без сети не открылся — ровно строка 307").toBe(true);
  expect(lesson.shell, "на месте сохранённого урока остался каркас").toBe(false);
  expect(lesson.heading, "заголовок сохранённого урока не тот").toBe(lessonHeading);
  expect(lesson.styles, "копия показана без стилей — 240 килобайт голой разметки хуже каркаса").toBeGreaterThan(0);
  expect(lesson.savedBar, "над копией нет честной подписи «сохранённая копия»").toMatch(/Сохранённая копия/);
  expect(lesson.panels, "панелей урока в копии нет — вкладкам нечего показывать").toBeGreaterThan(1);
  expect(lesson.tabs, "видимых вкладок меньше, чем панелей: вкладка без своей панели убрана, и это правильно").toBe(
    lesson.panels,
  );

  // ВКЛАДКИ РАБОТАЮТ БЕЗ СЕТИ И БЕЗ СКРИПТОВ САЙТА.
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-offline-panel]")].map((n) => n.getAttribute("data-offline-panel")!),
  );
  const other = ids.find((id) => id !== "grammar") ?? ids[0];
  await page.locator(`[data-offline-tab="${other}"]`).click();
  const shown = await page.evaluate(
    (id) => document.querySelector(`[data-offline-panel="${id}"]`)?.classList.contains("hidden") === false,
    other,
  );
  expect(shown, `вкладка «${other}» не открыла свою панель — без сети урок показывает одну вкладку из пяти`).toBe(true);

  // 4. РАССКАЗ И СЛОВАРЬ ТЕМЫ — ТО ЖЕ САМОЕ.
  await visit(page, storyHref!);
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  const story = await surface(page);
  expect(story.copy, "сохранённый рассказ без сети не открылся").toBe(true);
  expect(story.text.length, "текст рассказа в копии пуст").toBeGreaterThan(200);

  await visit(page, "/es/vocabulary/comida");
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  expect((await surface(page)).copy, "сохранённая категория словаря без сети не открылась").toBe(true);

  // 5. ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ПРОГОНЕ: НЕПОСЕЩЁННОЕ ОСТАЁТСЯ
  //    КАРКАСОМ. Без него «копия показана» и «показано что угодно»
  //    читались бы одинаково.
  await visit(page, "/ru/courses/b2/19");
  await expect(
    page.locator("body[data-offline-shell]"),
    "непосещённая страница показана копией — значит читалка рисует что попало",
  ).toBeVisible({ timeout: 25_000 });
  const never = await surface(page);
  expect(never.copy).toBe(false);
  expect(never.tabs, "у каркаса вкладок урока быть не может").toBe(0);

  await context.unroute("**/*");
  await context.setOffline(false);
});

test("платное: после выхода из аккаунта сохранённый урок без сети не открывается", async ({ page, context }) => {
  test.setTimeout(180_000);

  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto("/ru/courses/a1/2");
  await page.waitForTimeout(800);

  // ОБРАТНЫЙ КОНТРОЛЬ: до выхода сохранённое ЕСТЬ. Иначе «после выхода
  // ноль» ничего не значит — стирать было нечего.
  const countSaved = () =>
    page.evaluate(async () => {
      let entries = 0;
      for (const name of await caches.keys()) {
        if (!/^rf-pages-content-[a-z0-9]+$/.test(name)) continue;
        entries += (await (await caches.open(name)).keys()).length;
      }
      return entries;
    });
  expect(await countSaved(), "до выхода сохранённого содержания нет — замер ничего не доказал бы").toBeGreaterThan(0);

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
    async () => (await caches.keys()).filter((n) => n.startsWith("rf-pages")).length === 0,
    null,
    { timeout: 20_000 },
  );
  expect(await countSaved(), "после выхода платный урок остался лежать на телефоне").toBe(0);

  await becomeNativeShell(page, context);
  await visit(page, "/ru/courses/a1/2");
  await expect(
    page.locator("body[data-offline-shell]"),
    "после выхода из аккаунта без сети открылся платный урок прежнего человека",
  ).toBeVisible({ timeout: 25_000 });

  await context.unroute("**/*");
  await context.setOffline(false);
});
