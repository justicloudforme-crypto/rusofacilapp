import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * КНОПКА «DESCARGAR» И ЭКРАН «DESCARGADO» — ЗАХОД 7.231 (ОФЛАЙН-3).
 *
 * ====================================================================
 * ЧТО ИМЕННО ЗДЕСЬ МЕРИТСЯ, И ПОЧЕМУ КАЖДОЕ УТВЕРЖДЕНИЕ ДВУСТОРОННЕЕ
 * ====================================================================
 *
 * 1. ВЕС ДО НАЖАТИЯ — НАСТОЯЩИЙ. Кнопка обязана назвать мегабайты,
 *    посчитанные из ответов источника, а не из среднего. Проверяется
 *    числом: вес, который она печатает, обязан совпасть с суммой
 *    `Content-Length` всех клипов страницы плюс её разметка — с точностью
 *    до той самой цифры после запятой, которую человек видит.
 * 2. СКАЧАННОЕ ПЕРЕЖИВАЕТ ВЫКАТ САЙТА, А ПРОСТО ПРОСМОТРЕННОЕ — НЕТ. Это
 *    и есть закрытие долга 308 для скачанного, и обратный контроль стоит
 *    в том же тесте: выкат изображается стиранием кешей с отпечатком, и
 *    просмотренная страница после него не открывается, а скачанная —
 *    открывается.
 * 3. ЗВУК В КОПИИ ИГРАЕТ ИЗ КЕША. Обратный контроль — стереть клип из
 *    кеша скачанного: то же нажатие обязано честно погаснуть.
 * 4. ВЫХОД ИЗ УЧЁТНОЙ ЗАПИСИ УНОСИТ СКАЧАННОЕ. Платный урок на общем
 *    телефоне — та цена, из-за которой имя кеша начинается с `rf-pages`.
 *
 * ЗВУК БЕРЁТСЯ НЕ ИЗ ИНТЕРНЕТА (долг 297): байты клипов отдаёт
 * `helpers/audio-clip-origin.ts` с теми же заголовками, что боевой
 * источник, а адреса остаются адресами ЧУЖОГО источника.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");

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

/**
 * Рассказ С КЛИПАМИ, найденный КЛИКАМИ. Первый рассказ каталога клипов
 * может и не иметь (в базе CI их несёт ровно один — тот, которому их
 * посеяла фикстура), поэтому перебираем до трёх и берём первый со звуком.
 * Без клипов мерить скачивание звука было бы нечем, и молчать об этом
 * нельзя — поэтому отсутствие звука у всех трёх роняет пробу.
 */
async function openStoryWithClips(page: Page): Promise<{ href: string; clips: number }> {
  await page.locator('a[href="/es/stories"]').first().click();
  await page.waitForURL(/\/es\/stories$/, { timeout: 30_000 });
  const hrefs = (await page.locator('a[href^="/es/stories/"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href")).filter((href): href is string => Boolean(href)),
  )).filter((href, index, all) => all.indexOf(href) === index);
  expect(hrefs.length, "в каталоге рассказов нет ни одной ссылки").toBeGreaterThan(0);

  for (const href of hrefs.slice(0, 6)) {
    await visit(page, "/es/stories");
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await page.waitForTimeout(1500);
    const clips = await page.locator("[data-rf-clip]").count();
    if (clips > 0) return { href, clips };
  }
  throw new Error("ни у одного из проверенных рассказов нет клипов озвучки в разметке — скачивать звук нечем");
}

/**
 * Сумма настоящих `Content-Length` всех клипов страницы и вес её разметки —
 * ДВУМЯ ЧИСЛАМИ, а не одним, и это замер, а не удобство. Прогон 26.09.2026
 * дал расхождение в 8 байт между этим замером и тем, что записала кнопка:
 * разметку кнопка снимает в момент скачивания, когда её собственная
 * подпись уже сменилась с «Descargar» на «Descargar 21,5 MB», — то есть
 * страница и правда стала на несколько байт другой. Клипы при этом
 * сходятся ЗНАК В ЗНАК, и сходиться обязаны: в них весь вес.
 */
