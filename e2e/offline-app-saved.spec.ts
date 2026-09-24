import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * ОФЛАЙН-2б: В ПРИЛОЖЕНИИ СОХРАНЁННОЕ ДОСТИЖИМО — ЗАХОД 7.230, СТРОКА 309.
 *
 * ====================================================================
 * ЧТО ПРОГЛЯДЕЛА ПРОБА 7.229 И ПОЧЕМУ ЭТА УСТРОЕНА ИНАЧЕ
 * ====================================================================
 *
 * Проба 7.229 (`offline-saved-content.spec.ts`) открывала страницы
 * `page.goto` — то есть ПОЛНОЙ навигацией, — и только потом снимала
 * регистрацию воркера, изображая оболочку. Порядок «сначала сохранил
 * воркер, потом воркера убрали» доказывает ровно одно: что каркасу
 * ХВАТАЕТ уже сохранённого. Наступает ли этот порядок в приложении, она
 * не спрашивала.
 *
 * ЗАМЕР НА НАСТОЯЩЕМ ANDROID 25.09.2026 (эмулятор, Android 15, WebView
 * Chrome 124, сборка 1.0.5 из Play против живого прода, отладочный
 * протокол через `adb forward`) ответил: не наступает. Человек внутри
 * приложения делает ОДНУ полную навигацию — стартовую, на `/es`, — а
 * дальше ходит клиентским роутером Next. Полной навигации на урок не
 * случается вовсе, и кеш документов `rf-pages-content-*` остаётся
 * ПУСТЫМ: после прохода «главная → Cursos → A1 → урок 1 → Cuentos»
 * кеша содержания на телефоне не существовало вообще, а в
 * `rf-pages-rsc-*` лежали ответы RSC — не документы.
 *
 * Поэтому здесь переход делается КЛИКОМ ПО ССЫЛКЕ, как у человека, а не
 * `page.goto`. Сохранение при этом держит не воркер, а сама страница
 * (`OfflineSaveCopy`), и именно это здесь и проверяется.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");

/** Оболочка: воркера на навигации нет, документ отдаёт каркас по
 *  ИСХОДНОМУ адресу — ровно то, что делает `OfflineShellWebViewClient`. */
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

/** Что лежит в кешах документов, по видам. */
async function savedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      if (!/^rf-pages-(content|section)-[a-z0-9]+$/.test(name)) continue;
      for (const request of await (await caches.open(name)).keys()) {
        out.push(new URL(request.url).pathname);
      }
    }
    return out;
  });
}

/**
 * СРАВНЕНИЕ «ДО/ПОСЛЕ» НА ДВУХ ПУСТЫХ ВЫБОРКАХ ОБЯЗАНО ПАДАТЬ.
 *
 * Без этой строки утверждение «после прохода сохранённого стало
 * больше» выполнялось бы и тогда, когда до и после по нулю: ноль не
 * больше нуля, но проба, написанная небрежно (`expect(after.length)
 * .toBeGreaterThanOrEqual(before.length)`), прошла бы. Именно такой
 * небрежностью и держалась строка 307 закрытой.
 */
function grew(before: readonly string[], after: readonly string[], what: string): void {
  expect(before.length + after.length, `${what}: обе выборки пусты — сравнивать нечего, а значит и доказано ничего`)
    .toBeGreaterThan(0);
  expect(after.length, `${what}: после прохода сохранённого не прибавилось`).toBeGreaterThan(before.length);
}

test("прибор «до/после» сам падает на двух пустых выборках", () => {
  expect(() => grew([], [], "самопроверка")).toThrow();
  expect(() => grew([], ["/ru/courses/a1/2"], "самопроверка")).not.toThrow();
  expect(() => grew(["/a", "/b"], ["/a"], "самопроверка")).toThrow();
});

