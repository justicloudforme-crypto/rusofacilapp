import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * «▶ НАЧИНАЕТ С НУЛЯ ПРИ ПЕРВОМ ЗАХОДЕ» — ЗАХОД 7.252, ДОЛГ 362.
 *
 * ЧТО ВИДЕЛ ВЛАДЕЛЕЦ (POCO, 1.0.13, 30.09.2026, с сетью). Закрыл
 * приложение из «Недавних» → «Cuentos» → «Репка»: полоска на 36 %, «▶» —
 * полоска прыгает в ноль и звучит первая фраза. Второй и третий заход в
 * той же сессии — продолжают с места.
 *
 * ПРИЧИНА ИЗМЕРЕНА, А НЕ ПРОЧИТАНА (замер 7.252, живой сайт, Chromium 151
 * и эмулятор с WebView 133). Решает одно условие: лежит ли полная дорожка
 * в кеше клипов `rf-audio`, когда страница рассказа открывается.
 *
 *   * лежит — воркер режет из неё кусок и отвечает 206; «▶» с 35,7 %
 *     даёт `currentTime` 19,99 с через 3 с — с места;
 *   * НЕ лежит — `CacheFirst` идёт в сеть за целым файлом и отдаёт его
 *     элементу `<audio>` ответом **200** на запрос `Range: bytes=0-`;
 *     следующий кусок (`bytes=262144-`) приходит уже из кеша ответом 206,
 *     и проигрыватель, получивший про один файл «куски не умею» и «вот
 *     кусок», ломается: `MEDIA_ERR_NETWORK` (код 2, `PIPELINE_ERROR_READ:
 *     FFmpegDemuxer: data source error`), `currentTime` 17,06, пауза.
 *     Chromium и WebView эмулятора молчат; WebView телефона, по видео,
 *     перезапускает дорожку с нуля. Второй заход уже застаёт дорожку в
 *     кеше — отсюда «только первый раз».
 *
 * ПРОБА ПОВТОРЯЕТ ИМЕННО ЭТО УСЛОВИЕ: кеш клипов пуст, место сохранено на
 * шестой строке, страница открывается заново (для страницы это и есть
 * холодный старт), «▶». Требование — через 3 с дорожка идёт ДАЛЬШЕ
 * сохранённого места, без ошибки. Потом второй заход — тоже с места
 * (этого ломать нельзя).
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ — ВТОРОЙ ТЕСТ ЭТОГО ФАЙЛА. Он подменяет воркер
 * сайта прежним обработчиком клипов (на промахе кеша — 200 целиком) и
 * требует, чтобы та же проверка УВИДЕЛА поломку. Смесь «200, потом 206»
 * прямо из сети, без воркера, поломки НЕ даёт (замер 7.252: продолжает с
 * места) — поэтому контроль идёт через воркер, а не через источник. Без него «продолжает с места» и
 * «проба смотрит не туда» читались бы одинаково. На коде до правки
 * первый тест падает — замер записан в PROGRESS.md, заход 7.252.
 *
 * ТОЛЬКО CHROMIUM — как у `sw-audio-replay.spec.ts`: WebKit под
 * Playwright отдаёт воркеру не всё (ограничение в `playwright.config.ts`).
 */

/** Тот же рассказ, что у `sw-audio-replay.spec.ts`: в CI — строка
 *  фикстуры с настоящими смещениями предложений, локально — боевая копия. */
const STORY_TITLE = "День стирки";
/** Шестая строка: у «Дня стирки» она начинается на 26,208 с — глубже,
 *  чем начало любого первого куска, который браузер берёт на старте. */
const SAVED_INDEX = 5;

interface ClipState {
  currentTime: number;
  paused: boolean;
  errorCode: number | null;
  bar: string;
}

async function clipState(page: Page): Promise<ClipState> {
  return page.evaluate(() => {
    const el = document.querySelector("audio");
    const bar = document.querySelector<HTMLElement>('[data-rf-player="bar"]');
    return {
      currentTime: el ? el.currentTime : -1,
      paused: el ? el.paused : true,
      errorCode: el && el.error ? el.error.code : null,
      bar: bar ? bar.style.width : "",
    };
  });
}

