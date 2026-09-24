import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ДОЛГ 304: ПОСЛЕ ПОКУПКИ ЗАМКИ СНИМАЮТСЯ С ТОЙ ЖЕ СТРАНИЦЫ, ПОВЕРХ
 * КОТОРОЙ ОТКРЫТА ШТОРКА — заход 7.229.
 *
 * ====================================================================
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 24.09.2026 (POCO, 1.0.4)
 * ====================================================================
 *
 * Страница уровня A1 → урок 2 с замком → шторка «Este material está
 * cerrado» → «Un mes 8,49 $» → Google Play «Подписка оформлена» → в
 * шторке «Activando tu acceso…» → ШТОРКА ЗАКРЫЛАСЬ, а под ней на
 * странице A1 уроки 2 и 3 по-прежнему с «Con suscripción». Надписи
 * «Готово: доступ открыт» на видео нет вовсе. Уход в «Мой профиль» и
 * возврат — замков нет.
 *
 * ПРИЧИНА, НАЙДЕННАЯ ПРОГОНОМ, А НЕ ЧТЕНИЕМ. Цикл ожидания доступа жил
 * внутри экрана покупки, а тот размонтируется вместе со шторкой
 * (`Modal` при `open === false` возвращает `null`). Оба выхода по
 * `alive.current` стояли ПЕРЕД `router.refresh()` — то есть закрытая
 * шторка убивала саму перерисовку страницы. Замер до правки: 32 знака
 * платного и через 15 секунд после того, как сервер доступ открыл.
 *
 * ПОЧЕМУ ЗАКРЫВАЕТСЯ ШТОРКА — здесь не решается и не гадается
 * (кандидаты: возврат из системного листа Google Play, кнопка «назад»,
 * пересоздание окна). Проба закрывает ВЕСЬ КЛАСС: чем бы шторка ни
 * закрылась, замки обязаны сняться.
 *
 * ====================================================================
 * ПРИБОР
 * ====================================================================
 *
 * Мост Capacitor берётся ДОСЛОВНО из того же пакета, которым собрана
 * оболочка (`native-bridge.js` + `globalJS` + `PluginHeaders` в форме
 * `JSExport.java`) — тот же приём, что в `native-purchase-outcomes`.
 * Нативная сторона подставная: она подтверждает оплату сразу, а «вебхук»
 * (выдача доступа на сервере) доезжает ПОЗЖЕ, как и на телефоне.
 *
 * ЧЕГО ПРОБА НЕ ДОКАЗЫВАЕТ. Настоящего магазина здесь нет, настоящего
 * Android тоже (долг 176). Доказывается ровно то, ради чего заход:
 * страница под шторкой перечитывается сама, и это не зависит от того,
 * открыта шторка или нет.
 */

const BRIDGE_JS = readFileSync(
  path.join(process.cwd(), "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js"),
  "utf8",
);

/** JSExport.getGlobalJS — дословно. */
const GLOBAL_JS = `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };`;

/** JSExport.getPluginJS — та его часть, без которой `@capacitor/core`
 *  ушёл бы в веб-заглушку и не проверил бы ничего. */
const PLUGIN_JS = `window.Capacitor.PluginHeaders = ${JSON.stringify([
  {
    name: "Purchases",
    methods: ["configure", "logIn", "logOut", "getOfferings", "getCustomerInfo", "purchasePackage", "restorePurchases"].map(
      (name) => ({ name, rtype: "promise" }),
    ),
  },
])};`;

/**
 * Подставная нативная сторона: оплата подтверждается сразу, а доступ на
 * сервере появляется через `webhookDelayMs` — ровно тот разрыв, внутри
 * которого шторка и закрывалась.
 */