test("переход клиентским роутером сохраняет страницу — то, чего не делал воркер в приложении", async ({ page }) => {
  test.setTimeout(240_000);

  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  const before = await savedPaths(page);

  // ПЕРЕХОД КЛИКОМ, А НЕ `goto`: это и есть условие приложения. Полной
  // навигации здесь не происходит ни одной.
  await page.locator('nav a[href="/ru/courses"], a[href="/ru/courses"]').first().click();
  await page.waitForURL(/\/ru\/courses$/, { timeout: 30_000 });
  await page.locator('a[href="/ru/courses/a1"]').first().click();
  await page.waitForURL(/\/ru\/courses\/a1$/, { timeout: 30_000 });
  const lessonHref = await page.locator('a[href^="/ru/courses/a1/"]').first().getAttribute("href");
  expect(lessonHref, "на странице уровня нет ни одной ссылки на урок — мерить нечего").toBeTruthy();
  await page.locator(`a[href="${lessonHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${lessonHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);

  const after = await savedPaths(page);
  grew(before, after, "проход клиентским роутером");
  expect(after, "урок, открытый КЛИКОМ, на телефоне не сохранился — ровно видео владельца 25.09.2026").toContain(
    lessonHref!,
  );
  expect(after, "корень раздела, открытый кликом, не сохранился — вкладка «Cursos» без сети снова ведёт в пустоту").toContain(
    "/ru/courses",
  );
});

test("каркас без сети показывает список сохранённого, прибор и открывает урок из списка", async ({ page, context }) => {
  test.setTimeout(300_000);

  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.locator('a[href="/ru/courses"]').first().click();
  await page.waitForURL(/\/ru\/courses$/, { timeout: 30_000 });
  await page.locator('a[href="/ru/courses/a1"]').first().click();
  await page.waitForURL(/\/ru\/courses\/a1$/, { timeout: 30_000 });
  const lessonHref = (await page.locator('a[href^="/ru/courses/a1/"]').first().getAttribute("href"))!;
  await page.locator(`a[href="${lessonHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${lessonHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);
  const lessonTitle = await page.title();

  await becomeNativeShell(page, context);

  // ХОЛОДНЫЙ СТАРТ: приложение открывается НА СТАРТОВОМ АДРЕСЕ, а не на
  // уроке. Ровно так было у владельца, и ровно поэтому читалка 7.229 не
  // находила ничего: она ищет копию ЭТОГО адреса.
  await visit(page, "/ru");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });

  const shell = await page.evaluate(() => ({
    isShell: document.body?.dataset.offlineShell === "1",
    items: [...document.querySelectorAll("[data-saved-list] li button")].map((n) =>
      (n as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
    ),
    gauge: document.querySelector("[data-saved-gauge]")?.textContent ?? "",
    emptyShown: !(document.querySelector("[data-saved-empty]") as HTMLElement | null)?.hidden,
  }));
  expect(shell.isShell, "на стартовом адресе без сети показана не каркасная страница").toBe(true);
  expect(shell.items.length, "список сохранённого пуст, хотя урок открывали — это и есть строка 309").toBeGreaterThan(0);
  expect(shell.emptyShown, "честная строка «ничего не сохранено» показана при непустом списке").toBe(false);
  expect(shell.gauge, "строка-прибор не называет число сохранённого").toMatch(/Сохранено: [1-9]\d* · [a-z0-9]+/);
  expect(shell.items.join(" | "), "в списке нет ни урока, ни его вида").toMatch(/Урок/);

  // НАЖАТИЕ НА СТРОКУ СПИСКА ОТКРЫВАЕТ СОХРАНЁННУЮ КОПИЮ С СИНЕЙ ПОЛОСОЙ.
  const lessonItem = page
    .locator("[data-saved-list] li button")
    .filter({ hasText: "Урок" })
    .first();
  await lessonItem.click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  const copy = await page.evaluate(() => ({
    bar: document.querySelector(".rf-saved-bar")?.textContent ?? "",
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    styles: document.head.querySelectorAll("style").length,
    path: location.pathname,
  }));
  expect(copy.bar, "над копией нет синей полосы «сохранённая копия»").toMatch(/Сохранённая копия/);
  expect(copy.styles, "копия показана без стилей").toBeGreaterThan(0);
  expect(copy.heading.length, "у копии нет заголовка").toBeGreaterThan(0);
  expect(copy.path, "адрес в строке не переехал на открытый урок — «Повторить» перезапросит не ту страницу").toBe(
    new URL(lessonHref, "https://x").pathname,
  );
  expect(lessonTitle.length, "заголовок живого урока пуст — сравнивать было бы не с чем").toBeGreaterThan(0);

  await context.unroute("**/*");
  await context.setOffline(false);
});

test("вкладка «Cursos» без сети открывает сохранённый раздел, а пустой телефон говорит об этом честно", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);

  // 1. ПУСТОЙ ТЕЛЕФОН — ОБРАТНЫЙ КОНТРОЛЬ, И ОН ЗДЕСЬ ГЛАВНЫЙ: без него
  //    «список показан» и «список показан всегда» читались бы одинаково.
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    for (const name of await caches.keys()) if (name.startsWith("rf-pages")) await caches.delete(name);
  });
  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const empty = await page.evaluate(() => ({
    items: document.querySelectorAll("[data-saved-list] li").length,
    emptyShown: !(document.querySelector("[data-saved-empty]") as HTMLElement | null)?.hidden,
    text: document.querySelector("[data-saved-empty]")?.textContent?.trim() ?? "",
    gauge: document.querySelector("[data-saved-gauge]")?.textContent ?? "",
  }));
  expect(empty.items, "на пустом телефоне список не пуст").toBe(0);
  expect(empty.emptyShown, "на пустом телефоне нет честной строки — пустое место читается как поломка").toBe(true);
  expect(empty.text, "честная строка написана не по-испански на испанском адресе").toMatch(/Aún no hay nada guardado/);
  expect(empty.gauge, "прибор на пустом телефоне обязан показывать ноль").toMatch(/Guardado: 0 ·/);

  // 2. ТЕПЕРЬ РАЗДЕЛ СОХРАНЁН — И ТА ЖЕ ВКЛАДКА ОТКРЫВАЕТ ЕГО.
  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.locator('a[href="/es/courses"]').first().click();
  await page.waitForURL(/\/es\/courses$/, { timeout: 30_000 });
  await page.waitForTimeout(4000);
  const sectionTitle = await page.title();

  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  await page.locator('a[data-href="/courses"]').click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  const opened = await page.evaluate(() => ({
    bar: document.querySelector(".rf-saved-bar")?.textContent ?? "",
    path: location.pathname,
    title: document.title,
  }));
  expect(opened.path, "вкладка без сети увела не на раздел").toBe("/es/courses");
  expect(opened.bar, "раздел открыт без честной подписи «сохранённая копия»").toMatch(/Copia guardada/);
  expect(opened.title, "у открытого раздела не тот заголовок").toBe(sectionTitle);

  // 3. СТРОКА ЕСТЬ, А КОПИИ ПОД НЕЙ НЕТ — КНОПКА ГОВОРИТ ОБ ЭТОМ ПРЯМО.
  //    Так выглядит телефон после выката сайта (строка 308): опись
  //    пережила выкат, а кеш с копиями унесло. Кнопка, которая молча
  //    ничего не делает, — дефект сама по себе.
  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const emptied = await page.evaluate(async () => {
    let removed = 0;
    for (const name of await caches.keys()) {
      if (!/^rf-pages-section-[a-z0-9]+$/.test(name)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (await cache.delete(request)) removed += 1;
      }
    }
    return removed;
  });
  expect(emptied, "копий разделов не было вовсе — стирать было нечего, и замер ничего не доказал бы").toBeGreaterThan(0);

  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved-list] li button", { timeout: 25_000 });
  // Строка ищется по НАЗВАНИЮ, а не по подписи вида: подпись вида —
  // это ровно то, что нажатие меняет, и локатор по ней перестал бы
  // находить свою же кнопку в тот миг, когда она отвечает.
  const orphan = page.locator("[data-saved-list] li button").filter({ hasText: "Sección" }).first();
  const orphanName = (await orphan.innerText()).split("\n")[0].trim();
  expect(orphanName.length, "у строки списка нет названия — искать её было бы не по чему").toBeGreaterThan(0);
  await orphan.click();
  const byName = page.locator("[data-saved-list] li button").filter({ hasText: orphanName }).first();
  await expect(byName, "строка без копии молчит вместо честного «No disponible»").toContainText("No disponible", {
    timeout: 15_000,
  });
  expect(await byName.isDisabled(), "кнопка без копии осталась нажимаемой — она ничего не делает").toBe(true);

  await context.unroute("**/*");
  await context.setOffline(false);
});
