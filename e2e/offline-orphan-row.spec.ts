import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * СТРОКА СПИСКА БЕЗ КОПИИ ПОД НЕЙ — ЗАХОД 7.231, СТРОКА 310.
 *
 * ====================================================================
 * ДОСЛОВНЫЙ СЦЕНАРИЙ ВЛАДЕЛЬЦА (видео 25.09.2026, сборка 1.0.6, POCO X6
 * Pro, Android 16, 7:10–7:12 по часам телефона)
 * ====================================================================
 *
 * Вошёл под учётной записью → страницы сохранились сами (7.230) → с Wi-Fi
 * открыл «Mi perfil» → «Cerrar sesión» → дальше ГОСТЕМ с Wi-Fi открыл
 * «Снегурочку» (бесплатный рассказ A1, слушал звук), «Cuentos»,
 * «Vocabulario» и урок A1/1 → убил приложение → включил самолётный режим →
 * открыл приложение. Без сети в списке «Guardado en este teléfono» лежало
 * ПЯТЬ строк; строка «Снегурочка» была серой и писала «No disponible»,
 * остальные четыре открывались. Выката сайта между шагами НЕ БЫЛО — то
 * есть долг 308 тут не при чём.
 *
 * ====================================================================
 * ПРИЧИНА — ДОКАЗАНА, И ДОКАЗАНА НЕ ЗДЕСЬ
 * ====================================================================
 *
 * Механизм воспроизведён прогоном на подставных кешах в
 * `src/lib/offline-save-client.test.ts` (описание «строка 310»): уборщик
 * выхода стирает кеши `rf-pages*` ЦЕЛИКОМ и делает это своим фоновым
 * «потом» (`SignedOutCachePurge`, `void (async () => …)()`). Первая
 * страница, которую гость открывает после выхода, сохраняется
 * ОДНОВРЕМЕННО с этой уборкой. Если уборка успевает между `cache.put`
 * (копия легла) и записью описи, то `caches.open` создаёт кеш ЗАНОВО,
 * пустым, и опись ложится в него строкой, под которой копии нет. Первой
 * страницей после выхода была ровно «Снегурочка».
 *
 * Точное совмещение двух «потом» по настенным часам браузера
 * воспроизводить здесь НЕ НАДО и было бы неправдой о пробе: это гонка, и
 * место ей — там, где порядок вызовов задаётся, то есть в примере с
 * подставным хранилищем. Здесь проверяется то, что ВИДИТ ЧЕЛОВЕК, и
 * проверяется на том самом состоянии телефона, которое он снял на видео:
 * опись знает о копии, которой в кеше нет.
 *
 * ПРАВИЛО, КОТОРОЕ ЗДЕСЬ ДЕРЖИТСЯ: строка в списке появляется ТОЛЬКО если
 * копия реально лежит; иначе её нет. Серая «No disponible» при этом
 * оставлена последним рубежом — копию может унести между отрисовкой
 * списка и нажатием.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");

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
  /**
   * Приветствие дня — во весь экран (`WelcomeOverlay`, `z-[60]`), и оно
   * перехватывает нажатия.
   *
   * СНИМАЕТСЯ УТВЕРЖДЕНИЕМ, А НЕ УСЛОВНО — ПОЧИНКА 27.09.2026 (7.232).
   * Прежний вид (`isVisible()` один раз и «нет так нет») — сам по себе
   * гонка: признак ставится эффектом ПОСЛЕ гидрации, и одна мгновенная
   * проверка успевает раньше него. CI 27.09.2026 на `origin/main` так и
   * встал: 789 попыток нажать заголовок раздела, каждую перехватывал
   * `<div role="dialog" aria-label="¡Feliz nuevo día de ruso!">`, и тест
   * сжёг весь бюджет 420 с. Здесь это ПЕРВЫЙ заход нового аккаунта в
   * кабинет, значит приветствие гарантировано, и ждать его — утверждение,
   * а не догадка (разбор — в шапке `helpers/welcome-overlay.ts`).
   */
  await dismissWelcomeOverlay(page);
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

/** Строки списка каркаса: название и подпись вида, как их видит человек. */
async function shellRows(page: Page): Promise<{ text: string; disabled: boolean }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-saved-list] li button")].map((node) => ({
      text: (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
      disabled: (node as HTMLButtonElement).disabled,
    })),
  );
}

/** Ходим КЛИКАМИ, как человек: внутри оболочки полная навигация бывает
 *  только стартовая (замер 7.230 на настоящем Android). */
