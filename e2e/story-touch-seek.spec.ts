import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * «▶ С МЕСТА, А ЧЕРЕЗ 4 С — С НУЛЯ» — ЗАХОД 7.253, ДОЛГ 362 (открыт снова).
 *
 * ЧТО ВИДЕЛ ВЛАДЕЛЕЦ (POCO, 1.0.13, 30.09.2026, после выката #453).
 * «Репка» с 64 %, «▶» — звук сразу, ≈4 с полоска стоит, потом прыгает почти
 * в ноль, рассказ дальше с начала. Второй заход — с места.
 *
 * ПРИЧИНА ИЗМЕРЕНА. Журнал телефона той минуты: касание экрана длиной
 * 950 мс с движением (рядом — нажатия громкости держащей рукой), и за 90 мс
 * страница отдала шторке позиции 35,4 → 27,4 → 24,0 → 17,1 → 7,6 → 2,6 → 0 с
 * — начала строк лесенкой назад. Это невидимый `<input type="range">`
 * поверх полоски плеера: `onChange` на каждом шаге движения пальца. Кеш
 * клипов, скачанная копия и версия WebView (133 и 153 с телефона) ни при
 * чём: на эмуляторе без касания — «с места» во всех восьми прогонах, а мазок
 * пальцем по полоске дал ту же лесенку и 42,28 → 0,13 с.
 *
 * ПРОБА: рассказ играет с середины, по полоске проводят ПАЛЬЦЕМ (сенсорные
 * события протокола DevTools — те же, что шлёт экран телефона) от бегунка к
 * левому краю. Требование — дорожка идёт дальше того места, где была.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ — второй тест: тот же путь МЫШЬЮ обязан перемотать в
 * начало. Без него «не перемотал» читалось бы и тогда, когда движение просто
 * не попало по ползунку. На коде до правки первый тест падает (дорожка
 * уходит в первые секунды).
 *
 * ТОЛЬКО CHROMIUM — сенсорный ввод идёт через протокол DevTools; из
 * `mobile-iphone` файл снят в `playwright.config.ts`.
 */

const STORY_TITLE = "День стирки";
/** Начало шестой строки «Дня стирки» — глубже первых секунд. */
const START_OFFSET = 26.208;

async function openPlaying(page: Page, context: BrowserContext): Promise<{ before: number; from: { x: number; y: number }; to: { x: number; y: number } }> {
  // Лишний заголовок стенда делает запрос к чужому источнику клипов
  // непростым — снимается по той же причине, что в `sw-audio-replay.spec.ts`.
  await context.setExtraHTTPHeaders({});
  await loginWithSubscription(page);
  // Как в приложении: страницей правит воркер (он и режет клип на куски —
  // без него подставной источник перематывать не даёт вовсе).
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto("/ru/stories");
  const link = page.locator('a[href^="/ru/stories/"]').filter({ hasText: STORY_TITLE }).first();
  const path = new URL((await link.getAttribute("href"))!, "http://localhost").pathname;
  await page.goto(path);
  await expectPageIsItself(page, path, `рассказ «${STORY_TITLE}»`);
  await page.locator('[data-rf-player="play"]').first().click();
  await page.waitForFunction(() => {
    const el = document.querySelector("audio");
    return !!el && !el.paused && el.readyState >= 3;
  }, null, { timeout: 15_000 });
  // Место — начало шестой строки. Ставится прямо элементу, а не через
  // сохранённое место: пробы идут параллельно под одной учётной записью, и
  // сервер переписывает место чтения этого рассказа (продолжение с места
  // держит `story-resume-cold-cache.spec.ts`).
  await page.evaluate((offset) => {
    document.querySelector("audio")!.currentTime = offset;
  }, START_OFFSET);
  await page
    .waitForFunction(
      (offset) => {
        const el = document.querySelector("audio");
        const range = document.querySelector<HTMLInputElement>('input[type="range"]');
        return !!el && !el.paused && el.readyState >= 3 && el.currentTime > offset + 1 && !!range && Number(range.value) >= 5;
      },
      START_OFFSET,
      { timeout: 15_000 },
    )
    .catch(async () => {
      const state = await page.evaluate(() => {
        const el = document.querySelector("audio");
        return el ? { t: el.currentTime, paused: el.paused, error: el.error?.code ?? null } : null;
      });
      throw new Error(`дорожка не заиграла с шестой строки: ${JSON.stringify(state)}`);
    });
  const geo = await page.evaluate(() => {
    const range = document.querySelector<HTMLInputElement>('input[type="range"]')!;
    const r = range.getBoundingClientRect();
    const share = Number(range.value) / Math.max(1, Number(range.max));
    return { x: r.x + r.width * share, y: r.y + r.height / 2, left: r.x + 2, t: document.querySelector("audio")!.currentTime };
  });
  expect(geo.t, "дорожка не встала на шестую строку — проба не отличит «с места» от «с нуля»").toBeGreaterThan(20);
  return { before: geo.t, from: { x: geo.x, y: geo.y }, to: { x: geo.left, y: geo.y + 8 } };
}

const currentTime = (page: Page) => page.evaluate(() => document.querySelector("audio")!.currentTime);

test("палец по полоске плеера не перематывает рассказ в начало", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const { before, from, to } = await openPlaying(page, context);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 8; i++) {
    const k = i / 8;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1000);

  const after = await currentTime(page);
  expect(after, `палец по полоске перемотал рассказ: было ${before.toFixed(2)} с, стало ${after.toFixed(2)} с`).toBeGreaterThan(before);
});

test("контроль: тот же путь мышью перематывает в начало", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const { before, from, to } = await openPlaying(page, context);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  const after = await currentTime(page);
  expect(after, `КОНТРОЛЬ НЕ ПОЙМАН: мышь провела по ползунку к началу, а дорожка осталась на ${after.toFixed(2)} с (было ${before.toFixed(2)})`).toBeLessThan(before - 15);
});
