import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { fillAllExercises } from "./helpers/exercises";
import { reachShell } from "./helpers/offline-shell";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * «BORRAR TODO» БЕЗ СЕТИ И ОЧЕРЕДЬ ОТВЕТОВ — ЗАХОД 7.237.
 *
 * Правило: «Borrar todo» и «Borrar» стирают только скачанное; очередь
 * ответов стирает только успешная отправка (или выход по правилу 7.236).
 * Владелец 27.09.2026 нажал «Borrar todo» без сети с ждущим ответом — и
 * потом увидел прошлую попытку. Эмулятор: очередь 1 → 1, удалён только
 * `rf-pages-downloads` (причина была в другом — `restoreAttemptWith`).
 * Здесь то же держится живой пробой.
 *
 * Только chromium: в WebKit Playwright каркас без сети не открывается
 * (тот же дефект стенда, что у соседних офлайн-проб, `testIgnore`).
 */

const LESSON = "/es/courses/a1/1";
const PASSWORD = "TestPass123!";

async function register(context: BrowserContext): Promise<void> {
  const email = `e2e-outbox-shell-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await context.request.post("/api/auth/register", {
    form: { email, password: PASSWORD, lang: "es", redirectTo: "/es" },
  });
  expect(new URL(res.url()).searchParams.get("error"), "регистрация отказала").toBeNull();
}

async function ledger(context: BrowserContext): Promise<{ attempt: { score: number } | null; receipts: number }> {
  const res = await context.request.get("/api/test/progress-ledger?level=a1&lesson=1");
  expect(res.status()).toBe(200);
  return res.json();
}

const outboxCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("rf-progress-outbox");
        // Не создавать базу: пустая база без хранилища сломала бы приложение (7.237).
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("outbox")) return resolve(0);
          const req = db.transaction("outbox").objectStore("outbox").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(-1);
        };
        open.onerror = () => resolve(0);
      }),
  );

async function checkAnswers(page: Page) {
  await page.getByRole("button", { name: "Comprobar" }).click();
  const close = page.getByRole("button", { name: "Continuar" });
  await close.click({ timeout: 3000 }).catch(() => {});
  await expect(close).toHaveCount(0, { timeout: 5000 });
}

async function screenPercent(page: Page): Promise<number | null> {
  const text = await page.locator('[data-offline-panel="exercises"]').innerText();
  const m = /\d+\s*\/\s*\d+\s*\((\d+)\s*%\)/.exec(text);
  return m ? Number(m[1]) : null;
}

test("«Borrar todo» в каркасе без сети стирает скачанное, но не очередь ответов (7.237)", async ({ page, context }) => {
  // Сумма собственных ожиданий 278 с (сторож `check:e2e-live-probes`).
  test.setTimeout(330_000);
  // Клипы урока — из памяти прогона, а не из живого интернета (долг 297).
  await serveClipLocally(context);
  await register(context);
  await page.goto(LESSON);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const download = page.locator("[data-rf-download-button]").first();
  await download.click();
  await expect(download).toContainText(/Descargar \d/, { timeout: 60_000 });
  await download.click();
  await expect(download).toContainText("Descargado", { timeout: 120_000 });

  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await fillAllExercises(page);
  await context.setOffline(true);
  await checkAnswers(page);
  const offlineScore = await screenPercent(page);
  await expect(page.locator("[data-rf-outbox-note]")).toBeVisible();
  expect(await outboxCount(page)).toBe(1);

  // Каркас приложения без сети (как у оболочки: документ — `offline.html`).
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  });
  const shellHtml = readFileSync("public/offline.html", "utf8");
  await context.route("**/*", (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: shellHtml })
      : route.continue(),
  );
  const arrival = await reachShell(page, "/es");
  expect(arrival.arrived, `каркас не открылся — страница на ${arrival.where}`).toBe(true);
  await expect(page.locator("[data-downloads]"), "блок «Descargado» не показан — стирать нечего").toBeVisible({ timeout: 25_000 });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.locator("[data-downloads-remove-all]").click();
  // ПОЗИТИВНЫЙ КОНТРОЛЬ: «Borrar todo» и правда стёр скачанное.
  await expect(page.locator("[data-downloads]")).toBeHidden({ timeout: 15_000 });
  expect(await page.evaluate(async () => (await caches.keys()).includes("rf-pages-downloads"))).toBe(false);
  expect(await outboxCount(page), "«Borrar todo» стёр очередь ответов").toBe(1);

  await context.unroute("**/*");
  await context.setOffline(false);
  await page.goto("/es");
  await expect.poll(() => outboxCount(page), { timeout: 20_000 }).toBe(0);
  const after = await ledger(context);
  expect(after.receipts).toBe(1);
  expect(after.attempt?.score).toBe(offlineScore);
});
