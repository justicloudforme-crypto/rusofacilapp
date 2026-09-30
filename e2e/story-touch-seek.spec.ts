import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * ПЕРЕМОТКА ПАЛЬЦЕМ ПО ПОЛОСКЕ ПЛЕЕРА — ЗАХОДЫ 7.253 И 7.254.
 *
 * 7.253 (долг 362): невидимый `<input type="range">` поверх полоски
 * перематывал на КАЖДОМ шаге движения пальца — журнал POCO 30.09, 12:56:23:
 * касание x≈298, y≈609 CSS px прямо на полоске и за 90 мс лесенка позиций
 * по началам строк 8 → 0. 7.253 отключил палец совсем; владелец 30.09:
 * перемотка пальцем нужна.
 *
 * 7.254: тап — переход в точку; перетаскивание — бегунок за пальцем и ОДИН
 * переход при отпускании; прокрутка страницы, начатая на полоске, — не
 * перемотка. Пробы — настоящими сенсорными событиями протокола DevTools
 * (те же, что шлёт экран телефона), по геометрии полоски, а не по
 * разметке: одна и та же проба гоняется на коде до 7.253, на 7.253 и
 * после.
 *
 * Что ловит какая проба. «Прокрутка» — код до 7.253 (перематывал на
 * строку назад). «Перетаскивание» — код до 7.253 (переход посреди жеста)
 * и 7.253 (перехода нет вовсе). «Тап» — 7.253. Контроль мышью проходит на
 * всех трёх: без него «не перемотал» читалось бы и тогда, когда жест не
 * попал по полоске.
 *
 * ТОЛЬКО CHROMIUM — сенсорный ввод идёт через протокол DevTools; из
 * `mobile-iphone` файл снят в `playwright.config.ts`.
 */

const STORY_TITLE = "День стирки";
/** Начало шестой строки «Дня стирки» — глубже первых секунд. */
const START_OFFSET = 26.208;

async function openPlaying(page: Page, context: BrowserContext) {
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
    const bar = document.querySelector<HTMLElement>('[data-rf-player="bar"]')!;
    const track = bar.parentElement!.getBoundingClientRect();
    const fill = bar.getBoundingClientRect().width;
    const audio = document.querySelector("audio")!;
    return { left: track.x, width: track.width, y: track.y + track.height / 2, thumb: track.x + fill, t: audio.currentTime, duration: audio.duration };
  });
  expect(geo.t, "дорожка не встала на шестую строку — проба не отличит «с места» от «с нуля»").toBeGreaterThan(20);
  return geo;
}

const currentTime = (page: Page) => page.evaluate(() => document.querySelector("audio")!.currentTime);

const barWidth = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-rf-player="bar"]')!.getBoundingClientRect().width);

async function touch(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  return {
    start: (x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] }),
    move: (x: number, y: number) => cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] }),
    end: () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }),
  };
}

test("прокрутка страницы, начатая на полоске, не перематывает", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const geo = await openPlaying(page, context);
  const finger = await touch(context, page);
  const x = geo.left + geo.width * 0.3;
  await finger.start(x, geo.y);
  for (let i = 1; i <= 6; i++) await finger.move(x + i, geo.y - i * 12);
  await finger.end();
  await page.waitForTimeout(1000);
  const after = await currentTime(page);
  expect(after, `прокрутка с полоски перемотала рассказ: было ${geo.t.toFixed(2)} с, стало ${after.toFixed(2)} с`).toBeGreaterThan(geo.t);
});

test("перетаскивание пальцем: бегунок за пальцем, переход один — при отпускании", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const geo = await openPlaying(page, context);
  const finger = await touch(context, page);
  const to = geo.left + 2;
  await finger.start(geo.thumb, geo.y);
  for (let i = 1; i <= 8; i++) await finger.move(geo.thumb + ((to - geo.thumb) * i) / 8, geo.y + (i % 2));
  await page.waitForTimeout(300);
  const midTime = await currentTime(page);
  const midWidth = await barWidth(page);
  expect(midTime, `перемотка посреди жеста (палец ещё на полоске): было ${geo.t.toFixed(2)} с, стало ${midTime.toFixed(2)} с`).toBeGreaterThan(geo.t);
  expect(midWidth, "бегунок не едет за пальцем").toBeLessThan(10);
  await finger.end();
  await page.waitForTimeout(1000);
  const after = await currentTime(page);
  expect(after, `палец отпущен у начала полоски, а дорожка на ${after.toFixed(2)} с (было ${geo.t.toFixed(2)})`).toBeLessThan(5);
});

test("тап пальцем по полоске — переход в эту точку", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const geo = await openPlaying(page, context);
  const finger = await touch(context, page);
  const target = 0.8;
  await finger.start(geo.left + geo.width * target, geo.y);
  await finger.end();
  await page.waitForTimeout(1000);
  const after = await currentTime(page);
  // Переход — к началу строки, которая звучит в точке тапа: чуть левее.
  expect(after, `тап на ${target * 100} % полоски, а дорожка на ${after.toFixed(2)} из ${geo.duration.toFixed(2)} с`).toBeGreaterThan(geo.duration * 0.6);
  expect(after).toBeLessThan(geo.duration * target + 2);
});

test("контроль: тот же путь мышью перематывает в начало", async ({ page, context }) => {
  test.setTimeout(90_000);
  await serveClipLocally(context);
  const geo = await openPlaying(page, context);

  await page.mouse.move(geo.thumb, geo.y);
  await page.mouse.down();
  await page.mouse.move(geo.left + 2, geo.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  const after = await currentTime(page);
  expect(after, `КОНТРОЛЬ НЕ ПОЙМАН: мышь провела по полоске к началу, а дорожка осталась на ${after.toFixed(2)} с (было ${geo.t.toFixed(2)})`).toBeLessThan(geo.t - 15);
});