async function walkContentByClicks(page: Page, lang: "es" | "ru"): Promise<string> {
  await page.locator(`a[href="/${lang}/stories"]`).first().click();
  await page.waitForURL(new RegExp(`/${lang}/stories$`), { timeout: 30_000 });
  const storyHref = await page.locator(`a[href^="/${lang}/stories/"]`).first().getAttribute("href");
  expect(storyHref, "в каталоге рассказов нет ни одной ссылки — мерить нечего").toBeTruthy();
  await page.locator(`a[href="${storyHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${storyHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);

  await page.locator(`a[href="/${lang}/courses"]`).first().click();
  await page.waitForURL(new RegExp(`/${lang}/courses$`), { timeout: 30_000 });
  await page.locator(`a[href="/${lang}/courses/a1"]`).first().click();
  await page.waitForURL(new RegExp(`/${lang}/courses/a1$`), { timeout: 30_000 });
  const lessonHref = await page.locator(`a[href^="/${lang}/courses/a1/"]`).first().getAttribute("href");
  await page.locator(`a[href="${lessonHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${lessonHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);
  return storyHref!;
}

test("строки списка нет там, где нет копии, — и есть там, где копия лежит", async ({ page, context }) => {
  // Бюджет больше суммы собственных ожиданий (308,5 с) — правило
  // `check:e2e-live-probes`: иначе отказ придёт по потолку теста и укажет
  // на невиновный вызов.
  test.setTimeout(360_000);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const storyHref = await walkContentByClicks(page, "es");

  // 1. ПОЗИТИВНЫЙ КОНТРОЛЬ, И ОН ЗДЕСЬ ПЕРВЫЙ: пока копия лежит, строка
  //    рассказа в списке ЕСТЬ. Без этого шага «строки нет» доказывало бы
  //    ровно то, что сохранение сломано вообще.
  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved-list] li button", { timeout: 25_000 });
  const before = await shellRows(page);
  expect(before.length, "после прохода по рассказу и уроку список пуст").toBeGreaterThan(1);
  expect(before.some((row) => /Cuento/.test(row.text)), "рассказа в списке нет — контроль провален").toBe(true);

  // 2. ТЕПЕРЬ РОВНО ТО СОСТОЯНИЕ ТЕЛЕФОНА, ЧТО НА ВИДЕО: опись знает о
  //    копии рассказа, а копии в кеше больше нет (её унёс уборщик выхода,
  //    успевший между `put` и описью — разбор в шапке).
  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const removed = await page.evaluate(async (href) => {
    let count = 0;
    for (const name of await caches.keys()) {
      if (!/^rf-pages-content-[a-z0-9]+$/.test(name)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname !== href) continue;
        if (await cache.delete(request, { ignoreVary: true })) count += 1;
      }
    }
    return count;
  }, storyHref);
  expect(removed, "копии рассказа не было вовсе — стирать было нечего, и замер ничего не доказал бы").toBeGreaterThan(0);

  const indexStillKnows = await page.evaluate(async (href) => {
    for (const name of await caches.keys()) {
      if (!/^rf-pages-content-[a-z0-9]+$/.test(name)) continue;
      const hit = await (await caches.open(name)).match(new URL("/__rf-offline-index", location.href).toString(), {
        ignoreVary: true,
      });
      if (!hit) continue;
      const rows = (await hit.json()) as { path: string }[];
      if (rows.some((row) => row.path === href)) return true;
    }
    return false;
  }, storyHref);
  expect(
    indexStillKnows,
    "опись уже не знает о рассказе — состояние с видео не собрано, и отсев проверять не на чем",
  ).toBe(true);

  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const after = await shellRows(page);

  // ГЛАВНОЕ УТВЕРЖДЕНИЕ ЗАХОДА: строки без копии в списке НЕТ ВОВСЕ — ни
  // серой, ни какой. И ни одна из оставшихся строк не выключена.
  expect(after.some((row) => /No disponible/.test(row.text)), "серая строка «No disponible» вернулась").toBe(false);
  expect(after.length, "отсев снёс список целиком — он обязан был снять ОДНУ строку").toBeGreaterThan(0);
  expect(after.length, "список не стал короче — строка без копии всё ещё обещает").toBeLessThan(before.length);
  expect(after.some((row) => row.disabled), "в списке осталась выключенная строка").toBe(false);

  // И каждая строка, которая осталась, и правда открывается.
  const first = page.locator("[data-saved-list] li button").first();
  await first.click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });

  await context.unroute("**/*");
  await context.setOffline(false);
});

test("сценарий владельца целиком: выход → гость → рассказ → без сети список честен", async ({ page, context }) => {
  // Та же причина: сумма собственных ожиданий 338,5 с.
  test.setTimeout(420_000);

  // Шаг 1. Вошёл, походил — копии легли.
  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await walkContentByClicks(page, "es");

  // Шаг 2. «Mi perfil» → «Cerrar sesión». Кнопкой, а не запросом: уборщик
  // кешей заводится ПРИЗНАКОМ В АДРЕСЕ (`?signedout=1`), который ставит
  // именно маршрут выхода, и мимо кнопки его не получить.
  await logoutByClick(page, "es");
  // Уборка — фоновая, и ждём мы именно её окончания: опись обязана уйти
  // вместе с кешами. Это и есть «Guardado: 0» с видео.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("rf-pages")).length),
      { timeout: 20_000 },
    )
    .toBe(0);

  // Шаг 3. Гостем, с сетью, кликами — рассказ, каталоги, урок.
  await walkContentByClicks(page, "es");

  // Шаг 4. Без сети: каждая показанная строка обязана открыться.
  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const rows = await shellRows(page);
  expect(rows.length, "гость прошёл рассказ, каталоги и урок, а список пуст").toBeGreaterThan(0);
  expect(rows.some((row) => /No disponible/.test(row.text)), "после выхода и захода гостем вернулась серая строка").toBe(
    false,
  );

  const count = await page.locator("[data-saved-list] li button").count();
  for (let i = 0; i < count; i += 1) {
    await visit(page, "/es");
    await page.waitForSelector("[data-saved-list] li button", { timeout: 25_000 });
    const button = page.locator("[data-saved-list] li button").nth(i);
    const name = (await button.innerText()).split("\n")[0].trim();
    await button.click();
    const opened = await page
      .waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    expect(opened, `строка «${name}» показана в списке, а копии под ней нет — это и есть строка 310`).toBe(true);
  }

  await context.unroute("**/*");
  await context.setOffline(false);
});