async function honestWeight(page: Page): Promise<{ clips: number; page: number }> {
  return page.evaluate(async () => {
    const urls = [
      ...new Set(
        [...document.querySelectorAll("[data-rf-clip]")]
          .map((node) => node.getAttribute("data-rf-clip"))
          .filter((url): url is string => Boolean(url)),
      ),
    ];
    let clips = 0;
    for (const url of urls) {
      const response = await fetch(url, { method: "HEAD", mode: "cors", credentials: "omit", cache: "no-store" });
      clips += Number(response.headers.get("content-length") ?? "0");
    }
    return {
      clips,
      page: new TextEncoder().encode(`<!doctype html>\n${document.documentElement.outerHTML}`).length,
    };
  });
}

function asMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const shown = mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
  return shown.replace(".", ",");
}


/**
 * ВЫХОД ИЗ УЧЁТНОЙ ЗАПИСИ — КНОПКОЙ, А НЕ ЗАПРОСОМ.
 *
 * Уборщик кешей заводится ПРИЗНАКОМ В АДРЕСЕ (`?signedout=1`), который
 * ставит маршрут выхода, и мимо кнопки его не получить. А сама кнопка
 * лежит во вкладке «Ajustes», внутри свёрнутого раздела аккордеона: пока
 * раздел закрыт, кнопка в разметке есть, но не видна, и нажатие ждало бы
 * её вечно (так и вышло на первом прогоне 26.09.2026 — тайм-аут 420 с).
 * Поэтому разделы раскрываются по одному, пока кнопка не покажется, —
 * ровно то, что делает руками человек.
 */
async function logoutByClick(page: Page, lang: "es" | "ru"): Promise<void> {
  await page.goto(`/${lang}/profile?tab=settings`);
  // Приветствие дня — во весь экран (`WelcomeOverlay`, `z-[60]`), и оно
  // перехватывает нажатия: без этого шага нажатие по заголовку раздела
  // жгло весь тайм-аут (прогон 26.09.2026, 300 с). Здесь оно снимается
  // условно, а не утверждением: утверждение «оно ГАРАНТИРОВАНО есть»
  // стоит там, где это первый заход нового аккаунта в кабинет
  // (`e2e/offline-downloads.spec.ts`), а сюда можно прийти и вторым.
  const greeting = page.getByRole("dialog", { name: "¡Feliz nuevo día de ruso!" });
  if (await greeting.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Continuar" }).click();
    await greeting.waitFor({ state: "hidden", timeout: 15_000 });
  }
  const submit = page.locator('form[action="/api/auth/logout"] button[type="submit"]').first();
  if (!(await submit.isVisible().catch(() => false))) {
    const headers = page.locator("button[aria-expanded]");
    const count = await headers.count();
    for (let i = 0; i < count; i += 1) {
      await headers.nth(i).click();
      if (await submit.isVisible().catch(() => false)) break;
    }
  }
  await submit.click();
  await page.waitForURL(new RegExp(`/${lang}(\\?|$)`), { timeout: 30_000 });
}

const button = "[data-rf-download-button]";