const storeThatSells = (webhookDelayMs: number) => `
window.__rfGranted = false;
window.androidBridge = { postMessage(raw) {
  const call = JSON.parse(raw);
  const ENT = "rusof\\u00e1cilapp_pro";
  const pkg = { identifier: "$rc_monthly", packageType: "MONTHLY",
    product: { identifier: "rf_monthly", priceString: "149,00 MXN", price: 149, currencyCode: "MXN", title: "Mes", description: "" } };
  const empty = { customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] } };
  const active = { customerInfo: { entitlements: { active: { [ENT]: { identifier: ENT, productIdentifier: "rf_monthly", isActive: true } } }, allPurchasedProductIdentifiers: ["rf_monthly"] } };
  const answer = (data) => setTimeout(() => window.Capacitor.fromNative({
    callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName, success: true, data }), 20);
  if (call.methodName === "getOfferings") return answer({ all: { default: { availablePackages: [pkg] } }, current: { identifier: "default", availablePackages: [pkg] } });
  if (call.methodName === "purchasePackage") {
    setTimeout(function () {
      fetch("/api/test/grant-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(function () { window.__rfGranted = true; });
    }, ${webhookDelayMs});
    return answer(active);
  }
  if (call.methodName === "getCustomerInfo" || call.methodName === "restorePurchases") return answer(window.__rfGranted ? active : empty);
  return answer({});
} };`;

const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "5", domain: "localhost", path: "/" },
];

const LOCK = "[data-access-mark]";

async function openLevelPageWithStore(
  page: Page,
  context: BrowserContext,
  webhookDelayMs: number,
): Promise<number> {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await context.addInitScript({ content: `${storeThatSells(webhookDelayMs)}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}` });
  await page.goto("/ru/courses/a1");

  // Утверждение ПОЛОЖИТЕЛЬНОЕ: подстановка моста обязана подействовать,
  // иначе всё ниже проверяло бы обычный браузер (долги 94 и 95).
  const platform = await page.evaluate(
    () => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.(),
  );
  expect(platform, "подстановка моста обязана подействовать").toBe("android");

  const before = await page.locator(LOCK).count();
  expect(before, "ОБРАТНЫЙ КОНТРОЛЬ: у аккаунта без доступа замков нет — снимать было бы нечего").toBeGreaterThan(0);
  return before;
}

/** Открыть шторку покупки тапом по закрытому уроку и дождаться вариантов. */
async function openPurchaseSheet(page: Page): Promise<void> {
  await page.locator('a[href*="/ru/courses/a1/"]').nth(1).click();
  await expect(page.getByRole("dialog"), "тап по закрытому уроку не открыл шторку").toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("native-purchase-option").first(), "вариантов покупки в шторке нет").toBeVisible({
    timeout: 30_000,
  });
}

test("покупка при ОТКРЫТОЙ шторке: «Готово: доступ открыт» показано, и замки снимаются сами", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);

  await openLevelPageWithStore(page, context, 1_000);
  await openPurchaseSheet(page);
  await page.getByTestId("native-purchase-option").first().click();

  // Надпись «Готово» — половина жалобы владельца: на видео её не видно
  // вовсе. Она обязана существовать и показываться.
  await expect(
    page.getByTestId("native-purchase-message"),
    "после выдачи доступа шторка не сказала «Готово: доступ открыт»",
  ).toHaveText(/Готово: доступ открыт/, { timeout: 60_000 });

  await expect
    .poll(() => page.locator(LOCK).count(), {
      message: "замки на странице под шторкой не сняты — ровно долг 304",
      timeout: 30_000,
    })
    .toBe(0);
});

test("покупка при ЗАКРЫТОЙ шторке: замки всё равно снимаются, без ухода на другую вкладку", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);

  /**
   * ЭТО И ЕСТЬ ВИДЕО ВЛАДЕЛЬЦА. Шторка закрывается, пока идёт
   * «Activando…», то есть ДО того, как сервер откроет доступ. До правки
   * 24.09.2026 замеров было два: 32 знака до покупки и 32 через 15
   * секунд после выдачи доступа.
   */
  await openLevelPageWithStore(page, context, 5_000);
  await openPurchaseSheet(page);
  await page.getByTestId("native-purchase-option").first().click();

  await expect(page.getByTestId("native-purchase-message"), "шторка не дошла до «активируем»").toHaveText(
    /Активируем|активируем/,
    { timeout: 30_000 },
  );

  // Шторка уезжает — чем бы она ни была закрыта на телефоне.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog"), "шторка не закрылась — сценарий не воспроизведён").toBeHidden();

  await expect
    .poll(() => page.locator(LOCK).count(), {
      message:
        "шторка закрылась на «активируем» — и замки остались на оплаченной странице (ровно то, что владелец снял 24.09.2026)",
      timeout: 40_000,
    })
    .toBe(0);

  // И адрес не менялся: снялись они САМИ, а не переходом.
  expect(new URL(page.url()).pathname, "замки сняты переходом на другую страницу, а не сами").toBe("/ru/courses/a1");
});
