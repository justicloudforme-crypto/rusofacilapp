import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";
import { expectPageIsItself } from "./helpers/page-identity";
import {
  MEDIA_SESSION_PLUGIN,
  SITE_NATIVE_PLUGINS,
  fireNativeCallback,
  installNativeBridge,
  nativeCalls,
  nativePlatformOf,
} from "./helpers/native-bridge";

/**
 * КАРТОЧКА ПРОИГРЫВАТЕЛЯ В ШТОРКЕ ПОД НАСТОЯЩИМ МОСТОМ — ШЕСТОЙ УЗЕЛ ДОЛГА 303 (заход 7.299).
 *
 * `src/lib/native-media-session.ts` зовёт `@capgo/capacitor-media-session`
 * только при `Capacitor.isNativePlatform()`; до этого файла ни один прибор
 * не исполнял ни одной его строки в странице — jsdom-тест
 * (`StoryText.media-session.test.tsx`) подменяет сам модуль, а сторож
 * `check:native-media-session` смотрит на структуру исходника.
 *
 * Здесь страница рассказа открыта под НАСТОЯЩИМ `native-bridge.js`
 * (помощник `e2e/helpers/native-bridge.ts`) и с настоящей записью (байты —
 * из `serveClipLocally`, адрес — чужого источника, как на проде). Проба
 * судит всю дорогу «страница ↔ шторка»:
 *  1. страница видит Android;
 *  2. кнопки шторки зарегистрированы (6 действий + перемотка по шкале);
 *  3. название рассказа и обложка-картинка ушли в карточку;
 *  4. «▶» на странице → карточка «playing»;
 *  5. «пауза» и «play», нажатые В ШТОРКЕ (ответ Java по `callbackId`
 *     `setActionHandler`), ставят и снимают паузу у `<audio>` страницы, а
 *     карточка следует за ним;
 *  6. уход со страницы внутри приложения убирает карточку целиком
 *     (шкала в ноль, затем «none» — правка 7.240/7.248).
 *
 * Контроль слепоты — последняя проба: та же страница без моста не видит
 * Android и не делает ни одного вызова.
 *
 * Оба проекта (`chromium` и `mobile-iphone`): в отличие от `story-*`, здесь
 * нет перемотки по клипу и сенсорного ввода DevTools — замер 7.299, WebKit
 * 5 из 5 до записи в CI.
 */

const STORY_TITLE = "День стирки";

async function openStory(page: Page): Promise<string> {
  await loginWithSubscription(page);
  await page.goto("/ru/stories");
  const link = page.locator('a[href^="/ru/stories/"]').filter({ hasText: STORY_TITLE }).first();
  const path = new URL((await link.getAttribute("href"))!, "http://localhost").pathname;
  await page.goto(path);
  await expectPageIsItself(page, path, `рассказ «${STORY_TITLE}»`);
  return path;
}

const audioPaused = (page: Page) => page.evaluate(() => document.querySelector("audio")?.paused ?? null);

async function lastPlaybackState(page: Page): Promise<unknown> {
  const calls = await nativeCalls(page, "MediaSession", "setPlaybackState");
  return calls.at(-1)?.options.playbackState ?? null;
}

test("native-media-session: кнопки, название, «играет», пауза и play из шторки, уборка при уходе", async ({
  page,
  context,
}) => {
  await context.setExtraHTTPHeaders({});
  const origin = await serveClipLocally(context);
  await context.addCookies([{ name: "rf_native_shell", value: "1", domain: "localhost", path: "/" }]);
  await installNativeBridge(context, { plugins: [...SITE_NATIVE_PLUGINS, MEDIA_SESSION_PLUGIN] });
  await openStory(page);
  expect(await nativePlatformOf(page), "мост подложен: страница видит Android").toEqual({ platform: "android", native: true });
  await page.waitForSelector("html:not([data-hydrating])");

  // 2. Кнопки шторки.
  const actions = async () =>
    [...new Set((await nativeCalls(page, "MediaSession", "setActionHandler")).map((c) => String(c.options.action)))].sort();
  await expect
    .poll(actions, "кнопки карточки зарегистрированы")
    .toEqual(["nexttrack", "pause", "play", "previoustrack", "seekbackward", "seekforward", "seekto"]);

  // 3. Название и обложка.
  await expect.poll(async () => (await nativeCalls(page, "MediaSession", "setMetadata")).length).toBeGreaterThanOrEqual(1);
  const meta = (await nativeCalls(page, "MediaSession", "setMetadata")).at(-1)!.options as {
    title?: string;
    artwork?: { src: string }[];
  };
  expect(meta.title, "название рассказа в карточке").toContain("стирки");
  expect(meta.artwork?.[0]?.src ?? "", "обложка — картинкой или полным адресом (относительный Java не читает)").toMatch(
    /^(data:image\/png;base64,|https?:\/\/)/,
  );
  expect(await lastPlaybackState(page), "до «▶» карточка не «играет»").not.toBe("playing");

  // 4. «▶» на странице.
  await page.locator('[data-rf-player="play"]').first().click();
  await page.waitForFunction(() => {
    const el = document.querySelector("audio");
    return !!el && !el.paused && el.readyState >= 3;
  }, null, { timeout: 15_000 });
  expect(origin.hits.length, "запись пришла из подменённого источника").toBeGreaterThan(0);
  await expect.poll(() => lastPlaybackState(page), "карточка «играет»").toBe("playing");

  // 5. «Пауза» и «play» из шторки.
  expect(await fireNativeCallback(page, "MediaSession", "setActionHandler", { action: "pause" }, { action: "pause" })).toBe(true);
  await expect.poll(() => audioPaused(page), "«пауза» в шторке остановила запись").toBe(true);
  await expect.poll(() => lastPlaybackState(page), "карточка — «пауза»").toBe("paused");

  expect(await fireNativeCallback(page, "MediaSession", "setActionHandler", { action: "play" }, { action: "play" })).toBe(true);
  await expect.poll(() => audioPaused(page), "«play» в шторке запустил запись").toBe(false);
  await expect.poll(() => lastPlaybackState(page), "карточка снова «играет»").toBe("playing");

  // 6. Уход внутри приложения.
  const positionsBefore = (await nativeCalls(page, "MediaSession", "setPositionState")).length;
  await page.locator('a[href="/ru/stories"]').first().click();
  await expect(page).toHaveURL(/\/ru\/stories$/);
  await expect.poll(() => lastPlaybackState(page), "карточка убрана целиком").toBe("none");
  const zeroed = (await nativeCalls(page, "MediaSession", "setPositionState"))
    .slice(positionsBefore)
    .some((c) => c.options.duration === 0 && c.options.position === 0);
  expect(zeroed, "шкала карточки обнулена до «none»").toBe(true);
});

test("контроль слепоты: страница рассказа без моста не видит Android и не зовёт карточку", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({});
  await serveClipLocally(context);
  await openStory(page);
  await page.waitForSelector("html:not([data-hydrating])");
  const platform = await page.evaluate(() => {
    const cap = (window as unknown as { Capacitor?: { getPlatform(): string } }).Capacitor;
    return cap?.getPlatform() ?? "none";
  });
  expect(platform).not.toBe("android");
  expect(await page.evaluate(() => "__rfNativeCalls" in window)).toBe(false);
});
