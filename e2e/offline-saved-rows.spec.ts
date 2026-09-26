import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { reachShell } from "./helpers/offline-shell";

/**
 * СПИСОК СОХРАНЁННОГО ГОВОРИТ ПРАВДУ — ЗАХОД 7.232, СТРОКА 312.
 *
 * ====================================================================
 * ДОСЛОВНЫЙ СЦЕНАРИЙ ВЛАДЕЛЬЦА (видео 25.09.2026, сборка 1.0.7
 * `versionCode 8`, POCO X6 Pro, Android 16; сайт — после мержей #406,
 * #407, #408, то есть ВЫКАТ МЕЖДУ ШАГАМИ БЫЛ)
 * ====================================================================
 *
 * 1:40–1:54. Без сети, каркас, список «Guardado en este teléfono»: одна
 * строка — «/es/stories · Sección», ГОЛЫЙ АДРЕС вместо названия. Нажатие
 * → строка становится серой «No disponible» → исчезает → «Aún no hay nada
 * guardado», а внизу по-прежнему «Guardado: 1».
 *
 * 3:48 и 8:00. Строка «Curso de ruso online · Sección» при нажатии
 * становится серой «No disponible», потом снова рисуется обычной. В той
 * же выборке строка «/es/vocabulary · Vocabulario» — опять голый адрес.
 *
 * ====================================================================
 * ПРИЧИНА — ДОКАЗАНА ПРОГОНОМ, И ПРАВИЛО 7.231 ТУТ НИ ПРИ ЧЁМ
 * ====================================================================
 *
 * Копия ЛЕЖАЛА. Правило 7.231 («строка появляется только под реально
 * лежащую копию») соблюдено — и всё равно нажатие гасло, потому что
 * «есть ли ответ в кеше» и «можно ли этот ответ ПОКАЗАТЬ» — разные
 * вопросы. Показать нельзя ответ не `ok`, пустое тело и копию, ни один
 * лист стилей которой не лежит на телефоне: `renderSaved` при
 * `sheets.length === 0` честно отказывает, потому что голая разметка в
 * триста килобайт читается хуже каркаса. А после выката сайта рядом
 * оказываются ДВА отпечатка сборки: копии старого остаются (каркас берёт
 * имена из живого списка — так решено в `documentCacheNames`, долг 308),
 * а их листы стилей ушли вместе с их precache.
 *
 * Оттуда же и голый адрес: описей тоже две, а `readIndex` брал ПЕРВУЮ
 * попавшуюся — строки второй теряли названия и подбирались запасным
 * источником (ключи кешей) уже без них.
 *
 * ====================================================================
 * ЧТО ИМЕННО ЗДЕСЬ ПРОВЕРЯЕТСЯ
 * ====================================================================
 *
 * Состояние телефона собирается РУКАМИ и ровно то, что было на видео:
 * копия раздела лежит, но её лист стилей на телефоне отсутствует, а
 * названия у строки нет. Точное совпадение двух выкатов по настенным
 * часам воспроизводить здесь не надо и было бы неправдой о пробе:
 * проверяется то, что ВИДИТ ЧЕЛОВЕК.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");

/** Разделы, ради которых заведена строка 312. Все три — с видео. */
const SECTION_PATHS = ["/es/stories", "/es/courses", "/es/vocabulary"] as const;

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

/** Строки списка каркаса — как их видит человек. */
async function shellRows(page: Page): Promise<{ text: string; disabled: boolean }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-saved-list] li button")].map((node) => ({
      text: (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
      disabled: (node as HTMLButtonElement).disabled,
    })),
  );
}

async function gaugeNumber(page: Page): Promise<number> {
  const text = await page.evaluate(() => document.querySelector("[data-saved-gauge]")?.textContent ?? "");
  return Number(/(\d+)/.exec(text)?.[1] ?? "-1");
}

/**
 * СРАВНЕНИЕ НА ДВУХ ПУСТЫХ ВЫБОРКАХ ОБЯЗАНО ПАДАТЬ. Без этой строки
 * утверждение «список стал короче» выполнялось бы и тогда, когда до и
 * после по нулю: ноль не короче нуля, но проба, написанная небрежно,
 * прошла бы. Тем же правилом держится соседняя проба 7.230.
 */
