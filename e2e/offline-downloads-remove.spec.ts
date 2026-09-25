import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * УДАЛЕНИЕ СКАЧАННОГО — ЗАХОД 7.232, ЗАДАЧА 6 (ПРОВЕРКА ПРОБОЙ, НЕ ЧТЕНИЕМ).
 *
 * Владелец спросил две вещи, и обе про то, что случится ПОСЛЕ нажатия, —
 * значит отвечать на них чтением исходника нельзя.
 *
 * 1. «Borrar todo» обязана спрашивать подтверждение. Кнопка уносит
 *    мегабайты, которые качали по одному, и вернуть их можно только
 *    сетью, которой рядом может не быть. Проверяется ОБЕИМИ ветками:
 *    отказ в окне обязан ОСТАВИТЬ скачанное (без этого «спросила» ничего
 *    не значит — спросить и всё равно стереть тоже можно).
 * 2. «Borrar» у материала, который И скачан, И просто просмотрен, уносит
 *    ТОЛЬКО скачанную копию. Строка просмотренного остаётся и
 *    открывается — и это задумано: просмотренное и скачанное это два
 *    разных обещания (разбор — в шапке `src/lib/downloads.ts`), и
 *    удаление одного не имеет права уносить другое.
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

async function openStoryWithClips(page: Page): Promise<{ href: string; clips: number }> {
  await page.locator('a[href="/es/stories"]').first().click();
  await page.waitForURL(/\/es\/stories$/, { timeout: 30_000 });
  const hrefs = (
    await page.locator('a[href^="/es/stories/"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")).filter((href): href is string => Boolean(href)),
    )
  ).filter((href, index, all) => all.indexOf(href) === index);
  expect(hrefs.length, "в каталоге рассказов нет ни одной ссылки").toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 6)) {
    await visit(page, "/es/stories");
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await page.waitForTimeout(1500);
    const clips = await page.locator("[data-rf-clip]").count();
    if (clips > 0) return { href, clips };
  }
  throw new Error("ни у одного из проверенных рассказов нет клипов озвучки — скачивать нечего");
}

const button = "[data-rf-download-button]";

/**
 * ЧТО ИЗ СКАЧАННОГО ЛЕЖИТ НА ТЕЛЕФОНЕ. Сама опись в счёт не идёт: после
 * удаления одного материала она остаётся на месте пустым списком — это
 * не остаток материала, а список, в котором больше нечего перечислять.
 */
async function downloadedKeys(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    if (!(await caches.keys()).includes("rf-pages-downloads")) return [];
    return (await (await caches.open("rf-pages-downloads")).keys())
      .map((request) => request.url)
      .filter((url) => !url.endsWith("/__rf-downloads-index"));
  });
}

test("«Borrar todo» спрашивает подтверждение: отказ оставляет скачанное, согласие уносит", async ({ page, context }) => {
  // Бюджет больше суммы собственных ожиданий (350 с).
  test.setTimeout(420_000);
  await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await openStoryWithClips(page);
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });

  await page.goto("/es/profile");
  await dismissWelcomeOverlay(page);
  await expect(page.locator("[data-rf-downloads-list] li")).toHaveCount(1, { timeout: 30_000 });

  // ВЕТКА «ОТКАЗАЛСЯ». Окно обязано появиться — без него обработчик
  // `dialog` не сработает ни разу, и проба это увидит числом.
  let asked = 0;
  const refuse = (dialog: { type: () => string; message: () => string; dismiss: () => Promise<void> }) => {
    asked += 1;
    expect(dialog.type(), "спросили не подтверждением").toBe("confirm");
    expect(dialog.message(), "в вопросе не сказано, что именно унесут").toMatch(/Borrar todo|descargado/i);
    void dialog.dismiss();
  };
  page.on("dialog", refuse);
  await page.locator("[data-rf-downloads-remove-all]").click();
  await page.waitForTimeout(3000);
  expect(asked, "«Borrar todo» унесла скачанное, ни о чём не спросив").toBe(1);
  await expect(page.locator("[data-rf-downloads-list] li")).toHaveCount(1);
  expect((await downloadedKeys(page)).length, "отказ в окне всё равно стёр скачанное").toBeGreaterThan(0);
  page.off("dialog", refuse);

  // ВЕТКА «СОГЛАСИЛСЯ». Та же кнопка, тот же вопрос — и теперь пусто.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.locator("[data-rf-downloads-remove-all]").click();
  await expect(page.locator("[data-rf-downloads-empty]")).toBeVisible({ timeout: 30_000 });
  expect(await downloadedKeys(page), "согласие не унесло ни одной записи").toHaveLength(0);
});

test("«Borrar» у скачанного НЕ уносит просто просмотренное: строка остаётся и открывается", async ({
  page,
  context,
}) => {
  // Бюджет больше суммы собственных ожиданий (365 с).
  test.setTimeout(480_000);
  await serveClipLocally(context);

  await loginWithSubscription(page);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const story = await openStoryWithClips(page);
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });

  // ПРОСТО ПРОСМОТРЕНО ТОЖЕ: страница кладёт свою копию сама (7.230).
  // Утверждение положительное — без него весь остальной тест доказывал бы
  // лишь то, что просмотренного не было вовсе.
  await page.reload();
  await page.waitForTimeout(5000);
  const viewedToo = await page.evaluate(async (href) => {
    for (const name of await caches.keys()) {
      if (!/^rf-pages-content-[a-z0-9]+$/.test(name)) continue;
      for (const request of await (await caches.open(name)).keys()) {
        if (new URL(request.url).pathname === href) return true;
      }
    }
    return false;
  }, story.href);
  expect(viewedToo, "просмотренной копии рядом со скачанной нет — удалять одно из двух нечего").toBe(true);

  // Без сети строка говорит «Descargado» — два обещания не выглядят
  // одинаково.
  await becomeNativeShell(page, context);
  await visit(page, "/es");
  await page.waitForSelector("[data-downloads-list] li", { timeout: 25_000 });
  await expect(page.locator("[data-saved-list] li button").first()).toContainText("Descargado");

  // НАЖАТИЕ «BORRAR» У СКАЧАННОГО.
  await page.locator(`[data-downloads-remove="${story.href}"]`).click();
  await page.waitForTimeout(4000);
  expect(await downloadedKeys(page), "скачанное осталось на телефоне").toHaveLength(0);

  // СТРОКА ПРОСМОТРЕННОГО ОСТАЛАСЬ — и открывается.
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("[data-saved-list] li button")].map((node) =>
      (node as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
    ),
  );
  expect(rows.length, "вместе со скачанным унесли и просмотренное").toBeGreaterThan(0);
  expect(rows.some((row) => /Descargado/.test(row)), "строка всё ещё обещает скачанное, которого нет").toBe(false);
  await page.locator("[data-saved-list] li button").first().click();
  await page.waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 });

  await context.unroute("**/*").catch(() => {});
  await context.setOffline(false);
});