test("кнопка называет настоящий вес, качает страницу со звуком и не качает второй раз", async ({ page, context }) => {
  // Бюджет больше СУММЫ собственных ожиданий (409 с), иначе отказ пришёл бы
  // по потолку теста и указал на невиновный вызов — это ловит
  // `check:e2e-live-probes`, и ловит верно.
  test.setTimeout(480_000);
  const origin = await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const story = await openStoryWithClips(page);

  await expect(page.locator(button)).toHaveText(/Descargar/);

  // 1. ВЕС ДО НАЖАТИЯ. Сверяется с суммой настоящих ответов, посчитанной
  //    здесь же и независимо от кнопки.
  const measured = await honestWeight(page);
  expect(measured.clips, "вес клипов вышел нулевым — сверять не с чем").toBeGreaterThan(0);
  const expected = measured.clips + measured.page;
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(new RegExp(`Descargar ${asMb(expected)} MB`), {
    timeout: 60_000,
  });
  await expect(page.locator("[data-rf-download-note]")).toContainText(`${story.clips}`);

  // 2. СКАЧИВАНИЕ. Полоса «N / M» и «Descargado ✓» в конце.
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });
  expect(origin.hits.length, "за клипами никто не сходил — скачался бы текст без звука").toBeGreaterThanOrEqual(
    story.clips,
  );

  const laid = await page.evaluate(async () => {
    const cache = await caches.open("rf-pages-downloads");
    const keys = await cache.keys();
    const hit = await cache.match(new URL("/__rf-downloads-index", location.href).toString(), { ignoreVary: true });
    const rows = hit
      ? ((await hit.json()) as { url: string; bytes: number; pageBytes: number; clips: { bytes: number }[] }[])
      : [];
    return { keys: keys.length, rows };
  });
  expect(laid.rows, "строки описи скачанного нет").toHaveLength(1);
  expect(laid.rows[0].clips.length, "в строке описи ноль клипов").toBe(story.clips);
  // Клипы — знак в знак: в них весь вес, и тут «примерно» было бы враньём.
  expect(
    laid.rows[0].clips.reduce((sum, clip) => sum + clip.bytes, 0),
    "вес клипов в описи не совпал с настоящими ответами источника",
  ).toBe(measured.clips);
  // Разметка — с допуском в 4 КиБ: подпись самой кнопки к моменту
  // скачивания уже сменилась, и страница честно стала другой (разбор — у
  // `honestWeight`).
  expect(Math.abs(laid.rows[0].pageBytes - measured.page)).toBeLessThan(4096);
  expect(laid.rows[0].bytes).toBe(laid.rows[0].pageBytes + measured.clips);
  // Страница плюс все клипы плюс сама опись.
  expect(laid.keys).toBe(story.clips + 2);

  // 3. ВТОРОЕ НАЖАТИЕ НЕ КАЧАЕТ ЗАНОВО: кнопка приходит уже «Descargado»
  //    после перезагрузки, то есть знает о скачанном из кеша, а не из
  //    памяти вкладки.
  const hitsBefore = origin.hits.length;
  await page.reload();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 60_000 });
  await page.waitForTimeout(2000);
  expect(origin.hits.length, "перезагрузка страницы снова полезла за клипами").toBe(hitsBefore);

  // 4. ЭКРАН «DESCARGADO» В КАБИНЕТЕ: что лежит, вес каждого, общий вес.
  await page.goto("/es/profile");
  // Приветствие дня — во весь экран и перехватывает нажатия; у нового
  // аккаунта оно на первом заходе в кабинет ГАРАНТИРОВАНО (разбор — в
  // `helpers/welcome-overlay.ts`), поэтому его снятие здесь утверждение, а
  // не «на всякий случай».
  await dismissWelcomeOverlay(page);
  // Экран стоит на вкладке, открытой по умолчанию: два нажатия до него
  // человек бы не прошёл, и проба идёт тем же путём, что он. Утверждение
  // ПОЛОЖИТЕЛЬНОЕ: без него опечатка в признаке дала бы тот же зелёный на
  // трёх отрицательных проверках ниже.
  await expect(page.locator("[data-rf-downloads-panel]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-rf-downloads-total]")).toContainText(`${asMb(expected)} MB`);
  await expect(page.locator("[data-rf-downloads-list] li")).toHaveCount(1);
  await expect(page.locator("[data-rf-downloads-panel]")).not.toContainText("Incompleto");

  // 5. УДАЛЕНИЕ ОДНОГО: и страница, и клипы, и строка уходят.
  await page.locator(`[data-rf-downloads-remove="${story.href}"]`).click();
  await expect(page.locator("[data-rf-downloads-empty]")).toBeVisible({ timeout: 30_000 });
  const left = await page.evaluate(async () => {
    const cache = await caches.open("rf-pages-downloads");
    return (await cache.keys()).map((request) => request.url);
  });
  expect(left.filter((url) => url.endsWith(".mp3")), "клипы удалённого материала остались на телефоне").toHaveLength(0);

  await context.unroute("**/*").catch(() => {});
  await context.setOffline(false);
});

