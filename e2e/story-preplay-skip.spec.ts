import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * ⏪ / ⏩ / ПОЛОСКА ДО ПЕРВОГО «▶» — ЗАХОД 7.255.
 *
 * ЧТО ВИДЕЛ ВЛАДЕЛЕЦ (видео POCO 01.10, журнал телефона той минуты):
 * «Снегурочка» (сохранено 67 %) и «Репка» (71 %) — сразу после открытия
 * страницы, ДО первого «▶», одно нажатие ⏪ (05:28:19,00 и 05:29:20,85,
 * x≈65, y≈606 CSS px — кнопка «Retroceder 15 segundos»). Полоска за ~0,1 с
 * ушла в ноль, «▶» заиграл с первой фразы (шторка `PLAYING 0`).
 *
 * ПРИЧИНА (замер 7.255). До первого «▶» дорожка стоит на 0: сохранённое
 * место подставлялось ТОЛЬКО в «▶». ⏪ считал −15 с от нуля → 0, событие
 * `timeupdate` делало строку 0 текущей, снимало метку «продолжить отсюда»
 * и ПЕРЕЗАПИСЫВАЛО сохранённое место строкой 0 — «▶» потом места уже не
 * находил. ⏩ до «▶» по той же причине давал 15 с, а не место + 15.
 *
 * ПРОБА — ровно этот путь: место сохранено на шестой строке, страница
 * открыта заново, ⏪ (или ⏩), потом «▶»; через 3 с дорожка идёт от
 * «место ∓ 15 с», полоска до «▶» показывает новую точку, а сохранённое
 * место — строка этой точки. На коде до правки падают ⏪ и ⏩ (замер —
 * PROGRESS.md, 7.255).
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ — «▶ без касаний продолжает с места»: без него
 * «от места − 15» и «проба не знает места» читались бы одинаково.
 *
 * ТОЛЬКО CHROMIUM — как `story-touch-seek.spec.ts`: сенсорный ввод через
 * протокол DevTools, перемотку подставного клипа режет воркер.
 */

const STORY_TITLE = "День стирки";
/** Шестая строка «Дня стирки» — 26,208 с: и −15, и +15 с внутри дорожки. */
const SAVED_INDEX = 5;
const SKIP = 15;

interface ClipState {
  currentTime: number;
  duration: number;
  paused: boolean;
  errorCode: number | null;
  bar: number;
}

async function clipState(page: Page): Promise<ClipState> {
  return page.evaluate(() => {
    const el = document.querySelector("audio");
    const bar = document.querySelector<HTMLElement>('[data-rf-player="bar"]');
    return {
      currentTime: el ? el.currentTime : -1,
      duration: el && Number.isFinite(el.duration) ? el.duration : 0,
      paused: el ? el.paused : true,
      errorCode: el && el.error ? el.error.code : null,
      bar: bar ? parseFloat(bar.style.width) / 100 : -1,
    };
  });
}

async function savedIndex(page: Page, storyId: string): Promise<number | null> {
  return page.evaluate((id) => {
    const all = JSON.parse(localStorage.getItem("rusofacil:story-progress") || "{}");
    return all[id]?.queueIndex ?? null;
  }, storyId);
}

async function saveReadingPlace(page: Page, storyId: string, queueIndex: number): Promise<void> {
  await page.evaluate(
    ([id, index]) => {
      const key = "rusofacil:story-progress";
      const all = JSON.parse(localStorage.getItem(key) || "{}");
      all[id] = { currentPage: index + 1, queueIndex: index, totalPages: 40, percent: 1, isCompleted: false, updatedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(all));
    },
    [storyId, queueIndex] as const,
  );
}

/** Начала строк — со страницы: локально и в CI строки базы разные. */
async function offsetsOf(page: Page): Promise<number[]> {
  const offsets = await page.evaluate(async (path) => {
    const html = await (await fetch(path)).text();
    const match = /sentenceOffsets\\?":\[([0-9.,]+)\]/.exec(html);
    return match ? match[1].split(",").map(Number) : null;
  }, page.url());
  expect(offsets, "на странице рассказа нет смещений предложений — проба не знает, где «сохранённое место»").not.toBeNull();
  return offsets!;
}

const indexAt = (offsets: number[], t: number) => {
  for (let i = offsets.length - 1; i >= 0; i--) if (offsets[i] <= t) return i;
  return 0;
};

