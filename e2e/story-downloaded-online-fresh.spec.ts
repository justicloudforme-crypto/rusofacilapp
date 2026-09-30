import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * СКАЧАННЫЙ РАССКАЗ С СЕТЬЮ ИСПОЛНЯЕТ СВЕЖИЙ КОД — ЗАХОД 7.254.
 *
 * Гипотеза после видео POCO 01.10.2026: «скачанная или сохранённая копия
 * держит код до #455, поэтому починка не доехала». Замер её опроверг:
 * журнал POCO — 8 касаний полоски (x 214–332, y 594–612 CSS px, сама
 * полоска x 189–366, y 594–618) и ни одной перемотки, то есть работал код
 * #455; эмулятор (WebView 153) — копии «Репки» во всех семи кешах, включая
 * `rf-pages-downloads` и RSC, помечены, с сетью открыта живая страница
 * без метки 2 из 2 (сборка — текущая сборка прода), без сети — копия с
 * меткой.
 *
 * Проба держит это правило: документы и данные переходов (RSC) — сначала
 * сеть, копия — только когда сети нет. Копия рассказа после скачивания
 * помечается как «старая сборка» во всех кешах документов; с сетью
 * страница, открытая и адресом, и переходом по ссылке, обязана прийти без
 * метки.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ТЕСТЕ: без сети тот же адрес обязан отдать
 * помеченную копию — иначе «метки нет» читалось бы и тогда, когда метка до
 * копии просто не дошла. Если документы воркера когда-нибудь станут
 * «сначала кеш», первая половина покраснеет.
 */
const MARK = "rf-stale-build-7254";
const button = "[data-rf-download-button]";

async function openStoryWithClips(page: Page): Promise<string> {
  await page.goto("/es/stories");
  const hrefs = (
    await page
      .locator('a[href^="/es/stories/"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")).filter((href): href is string => Boolean(href)))
  ).filter((href, index, all) => all.indexOf(href) === index);
  for (const href of hrefs.slice(0, 6)) {
    await page.goto(href);
    await page.waitForTimeout(1500);
    if ((await page.locator("[data-rf-clip]").count()) > 0 && (await page.locator(button).count()) > 0) return href;
  }
  throw new Error("ни у одного рассказа нет клипов и кнопки скачивания — скачивать нечего");
}

/** Помечает все копии документа и RSC этого адреса. Возвращает имена кешей. */
async function markCopies(page: Page, path: string): Promise<string[]> {
  return page.evaluate(
    async ({ path, mark }) => {
      const touched: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname !== path) continue;
          const response = await cache.match(request, { ignoreVary: true });
          if (!response) continue;
          const type = response.headers.get("content-type") ?? "";
          if (!type.includes("text/html") && !type.includes("text/x-component")) continue;
          // Метка — в ТЕЛЕ копии, и судим по телу ответа, а не по странице:
          // гидратация React снимает с документа и лишний узел, и лишний
          // атрибут (два первых прогона 30.09.2026 — контроль без сети
          // метки на странице не увидел, хотя в теле ответа она была).
          const marked = `${await response.text()}\n<!-- ${mark} -->`;
          await cache.put(request, new Response(marked, { status: response.status, headers: response.headers }));
          touched.push(name);
        }
      }
      return touched;
    },
    { path, mark: MARK },
  );
}

test("скачанный рассказ с сетью приходит свежим, копия — только без сети", async ({ page, context }) => {
  // Бюджет больше суммы собственных ожиданий (`check:e2e-live-probes`).
  test.setTimeout(300_000);
  await serveClipLocally(context);
  await page.goto("/es");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const path = await openStoryWithClips(page);
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText(/Descargar \d/, { timeout: 60_000 });
  await page.locator(button).click();
  await expect(page.locator(button)).toContainText("Descargado", { timeout: 120_000 });

  const touched = await markCopies(page, path);
  expect(touched, "копии рассказа в кеше скачанного нет — стенд не воспроизводит скачанное").toContain("rf-pages-downloads");

  // С сетью — адресом.
  const online = await page.goto(path);
  await page.locator('[data-rf-player="play"]').first().waitFor({ timeout: 30_000 });
  expect((await online!.text()).includes(MARK), `с сетью пришла копия (${touched.join(", ")}), а не живая страница`).toBe(false);

  // С сетью — переходом по ссылке, как в приложении («Cuentos» → рассказ).
  // Переход идёт данными RSC (или документом) — смотрим тела всех ответов
  // этого адреса.
  await page.goto("/es/stories");
  const bodies: Promise<string>[] = [];
  const onResponse = (response: import("@playwright/test").Response) => {
    if (new URL(response.url()).pathname === path) bodies.push(response.text().catch(() => ""));
  };
  page.on("response", onResponse);
  await page.locator(`a[href="${path}"]`).first().click();
  await page.waitForURL(new RegExp(`${path}$`), { timeout: 30_000 });
  await page.locator('[data-rf-player="play"]').first().waitFor({ timeout: 30_000 });
  page.off("response", onResponse);
  const seen = await Promise.all(bodies);
  expect(seen.length, "переход по ссылке не запросил ни документа, ни данных рассказа — проба слепа").toBeGreaterThan(0);
  expect(seen.some((body) => body.includes(MARK)), `переход по ссылке с сетью взял копию (${seen.length} ответов)`).toBe(false);

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: без сети — помеченная копия.
  await markCopies(page, path);
  await context.setOffline(true);
  const offline = await page.goto(path).catch(() => null);
  await page.waitForTimeout(1500);
  const offlineBody = offline ? await offline.text() : "";
  expect(offlineBody.includes(MARK), "КОНТРОЛЬ НЕ ПОЙМАН: без сети пришла копия без метки — метка до копий не дошла, проба слепа").toBe(true);
  await context.setOffline(false);
});