test("скачанное открывается без сети, звучит, переживает выкат сайта и уходит при выходе", async ({ page, context }) => {
  // Та же причина: сумма собственных ожиданий 617,5 с.
  test.setTimeout(660_000);
  await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const story = await openStoryWithClips(page);
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });

  // Просто ПРОСМОТРЕННЫЙ урок рядом — он и будет обратным контролем для
  // выката: у него копия в кеше с отпечатком сборки, и выкат её уносит.
  await page.locator('a[href="/es/courses"]').first().click();
  await page.waitForURL(/\/es\/courses$/, { timeout: 30_000 });
  await page.locator('a[href="/es/courses/a1"]').first().click();
  await page.waitForURL(/\/es\/courses\/a1$/, { timeout: 30_000 });
  const lessonHref = (await page.locator('a[href^="/es/courses/a1/"]').first().getAttribute("href"))!;
  await page.locator(`a[href="${lessonHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${lessonHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);

  // ====== БЕЗ СЕТИ: список, блок скачанного, звук ======
  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-downloads]:not([hidden])", { timeout: 25_000 });

  await expect(page.locator("[data-downloads-total]")).toContainText(/MB/);
  await expect(page.locator("[data-downloads-list] li")).toHaveCount(1);
  const savedRow = page.locator("[data-saved-list] li button").filter({ hasText: "Descargado" }).first();
  await expect(savedRow, "в списке сохранённого скачанное не помечено словом «Descargado»").toBeVisible();

  await savedRow.click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });
  const armed = await page.locator("[data-rf-clip-armed]").count();
  expect(armed, "каркас не привязал ни одного клипа к сохранённой копии — звук молчит").toBeGreaterThan(0);

  // ЗВУК ИГРАЕТ ИЗ КЕША: нажатие не гасит элемент (гаснет он ровно тогда,
  // когда клипа на телефоне нет, — обратный контроль ниже).
  const clipNode = page.locator("[data-rf-clip-armed]").first();
  const clipUrl = (await clipNode.getAttribute("data-rf-clip"))!;
  await clipNode.click();
  await page.waitForTimeout(1500);
  expect(await clipNode.getAttribute("aria-disabled"), "звук не нашёлся в кеше скачанного").toBeNull();

  // ОБРАТНЫЙ КОНТРОЛЬ ТУТ ЖЕ: убираем этот клип из всех кешей и жмём снова.
  await page.evaluate(async (url) => {
    for (const name of await caches.keys()) {
      await (await caches.open(name)).delete(url, { ignoreVary: true });
    }
  }, clipUrl);
  await clipNode.click();
  await expect(clipNode, "клипа на телефоне нет, а нажатие молчит вместо честного отказа").toHaveAttribute(
    "aria-disabled",
    "true",
    { timeout: 15_000 },
  );

  // ====== ВЫКАТ САЙТА ======
  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const wiped = await page.evaluate(async () => {
    let removed = 0;
    for (const name of await caches.keys()) {
      // Ровно то, что делает новая сборка: уносит кеши со ЧУЖИМ
      // отпечатком. Кеш скачанного отпечатка не несёт и остаётся.
      if (/^rf-pages(-content|-section|-rsc|-rsc-prefetch|-others)?-[a-z0-9]+$/.test(name) && name !== "rf-pages-downloads") {
        if (await caches.delete(name)) removed += 1;
      }
    }
    return removed;
  });
  expect(wiped, "кешей с отпечатком сборки не было вовсе — выкат изобразить было нечем").toBeGreaterThan(0);

  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const rowsAfterDeploy = await page.evaluate(() =>
    [...document.querySelectorAll("[data-saved-list] li button")].map((node) =>
      (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
    ),
  );
  // СКАЧАННОЕ — ЖИВО.
  expect(rowsAfterDeploy.join(" | "), "выкат сайта унёс скачанное — долг 308 не закрыт").toMatch(/Descargado/);
  // А ПРОСТО ПРОСМОТРЕННОЕ — НЕТ, и это честная цена, названная вслух.
  expect(
    rowsAfterDeploy.length,
    "после выката в списке осталось больше одной строки — просмотренное обязано было уйти вместе с кешем сборки",
  ).toBe(1);

  await page.locator("[data-saved-list] li button").first().click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });

  // ====== ВЫХОД ИЗ УЧЁТНОЙ ЗАПИСИ ======
  await context.unroute("**/*");
  await context.setOffline(false);
  await logoutByClick(page, "es");
  await expect
    .poll(
      async () =>
        page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("rf-pages")).length),
      { timeout: 20_000 },
    )
    .toBe(0);

  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const afterLogout = await page.evaluate(() => ({
    items: document.querySelectorAll("[data-saved-list] li").length,
    downloadsHidden: (document.querySelector("[data-downloads]") as HTMLElement | null)?.hidden,
    gauge: document.querySelector("[data-saved-gauge]")?.textContent ?? "",
  }));
  expect(afterLogout.items, "после выхода скачанное осталось на телефоне").toBe(0);
  expect(afterLogout.downloadsHidden, "блок скачанного показан после выхода").toBe(true);
  expect(afterLogout.gauge).toMatch(/Guardado: 0/);

  await context.unroute("**/*");
  await context.setOffline(false);
});