function shrank(before: readonly unknown[], after: readonly unknown[], what: string): void {
  expect(before.length + after.length, `${what}: обе выборки пусты — сравнивать нечего, а значит и доказано ничего`)
    .toBeGreaterThan(0);
  expect(before.length, `${what}: до отсева список был пуст — отсевать было нечего`).toBeGreaterThan(0);
  expect(after.length, `${what}: список не стал короче — строка, которую нельзя показать, всё ещё обещает`)
    .toBeLessThan(before.length);
}

test("прибор «стало короче» сам падает на двух пустых выборках", () => {
  expect(() => shrank([], [], "самопроверка")).toThrow();
  expect(() => shrank(["a", "b"], ["a"], "самопроверка")).not.toThrow();
  expect(() => shrank(["a"], ["a", "b"], "самопроверка")).toThrow();
  expect(() => shrank([], ["a"], "самопроверка")).toThrow();
});

test("строка раздела, которую нельзя показать, из списка уходит; остальные открываются и названы словами", async ({
  page,
  context,
}) => {
  // Бюджет больше суммы собственных ожиданий (308,5 с) — правило
  // `check:e2e-live-probes`: иначе отказ придёт по потолку теста и укажет
  // на невиновный вызов.
  test.setTimeout(360_000);

  // ШАГ 1. Гостем, с сетью, КЛИКАМИ — как человек внутри оболочки
  // (замер 7.230 на настоящем Android: полная навигация там одна,
  // стартовая). Разделы сохраняются сами (7.230).
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  for (const path of SECTION_PATHS) {
    await page.locator(`a[href="${path}"]`).first().click();
    await page.waitForURL(new RegExp(`${path}$`), { timeout: 30_000 });
    await page.waitForTimeout(4000);
  }
  // И один УРОК — он остаётся целым и служит вторым контролем: отсев
  // обязан снять строки, которые показать нельзя, и не тронуть те, что
  // можно. Сторож, который сносит список целиком, не сторож.
  await page.locator('a[href="/es/courses"]').first().click();
  await page.waitForURL(/\/es\/courses$/, { timeout: 30_000 });
  await page.locator('a[href="/es/courses/a1"]').first().click();
  await page.waitForURL(/\/es\/courses\/a1$/, { timeout: 30_000 });
  const lessonHref = await page.locator('a[href^="/es/courses/a1/"]').first().getAttribute("href");
  expect(lessonHref, "на странице уровня нет ни одной ссылки на урок — второй контроль собрать не из чего").toBeTruthy();
  await page.locator(`a[href="${lessonHref}"]`).first().click();
  await page.waitForURL(new RegExp(`${lessonHref}$`), { timeout: 30_000 });
  await page.waitForTimeout(4000);

  const saved = await page.evaluate(async (paths) => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      if (!/^rf-pages-(content|section)-[a-z0-9]+$/.test(name)) continue;
      for (const request of await (await caches.open(name)).keys()) {
        const path = new URL(request.url).pathname;
        if ((paths as readonly string[]).includes(path)) out.push(path);
      }
    }
    return out;
  }, SECTION_PATHS);
  expect(
    saved.length,
    "ни один из трёх разделов не сохранился — дальше мерить нечего, и «строки нет» ничего не доказало бы",
  ).toBeGreaterThan(0);

  // ШАГ 2. ПОЗИТИВНЫЙ КОНТРОЛЬ, И ОН ПЕРВЫЙ: пока всё на месте, строки
  // есть, НАЗВАНЫ СЛОВАМИ (а не адресом) и открываются.
  await becomeNativeShell(page, context);
  // ПЕРЕХОД, КОТОРЫЙ НЕ ТЕРЯЕТСЯ (заход 7.233): выключение сети заставляет
  // живую страницу перейти на саму себя, и `goto` сразу после него
  // отменяется — каркас открывается по ЧУЖОМУ адресу и честно показывает
  // копию той страницы, а списка на экране копии нет. Разбор и замер — в
  // `helpers/offline-shell.ts`.
  const first = await reachShell(page, "/es");
  expect(first.arrived, `каркас не открылся по /es — страница осталась на ${first.where}`).toBe(true);
  await page.waitForSelector("[data-saved-list] li button", { timeout: 25_000 });
  const before = await shellRows(page);
  expect(before.length, "список пуст после прохода по трём разделам").toBeGreaterThan(0);
  for (const row of before) {
    expect(row.text, `строка списка показывает адрес вместо названия: «${row.text}»`).not.toMatch(/^\/(es|ru)\//);
  }
  expect(await gaugeNumber(page), "прибор спорит с тем, что под ним нарисовано").toBe(before.length);
  await page.locator("[data-saved-list] li button").first().click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });

  // ШАГ 3. РОВНО СОСТОЯНИЕ С ВИДЕО: копии разделов остались от ПРЕЖНЕЙ
  // сборки — их листы стилей на телефоне уже не лежат, — а названий у
  // строк нет (опись второй сборки каркасу не досталась).
  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const spoiled = await page.evaluate(async (paths) => {
    let count = 0;
    for (const name of await caches.keys()) {
      if (!/^rf-pages-(content|section)-[a-z0-9]+$/.test(name)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname;
        if (!(paths as readonly string[]).includes(path)) continue;
        const hit = await cache.match(request, { ignoreVary: true });
        if (!hit) continue;
        const html = (await hit.text())
          .replace(/href="\/_next\/static\/css\/[^"]*"/g, 'href="/_next/static/css/sborka-kotoroy-bolshe-net.css"')
          .replace(/<title>[\s\S]*?<\/title>/i, "<title></title>");
        await cache.put(
          request,
          new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
        );
        count += 1;
      }
      // Опись «второй сборки» каркасу не досталась — убираем названия и
      // из неё: ровно так на телефоне и получился голый адрес.
      const index = await cache.match(new URL("/__rf-offline-index", location.href).toString(), { ignoreVary: true });
      if (index) {
        const rows = (await index.json()) as { path: string; title: string }[];
        for (const row of rows) if ((paths as readonly string[]).includes(row.path)) row.title = "";
        await cache.put(
          new URL("/__rf-offline-index", location.href).toString(),
          new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } }),
        );
      }
    }
    return count;
  }, SECTION_PATHS);
  expect(spoiled, "ни одной копии раздела испортить не удалось — состояние с видео не собрано").toBeGreaterThan(0);

  // ШАГ 4. ГЛАВНОЕ УТВЕРЖДЕНИЕ ЗАХОДА.
  await becomeNativeShell(page, context);
  const again = await reachShell(page, "/es");
  expect(again.arrived, `каркас не открылся по /es — страница осталась на ${again.where}`).toBe(true);
  await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
  const after = await shellRows(page);

  shrank(before, after, "строки, которую нельзя показать, в списке нет");
  expect(after.some((row) => /No disponible|Недоступно/.test(row.text)), "серая строка «No disponible» вернулась").toBe(
    false,
  );
  expect(after.some((row) => row.disabled), "в списке осталась выключенная строка").toBe(false);
  for (const row of after) {
    expect(row.text, `строка списка показывает адрес вместо названия: «${row.text}»`).not.toMatch(/^\/(es|ru)\//);
  }
  expect(await gaugeNumber(page), "прибор спорит с тем, что под ним нарисовано").toBe(after.length);

  // И каждая оставшаяся строка и правда открывается.
  const count = await page.locator("[data-saved-list] li button").count();
  expect(count, "после отсева не осталось ни одной строки — открывать нечего").toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const back = await reachShell(page, "/es");
    expect(back.arrived, `каркас не открылся по /es — страница осталась на ${back.where}`).toBe(true);
    await page.waitForSelector("[data-saved-list] li button", { timeout: 25_000 });
    const button = page.locator("[data-saved-list] li button").nth(i);
    const name = (await button.innerText()).split("\n")[0].trim();
    await button.click();
    const opened = await page
      .waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    expect(opened, `строка «${name}» показана в списке, а показать её телефон не может`).toBe(true);
  }

  await context.unroute("**/*");
  await context.setOffline(false);
});
