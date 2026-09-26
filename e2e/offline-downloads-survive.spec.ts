import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { reachShell } from "./helpers/offline-shell";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * СКАЧАННОЕ ПЕРЕЖИВАЕТ ХОЛОДНЫЙ СТАРТ — ЗАХОД 7.233, СТРОКИ 314–316.
 *
 * ====================================================================
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ И ЧЕГО НЕ ВИДЕЛА ПРЕЖНЯЯ ПРОБА
 * ====================================================================
 *
 * Видео 26.09.2026 (1.0.8, POCO X6 Pro, 2:32–2:47): гостем скачаны
 * «Снегурочка» (1,4 MB) и урок A1/1 (1,5 MB), приложение убито из
 * списка недавних, Wi-Fi выключен, запуск — «Aún no hay nada guardado»,
 * «Guardado: 0», блока «Descargado» нет вовсе. Через минуту с Wi-Fi та
 * же «Снегурочка» открывается, и кнопка на ней говорит «Descargado ✓»,
 * то есть копия и все её клипы ЛЕЖАЛИ.
 *
 * Проба `offline-downloads.spec.ts` этот случай не ловила и ловить не
 * могла: выкат сайта она изображала удалением кешей `rf-pages-*` с
 * отпечатком сборки, а листы стилей живут НЕ там — они в precache, имя
 * которого отпечатка не несёт. Прогон 26.09.2026
 * (`.run7233/repro2.mjs css-gone`) на коде ДО правки: стереть два файла
 * `/_next/static/css/…` вне кеша скачанного — и при четырнадцати живых
 * записях кеша и целой описи каркас печатает ровно экран владельца.
 *
 * ====================================================================
 * ПОЧЕМУ У КАЖДОГО УТВЕРЖДЕНИЯ ЗДЕСЬ ЕСТЬ ВТОРАЯ ПОЛОВИНА
 * ====================================================================
 *
 * «Список не опустел» само по себе не значит ничего: он мог не опустеть
 * и оттого, что в нём нечему было пустеть. Поэтому в каждом тесте
 * сначала утверждается НЕПУСТАЯ выборка до правки условия, а потом её
 * сохранность после, — и отдельным утверждением проверяется, что проба
 * УМЕЕТ краснеть: те же файлы, стёртые ВМЕСТЕ с кешем скачанного, гасят
 * список, как и должны.
 */
const SHELL_HTML = readFileSync("public/offline.html", "utf8");
const button = "[data-rf-download-button]";

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

/** Рассказ со звуком, найденный кликами: без клипов мерить нечего. */
async function openStoryWithClips(page: Page): Promise<string> {
  await page.locator('a[href="/es/stories"]').first().click();
  await page.waitForURL(/\/es\/stories$/, { timeout: 30_000 });
  const hrefs = (
    await page
      .locator('a[href^="/es/stories/"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")).filter((href): href is string => Boolean(href)))
  ).filter((href, index, all) => all.indexOf(href) === index);
  // Размер утверждается, а не подразумевается: на пустом списке обход
  // ниже не сделал бы ничего, и тест был бы зелен независимо от продукта.
  expect(hrefs.length, 'в каталоге рассказов нет ни одной ссылки').toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 6)) {
    await visit(page, "/es/stories");
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await page.waitForTimeout(1500);
    if ((await page.locator("[data-rf-clip]").count()) > 0) return href;
  }
  throw new Error("ни у одного рассказа нет клипов — скачивать звук нечем");
}

/** Скачать материал, на котором стоим. */
async function download(page: Page): Promise<void> {
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });
}

