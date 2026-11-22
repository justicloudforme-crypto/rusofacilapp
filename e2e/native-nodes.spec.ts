import { test, expect } from "./helpers/test";
import { fireNativeEvent, installNativeBridge, nativeCalls, nativePlatformOf } from "./helpers/native-bridge";

/**
 * НАТИВНЫЕ УЗЛЫ САЙТА ИСПОЛНЯЮТСЯ ПОД НАСТОЯЩИМ МОСТОМ — ДОЛГ 303 (заход 7.298).
 *
 * До этого файла из шести узлов, стоящих за `Capacitor.isNativePlatform()`,
 * прибором исполнялся один (покупка, `native-purchase-outcomes.spec.ts`).
 * Здесь — четыре следующих: `NativeShellCookie`, `NativeBackButtonHandler`,
 * `NativeNotifications`, `haptics`. Шестой, `native-media-session`, — нет
 * (нужен проигрыватель с настоящей записью; остаток долга).
 *
 * Каждая проба сначала утверждает, что страница видит Android
 * (`getPlatform() === "android"`), и только потом судит узел. Последняя
 * проба — контроль слепоты: без моста те же страницы не делают ни одного
 * нативного вызова и не видят Android, то есть пробы судят ветку после
 * `isNativePlatform()`, а не что-то, что происходит всегда.
 */

const PAGE = "/es/courses";
const SECOND = "/es/glossary";

/**
 * Кука признака оболочки, как у настоящего телефона (её ставит `src/proxy.ts`
 * по токену). Без неё `NativeShellCookie` законно делает `router.refresh()`
 * на первой странице, и следующий переход пробы с ним гоняется (замерено:
 * «navigation interrupted», 1 из 10 в 7.298). Проба самой куки её не ставит.
 */
async function withShellCookie(context: import("@playwright/test").BrowserContext) {
  await context.addCookies([{ name: "rf_native_shell", value: "1", domain: "localhost", path: "/" }]);
}

async function expectAndroid(page: import("@playwright/test").Page) {
  expect(await nativePlatformOf(page), "мост подложен: страница видит Android").toEqual({
    platform: "android",
    native: true,
  });
}

test("NativeShellCookie: оболочка без куки — компонент ставит признак и куку сам", async ({ page, context }) => {
  await installNativeBridge(context);
  await page.goto(PAGE);
  await expectAndroid(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.shell ?? null)).toBe("1");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "rf_native_shell")?.value, "кука признака оболочки поставлена").toBe("1");
});

test("NativeBackButtonHandler: «назад» Android идёт по истории, а на первой странице закрывает приложение", async ({
  page,
  context,
}) => {
  await withShellCookie(context);
  await installNativeBridge(context);
  await page.goto(PAGE);
  await page.goto(SECOND);
  await expectAndroid(page);
  await expect.poll(async () => (await nativeCalls(page, "App", "addListener")).map((c) => c.options.eventName)).toContain(
    "backButton",
  );

  expect(await fireNativeEvent(page, "App", "backButton", { canGoBack: true })).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));

  await expectAndroid(page);
  await expect.poll(async () => (await nativeCalls(page, "App", "addListener")).map((c) => c.options.eventName)).toContain(
    "backButton",
  );
  expect(await nativeCalls(page, "App", "exitApp")).toHaveLength(0);
  expect(await fireNativeEvent(page, "App", "backButton", { canGoBack: false })).toBe(true);
  await expect.poll(async () => (await nativeCalls(page, "App", "exitApp")).length).toBe(1);
});

test("NativeNotifications: бейдж снимается на запуске и на каждом возвращении в приложение", async ({ page, context }) => {
  await withShellCookie(context);
  await installNativeBridge(context);
  await page.goto(PAGE);
  await expectAndroid(page);
  const cleared = async () => (await nativeCalls(page, "LocalNotifications", "removeAllDeliveredNotifications")).length;
  await expect.poll(cleared, "снят на запуске").toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await nativeCalls(page, "App", "addListener")).map((c) => c.options.eventName)).toContain(
    "resume",
  );
  const before = await cleared();
  expect(await fireNativeEvent(page, "App", "resume")).toBe(true);
  await expect.poll(cleared, "снят и на возвращении").toBe(before + 1);
});

test("haptics: нажатие по нижней панели даёт лёгкий отклик телефона", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await withShellCookie(context);
  await installNativeBridge(context);
  await page.goto(PAGE);
  await expectAndroid(page);
  await page.waitForSelector("html:not([data-hydrating])");
  expect(await nativeCalls(page, "Haptics")).toHaveLength(0);
  const nav = page.locator("nav.fixed.bottom-0 a").last();
  await expect(nav).toBeVisible();
  await nav.click();
  await expect.poll(async () => (await nativeCalls(page, "Haptics", "impact")).map((c) => c.options.style)).toContain("LIGHT");
});

test("контроль слепоты: без моста те же страницы не видят Android и не зовут ни одного плагина", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  await page.waitForSelector("html:not([data-hydrating])");
  const seen = await page.evaluate(() => {
    const cap = (window as unknown as { Capacitor?: { getPlatform(): string } }).Capacitor;
    return { platform: cap?.getPlatform() ?? "none", shell: document.documentElement.dataset.shell ?? null };
  });
  expect(seen.platform).not.toBe("android");
  expect(seen.shell).toBeNull();
  expect(await page.evaluate(() => "__rfNativeCalls" in window)).toBe(false);
});