/** Вход, воркер, место на шестой строке, страница открыта заново — «▶» ещё не нажат. */
async function openWithSavedPlace(page: Page, context: BrowserContext) {
  await context.setExtraHTTPHeaders({});
  await serveClipLocally(context);
  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto("/ru/stories");
  const link = page.locator('a[href^="/ru/stories/"]').filter({ hasText: STORY_TITLE }).first();
  const path = new URL((await link.getAttribute("href"))!, "http://localhost").pathname;
  const storyId = path.split("/").pop()!;
  await page.goto(path);
  const offsets = await offsetsOf(page);
  const place = offsets[SAVED_INDEX];
  expect(place, "сохранённое место должно быть глубже 15 с — иначе «место − 15» и «ноль» не различить").toBeGreaterThan(SKIP + 5);

  await page.goto("/ru");
  await saveReadingPlace(page, storyId, SAVED_INDEX);
  await page.goto(path);
  await expectPageIsItself(page, path, `рассказ «${STORY_TITLE}»`);
  // Как у человека: страница открылась, метаданные дорожки успели прийти.
  await page.waitForFunction(() => {
    const el = document.querySelector("audio");
    return !!el && Number.isFinite(el.duration) && el.duration > 0;
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(500);
  const before = await clipState(page);
  expect(before.paused, "дорожка играет до «▶»").toBe(true);
  expect(before.bar, `полоска до «▶» не на сохранённом месте (${place.toFixed(1)} с)`).toBeCloseTo(place / before.duration, 1);
  return { storyId, offsets, place, before };
}

async function playAndWait(page: Page): Promise<ClipState> {
  await page.locator('[data-rf-player="play"]').first().click();
  await page.waitForTimeout(3000);
  return clipState(page);
}

/** Через 3 с после «▶» дорожка идёт ОТ `from` (с запасом на старт звука). */
function playsFrom(after: ClipState, from: number): boolean {
  return after.errorCode === null && !after.paused && after.currentTime > from + 0.5 && after.currentTime < from + 6;
}

for (const [label, selector, delta] of [
  ["⏪", '[data-rf-player="back"]', -SKIP],
  ["⏩", '[data-rf-player="forward"]', SKIP],
] as const) {
  test(`${label} до первого «▶»: сохранённое место ${delta > 0 ? "+" : "−"}15 с, «▶» идёт оттуда, место обновлено`, async ({ page, context }) => {
    test.setTimeout(120_000);
    const { storyId, offsets, place, before } = await openWithSavedPlace(page, context);
    const target = Math.min(Math.max(0, place + delta), before.duration);

    await page.locator(selector).first().click();
    await page.waitForTimeout(700);
    const skipped = await clipState(page);
    expect(
      Math.abs(skipped.currentTime - target),
      `${label} до «▶»: дорожка на ${skipped.currentTime.toFixed(2)} с, ждали место ${place.toFixed(2)} ${delta > 0 ? "+" : "−"} 15 = ${target.toFixed(2)} с`,
    ).toBeLessThan(0.5);
    expect(skipped.bar, `${label} до «▶»: полоска ${(skipped.bar * 100).toFixed(1)} %, ждали ${((target / before.duration) * 100).toFixed(1)} %`).toBeCloseTo(target / before.duration, 1);
    expect(await savedIndex(page, storyId), `${label} до «▶»: сохранённое место не перенесено на строку новой точки`).toBe(indexAt(offsets, target));

    const after = await playAndWait(page);
    expect(playsFrom(after, target), `${label} до «▶», потом «▶»: ждали ход от ${target.toFixed(2)} с, а ${JSON.stringify(after)}`).toBe(true);
  });
}

test("тап пальцем по полоске до первого «▶» — звук идёт из точки тапа", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { storyId, offsets, before } = await openWithSavedPlace(page, context);
  const geo = await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('[data-rf-player="bar"]')!.parentElement!.getBoundingClientRect();
    return { left: track.x, width: track.width, y: track.y + track.height / 2 };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const fraction = 0.8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: geo.left + geo.width * fraction, y: geo.y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
  const after = await clipState(page);
  // Переход — к началу строки, звучащей в точке тапа (правило 7.254).
  const index = indexAt(offsets, before.duration * fraction);
  expect(playsFrom(after, offsets[index] - 0.5), `тап на 80 % до «▶»: ждали ход от ${offsets[index].toFixed(2)} с, а ${JSON.stringify(after)}`).toBe(true);
  expect(await savedIndex(page, storyId), "тап до «▶»: сохранённое место не перенесено").toBe(index);
});

test("контроль: «▶» без касаний продолжает с сохранённого места", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { place } = await openWithSavedPlace(page, context);
  const after = await playAndWait(page);
  expect(playsFrom(after, place), `КОНТРОЛЬ: «▶» без касаний не продолжил с места ${place.toFixed(2)} с — ${JSON.stringify(after)}`).toBe(true);
});