/** Список каркаса как его видит человек: строками, а не селекторами. */
async function shellRows(page: Page): Promise<{ rows: string[]; gauge: string; downloadsHidden: boolean }> {
  return page.evaluate(() => ({
    rows: [...document.querySelectorAll("[data-saved-list] li button")].map((node) =>
      (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
    ),
    gauge: document.querySelector("[data-saved-gauge]")?.textContent ?? "",
    downloadsHidden: Boolean((document.querySelector("[data-downloads]") as HTMLElement | null)?.hidden),
  }));
}

test("листы стилей чужих кешей ушли — скачанное осталось в списке и называет свой язык", async ({ page, context }) => {
  // Бюджет больше суммы собственных ожиданий (409 с): иначе отказ придёт
  // по потолку теста и укажет на невиновный вызов (`check:e2e-live-probes`).
  test.setTimeout(480_000);
  await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await openStoryWithClips(page);
  await download(page);

  // ЛИСТЫ СТИЛЕЙ ЛЕЖАТ РЯДОМ СО СКАЧАННЫМ — утверждение положительное:
  // без него три отрицательных проверки ниже прошли бы и на пустом кеше.
  const laid = await page.evaluate(async () => {
    const cache = await caches.open("rf-pages-downloads");
    const keys = (await cache.keys()).map((request) => request.url);
    const hit = await cache.match(new URL("/__rf-downloads-index", location.href).toString(), { ignoreVary: true });
    const rows = hit ? ((await hit.json()) as { sheets?: string[] }[]) : [];
    return { sheetsInCache: keys.filter((url) => /\/_next\/static\/css\//.test(url)), sheetsInRow: rows[0]?.sheets ?? [] };
  });
  expect(laid.sheetsInCache.length, "листов стилей рядом со скачанным нет").toBeGreaterThan(0);
  expect(laid.sheetsInRow.length, "опись не назвала ни одного листа стилей материала").toBe(laid.sheetsInCache.length);

  // ВЫКАТ САЙТА, КАК ОН ЕСТЬ: новая сборка уносит precache старой и её
  // кеши с отпечатком. Кеш скачанного отпечатка не несёт и остаётся.
  const wiped = await page.evaluate(async () => {
    let removed = 0;
    for (const name of await caches.keys()) {
      if (name === "rf-pages-downloads") continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (/\/_next\/static\/css\//.test(request.url) && (await cache.delete(request))) removed += 1;
      }
    }
    return removed;
  });
  expect(wiped, "листов стилей вне кеша скачанного не было — выкат изобразить было нечем").toBeGreaterThan(0);

  await becomeNativeShell(page, context);
  // Переход на каркас — через устойчивого помощника (заход 7.233):
  // выключение сети заставляет живую страницу перейти на саму себя, и
  // голый `goto` сразу после него отменяется. Разбор и замер — в
  // `helpers/offline-shell.ts`.
  const shellAt1 = await reachShell(page, "/es");
  expect(shellAt1.arrived, `каркас не открылся по /es — страница осталась на ${shellAt1.where}`).toBe(true);
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const after = await shellRows(page);

  expect(after.rows.join(" | "), "скачанное исчезло из списка вместе с чужими листами стилей").toMatch(/Descargado/);
  expect(after.downloadsHidden, "блок «Descargado» спрятан, хотя скачанное лежит").toBe(false);
  expect(after.gauge, "прибор спорит со списком").not.toMatch(/Guardado: 0/);
  // ПОМЕТКА ЯЗЫКА (строка 316): две локали одной страницы обязаны
  // различаться на экране, а не только в адресе.
  expect(after.rows.join(" | "), "у строки нет пометки языка — две локали не различить").toMatch(/· ES/);

  // ПРОБА УМЕЕТ КРАСНЕТЬ. Те же файлы, но стёртые ВМЕСТЕ с кешем
  // скачанного, — и список гаснет. Без этой половины «список не пуст»
  // не доказывало бы ничего: сравнение двух непустых выборок обязано
  // уметь разойтись.
  await page.evaluate(async () => {
    const cache = await caches.open("rf-pages-downloads");
    for (const request of await cache.keys()) {
      if (/\/_next\/static\/css\//.test(request.url)) await cache.delete(request);
    }
  });
  // Переход на каркас — через устойчивого помощника (заход 7.233):
  // выключение сети заставляет живую страницу перейти на саму себя, и
  // голый `goto` сразу после него отменяется. Разбор и замер — в
  // `helpers/offline-shell.ts`.
  const shellAt2 = await reachShell(page, "/es");
  expect(shellAt2.arrived, `каркас не открылся по /es — страница осталась на ${shellAt2.where}`).toBe(true);
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const blind = await shellRows(page);
  expect(
    blind.rows.join(" | "),
    "список остался прежним даже без единого листа стилей — значит проба не мерит ничего",
  ).not.toMatch(/Descargado/);

  await context.unroute("**/*").catch(() => {});
  await context.setOffline(false);
});

test("опись скачанного потеряна — строка восстановлена из самого кеша", async ({ page, context }) => {
  test.setTimeout(480_000);
  await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await openStoryWithClips(page);
  await download(page);

  // ПОЗИТИВНЫЙ КОНТРОЛЬ ПЕРВЫМ: с описью строка есть и называет вес.
  await becomeNativeShell(page, context);
  // Переход на каркас — через устойчивого помощника (заход 7.233):
  // выключение сети заставляет живую страницу перейти на саму себя, и
  // голый `goto` сразу после него отменяется. Разбор и замер — в
  // `helpers/offline-shell.ts`.
  const shellAt3 = await reachShell(page, "/es");
  expect(shellAt3.arrived, `каркас не открылся по /es — страница осталась на ${shellAt3.where}`).toBe(true);
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const listed = await shellRows(page);
  expect(listed.rows.join(" | "), "строки скачанного нет ещё до потери описи").toMatch(/Descargado/);
  expect(listed.rows.join(" | "), "вес не назван — сверять потерю описи не с чем").toMatch(/MB/);

  // ОПИСЬ ТЕРЯЕТСЯ. Это не выдумка: её пишет ОДНА запись, и стереть её
  // может и уборщик выхода, попавший между двумя `put` (строка 310), и
  // любой отказ на последнем шаге скачивания.
  const gone = await page.evaluate(async () => {
    const cache = await caches.open("rf-pages-downloads");
    const url = new URL("/__rf-downloads-index", location.href).toString();
    const removed = await cache.delete(url, { ignoreVary: true });
    return { removed, left: (await cache.keys()).length };
  });
  expect(gone.removed, "описи не было — терять было нечего").toBe(true);
  expect(gone.left, "кеш скачанного пуст — восстанавливать не из чего").toBeGreaterThan(1);

  // Переход на каркас — через устойчивого помощника (заход 7.233):
  // выключение сети заставляет живую страницу перейти на саму себя, и
  // голый `goto` сразу после него отменяется. Разбор и замер — в
  // `helpers/offline-shell.ts`.
  const shellAt4 = await reachShell(page, "/es");
  expect(shellAt4.arrived, `каркас не открылся по /es — страница осталась на ${shellAt4.where}`).toBe(true);
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const restored = await shellRows(page);
  expect(restored.rows.join(" | "), "строка не восстановлена из кеша — скачанное лежит и недостижимо").toMatch(
    /Descargado/,
  );
  expect(restored.downloadsHidden, "блок «Descargado» спрятан при живом кеше").toBe(false);
  // Веса у восстановленной строки нет, и это честно: без описи связать
  // клип с материалом нечем, а «0,0 MB» было бы неправдой.
  expect(restored.rows.join(" | ")).not.toMatch(/0,0 MB/);

  await context.unroute("**/*").catch(() => {});
  await context.setOffline(false);
});
