import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { reachShell } from "./helpers/offline-shell";
import { loginWithoutSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * СКАЧАЛ → ВЫКАТ → БЕЗ СЕТИ — ЗАХОД 7.235.
 *
 * ====================================================================
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ И ЧТО ПОКАЗАЛ ЭМУЛЯТОР
 * ====================================================================
 *
 * Видео 26.09.2026 (POCO, вошедший, бесплатный): в кабинете «Descargado»
 * две строки, без сети каркас — «Aún no hay nada guardado», «Guardado: 0».
 * Эмулятор 7.235 повторил это знак в знак: скачано кодом ДО мержа #412
 * (опись без листов стилей), выкат, заход с сетью, убить, без сети —
 * «кешей 2 · описей 2 · строк 2 · показано 0». Лист стилей такой копии
 * жил только в чужом кеше с отпечатком сборки, и выкат его унёс.
 *
 * Здесь та же цепочка в Chromium: скачивание настоящей кнопкой, копия
 * приводится к виду «до #412» (описи без листов, листов в кеше
 * скачанного нет — ровно то, что прочитано на эмуляторе), выкат — все
 * листы стилей уходят из прочих кешей.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ТЕСТЕ: до захода с сетью каркас обязан
 * показать экран владельца — иначе стенд не воспроизводит дефект и
 * зелёный итог ничего бы не значил. На коде без `DownloadsHeal` вторая
 * половина краснеет: заход с сетью ничего не лечит.
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

async function backOnline(context: BrowserContext): Promise<void> {
  await context.unroute("**/*").catch(() => {});
  await context.setOffline(false);
}

async function openStoryWithClips(page: Page): Promise<void> {
  await page.locator('a[href="/es/stories"]').first().click();
  await page.waitForURL(/\/es\/stories$/, { timeout: 30_000 });
  const hrefs = (
    await page
      .locator('a[href^="/es/stories/"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")).filter((href): href is string => Boolean(href)))
  ).filter((href, index, all) => all.indexOf(href) === index);
  expect(hrefs.length, "в каталоге рассказов нет ни одной ссылки").toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 6)) {
    await page.goto("/es/stories", { timeout: 30_000 }).catch(() => {});
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await page.waitForTimeout(1500);
    if ((await page.locator("[data-rf-clip]").count()) > 0) return;
  }
  throw new Error("ни у одного рассказа нет клипов — скачивать звук нечем");
}

async function shellRows(page: Page): Promise<{ rows: string; gauge: string }> {
  return page.evaluate(() => ({
    rows: [...document.querySelectorAll("[data-saved-list] li button")]
      .map((node) => (node as HTMLElement).innerText.replace(/\s+/g, " ").trim())
      .join(" | "),
    gauge: document.querySelector("[data-saved-gauge]")?.textContent ?? "",
  }));
}

for (const who of ["гость", "вошедший"] as const) {
  test(`${who}: скачанное до #412 переживает выкат и видно в каркасе без сети`, async ({ page, context }) => {
    // Бюджет больше суммы собственных ожиданий (`check:e2e-live-probes`).
    test.setTimeout(480_000);
    await serveClipLocally(context);
    if (who === "вошедший") await loginWithoutSubscription(page);

    await page.goto("/es");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
    await openStoryWithClips(page);
    await page.locator(button).click();
    await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
    await page.locator(button).click();
    await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });

    // ЛЕЧЕНИЕ ЭТОЙ ЗАГРУЗКИ ОБЯЗАНО ОТРАБОТАТЬ ДО ПОДГОТОВКИ СТЕНДА. Оно
    // идёт раз на загрузку, через 2 с; полный прогон 26.09.2026 поймал
    // гонку: скачивание кончилось раньше, лечение пришло ПОСЛЕ того, как
    // копия стала «до #412», и контроль ниже не увидел экрана владельца.
    await page.reload();
    await page.waitForTimeout(3_000);

    // КОПИЯ «ДО #412»: опись без листов, листов в кеше скачанного нет.
    const legacy = await page.evaluate(async () => {
      const cache = await caches.open("rf-pages-downloads");
      let dropped = 0;
      for (const request of await cache.keys()) {
        if (/\/_next\/static\/css\//.test(request.url) && (await cache.delete(request))) dropped += 1;
      }
      const indexUrl = new URL("/__rf-downloads-index", location.href).toString();
      const hit = await cache.match(indexUrl, { ignoreVary: true });
      const rows = hit ? ((await hit.json()) as Record<string, unknown>[]) : [];
      for (const row of rows) delete row.sheets;
      await cache.put(indexUrl, new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } }));
      return { dropped, rows: rows.length };
    });
    expect(legacy.rows, "опись пуста — скачивания не было").toBe(1);
    expect(legacy.dropped, "листов рядом со скачанным не было — «до #412» изображать нечем").toBeGreaterThan(0);

    // ВЫКАТ: кеши с отпечатком сборки и все листы стилей вне скачанного уходят.
    const wiped = await page.evaluate(async () => {
      let removed = 0;
      for (const name of await caches.keys()) {
        if (name === "rf-pages-downloads") continue;
        if (/^rf-pages-/.test(name)) {
          await caches.delete(name);
          continue;
        }
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (/\/_next\/static\/css\//.test(request.url) && (await cache.delete(request))) removed += 1;
        }
      }
      return removed;
    });
    expect(wiped, "листов стилей вне кеша скачанного не было — выкат изобразить было нечем").toBeGreaterThan(0);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ: без захода с сетью — экран владельца.
    await becomeNativeShell(page, context);
    const control = await reachShell(page, "/es");
    expect(control.arrived, `каркас не открылся по /es — страница осталась на ${control.where}`).toBe(true);
    await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
    const owner = await shellRows(page);
    expect(owner.rows, "стенд не воспроизводит экран владельца — дефект не изображён").not.toMatch(/Descargado/);
    expect(owner.gauge).toMatch(/Guardado: 0/);

    // ЗАХОД С СЕТЬЮ ПОСЛЕ ВЫКАТА — лечение обязано доложить листы.
    await backOnline(context);
    await page.goto("/es", { timeout: 30_000 });
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const cache = await caches.open("rf-pages-downloads");
            return (await cache.keys()).filter((request) => /\/_next\/static\/css\//.test(request.url)).length;
          }),
        { timeout: 30_000, message: "заход с сетью не доложил листы стилей скачанному — выкат по-прежнему прячет его" },
      )
      .toBeGreaterThan(0);

    await becomeNativeShell(page, context);
    const healed = await reachShell(page, "/es");
    expect(healed.arrived, `каркас не открылся по /es — страница осталась на ${healed.where}`).toBe(true);
    await page.waitForSelector("[data-saved]:not([hidden])", { timeout: 25_000 });
    const after = await shellRows(page);
    expect(after.rows, "скачанное не видно в каркасе после выката").toMatch(/Descargado/);
    expect(after.gauge).not.toMatch(/Guardado: 0/);

    await backOnline(context);
  });
}