async function findStoryPath(page: Page): Promise<string> {
  await page.goto("/ru/stories");
  const links = page.locator('a[href^="/ru/stories/"]').filter({ hasText: STORY_TITLE });
  expect(await links.count(), `в каталоге нет ни одной ссылки на «${STORY_TITLE}»`).toBeGreaterThan(0);
  return new URL((await links.first().getAttribute("href"))!, "http://localhost").pathname;
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

/** Смещение сохранённой строки — со страницы, а не константой: локально и
 *  в CI у рассказа разные строки базы, а смещения — одни. */
async function offsetOf(page: Page, index: number): Promise<number> {
  const offsets = await page.evaluate(async (path) => {
    const html = await (await fetch(path)).text();
    const match = /sentenceOffsets\\?":\[([0-9.,]+)\]/.exec(html);
    return match ? match[1].split(",").map(Number) : null;
  }, page.url());
  expect(offsets, "на странице рассказа не нашлось смещений предложений — проба не знает, где «сохранённое место»").not.toBeNull();
  return offsets![index];
}

/** Открыть рассказ заново и нажать «▶», как человек после холодного старта. */
async function openAndPlay(page: Page, storyPath: string): Promise<{ before: ClipState; after: ClipState }> {
  await page.goto(storyPath);
  await expectPageIsItself(page, storyPath, `рассказ «${STORY_TITLE}»`);
  await page.waitForTimeout(1500);
  const before = await clipState(page);
  await page.locator('[data-rf-player="play"]').first().click();
  await page.waitForTimeout(3000);
  return { before, after: await clipState(page) };
}

/** Проверка, общая для пробы и контроля: дорожка пошла ДАЛЬШЕ места. */
function resumedFromPlace(after: ClipState, offset: number): boolean {
  return after.errorCode === null && !after.paused && after.currentTime > offset + 1 && after.currentTime < offset + 8;
}

async function prepare(page: Page, context: BrowserContext) {
  // Заголовок стенда снимается по той же измеренной причине, что в
  // `sw-audio-replay.spec.ts`: лишний заголовок делает запрос к чужому
  // источнику непростым, и меряется стенд, а не воркер.
  await context.setExtraHTTPHeaders({});
  await loginWithSubscription(page);
  const storyPath = await findStoryPath(page);
  return { storyPath, storyId: storyPath.split("/").pop()! };
}

test("первый заход с пустым кешем клипов: «▶» продолжает с сохранённого места, второй заход — тоже", async ({ page, context }) => {
  // Бюджет: вход, ожидание воркера до 30 с, два захода по ~6 с, навигации.
  test.setTimeout(30_000 + 30_000 + 2 * 6_000 + 20_000);
  const clipOrigin = await serveClipLocally(context);
  const { storyPath, storyId } = await prepare(page, context);

  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  await page.goto(storyPath);
  const offset = await offsetOf(page, SAVED_INDEX);
  expect(offset, "смещение сохранённой строки должно быть глубже первых секунд — иначе «с нуля» и «с места» не различить").toBeGreaterThan(10);

  // Условие дефекта: дорожки в кеше клипов НЕТ, место сохранено.
  await page.goto("/ru");
  await page.evaluate(() => caches.delete("rf-audio"));
  await saveReadingPlace(page, storyId, SAVED_INDEX);

  const first = await openAndPlay(page, storyPath);
  expect(clipOrigin.hits.length, "за клипом не сходили ни разу — подмена источника не попала по адресу").toBeGreaterThan(0);
  expect(first.before.bar, "полоска до «▶» не показывает сохранённое место").not.toBe("0%");
  expect(
    resumedFromPlace(first.after, offset),
    `ПЕРВЫЙ ЗАХОД: «▶» не продолжил с места ${offset.toFixed(1)} с — ${JSON.stringify(first.after)}`,
  ).toBe(true);

  // Второй заход — дорожка уже в кеше; продолжение с места не сломано.
  await page.locator('[data-rf-player="play"]').first().click();
  await page.goto("/ru");
  await saveReadingPlace(page, storyId, SAVED_INDEX);
  const second = await openAndPlay(page, storyPath);
  expect(
    resumedFromPlace(second.after, offset),
    `ВТОРОЙ ЗАХОД: «▶» не продолжил с места ${offset.toFixed(1)} с — ${JSON.stringify(second.after)}`,
  ).toBe(true);
});

/**
 * Прежний обработчик клипов воркера, переписанный без библиотеки: кеш
 * первым, на промахе — целый файл с CORS и ответ **200** на запрос с
 * `Range`, на попадании — кусок 206. Это ровно то, что делал
 * `audioStrategy` до 7.252 (`CacheFirst` + `WHOLE_CLIP_WITH_CORS` +
 * `RangeRequestsPlugin`, который режет только ответ из кеша).
 */
const OLD_AUDIO_WORKER = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (!new URL(event.request.url).pathname.endsWith(".mp3")) return;
  event.respondWith((async () => {
    const cache = await caches.open("rf-audio");
    const hit = await cache.match(event.request.url);
    const range = event.request.headers.get("range");
    if (hit && range) {
      const blob = await hit.blob();
      const m = /bytes=(\\d*)-(\\d*)/.exec(range);
      const start = Number(m[1] || 0);
      const end = m[2] ? Number(m[2]) + 1 : blob.size;
      const part = blob.slice(start, end);
      return new Response(part, { status: 206, headers: { "Content-Type": "audio/mpeg", "Content-Length": String(part.size), "Content-Range": "bytes " + start + "-" + (end - 1) + "/" + blob.size } });
    }
    if (hit) return hit;
    const response = await fetch(new Request(event.request.url, { mode: "cors", credentials: "omit" }));
    event.waitUntil(cache.put(event.request.url, response.clone()));
    return response;
  })());
});
`;

test("контроль: прежний обработчик клипов (200 целиком на промахе кеша) проверкой ловится", async ({ page, context }) => {
  test.setTimeout(30_000 + 30_000 + 6_000 + 20_000);
  await serveClipLocally(context);
  // Воркер сайта подменяется прежним обработчиком — всё остальное
  // (страница, плеер, источник клипа, пустой кеш, место) то же, что в пробе.
  await context.route("**/sw.js", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "application/javascript", "cache-control": "no-store" }, body: OLD_AUDIO_WORKER }),
  );
  const { storyPath, storyId } = await prepare(page, context);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const scriptUrl = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? "");
  expect(scriptUrl, "страницей управляет не подставной воркер").toContain("/sw.js");

  await page.goto(storyPath);
  const offset = await offsetOf(page, SAVED_INDEX);
  await page.goto("/ru");
  await page.evaluate(() => caches.delete("rf-audio"));
  await saveReadingPlace(page, storyId, SAVED_INDEX);
  const control = await openAndPlay(page, storyPath);
  expect(
    resumedFromPlace(control.after, offset),
    `КОНТРОЛЬ НЕ ПОЙМАН: страницей правит прежний обработчик клипов, а проверка считает, что «▶» продолжил с места — ${JSON.stringify(control.after)}`,
  ).toBe(false);
});
