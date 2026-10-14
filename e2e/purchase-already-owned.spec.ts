import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * «УЖЕ КУПЛЕНО» (RC-BUY-6) — НЕ ОШИБКА ДЛЯ ЧЕЛОВЕКА — заход 7.265.
 *
 * Откуда. Sentry NEXTJS-1A, 13.10.2026 12:38:19 PDT, POCO владельца:
 * «NativeStorePurchaseFailed: 6» через 2,5 с после нажатия тарифа. По
 * боевой базе: у Google-аккаунта телефона была тестовая подписка «Un mes»
 * (куплена в 19:12 UTC под учёткой сайта `cmszb91fq…`), а покупал он под
 * ДРУГОЙ учёткой сайта (`cmt9lqcny…`). Google ответил ITEM_ALREADY_OWNED —
 * SDK RevenueCat 10.17 переводит его в код 6 (`billingResponseToPurchasesError`,
 * ответ 7 → ProductAlreadyPurchasedError); тот же код 6 SDK даёт на ответ
 * сервера RevenueCat 7852 «покупка принадлежит другому пользователю».
 * Экран говорил «No se pudo completar. Vuelve a intentarlo.» и «Código:
 * RC-BUY-6» — а повтор не поможет никогда.
 *
 * Мост Capacitor — дословно из пакета оболочки (как
 * `purchase-confirmed.spec.ts`); магазин подставной. Три исхода:
 *   1. подписка на другой учётке, перенос запрещён (восстановление → код 7);
 *   2. перенос разрешён (восстановление → доступ, «вебхук TRANSFER»);
 *   3. доступ на этой учётке уже открыт (вебхук успел раньше).
 */

const BRIDGE_JS = readFileSync(
  path.join(process.cwd(), "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js"),
  "utf8",
);
const GLOBAL_JS = `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };`;
const PLUGIN_JS = `window.Capacitor.PluginHeaders = ${JSON.stringify([
  {
    name: "Purchases",
    methods: ["configure", "logIn", "logOut", "getOfferings", "getCustomerInfo", "purchasePackage", "restorePurchases"].map(
      (name) => ({ name, rtype: "promise" }),
    ),
  },
])};`;

type Restore = "other-account" | "transfer" | "already-open";

/** Покупка отвечает кодом 6 с тем текстом, что кладёт SDK; восстановление —
 *  по сценарию. Каждый вызов моста — в `sessionStorage`. */
const storeAlreadyOwned = (restore: Restore) => `
window.__rfGranted = false;
window.androidBridge = { postMessage(raw) {
  const call = JSON.parse(raw);
  try {
    const log = JSON.parse(sessionStorage.getItem("rf-bridge-calls") || "[]");
    log.push(call.methodName);
    sessionStorage.setItem("rf-bridge-calls", JSON.stringify(log));
  } catch (e) {}
  const ENT = "rusof\\u00e1cilapp_pro";
  const pkg = { identifier: "$rc_monthly", packageType: "MONTHLY",
    product: { identifier: "rf_monthly", priceString: "149,00 MXN", price: 149, currencyCode: "MXN", title: "Mes", description: "" } };
  const empty = { customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] } };
  const active = { customerInfo: { entitlements: { active: { [ENT]: { identifier: ENT, productIdentifier: "rf_monthly", isActive: true } } }, allPurchasedProductIdentifiers: ["rf_monthly"] } };
  const reply = (extra, ms) => setTimeout(() => window.Capacitor.fromNative(Object.assign({
    callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName }, extra)), ms || 20);
  const grant = () => fetch("/api/test/grant-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    .then(function () { window.__rfGranted = true; });
  if (call.methodName === "getOfferings") return reply({ success: true, data: { all: { default: { availablePackages: [pkg] } }, current: { identifier: "default", availablePackages: [pkg] } } });
  if (call.methodName === "purchasePackage") {
    const fail = () => reply({ success: false, error: { message: "This product is already active for the user.", code: "6",
      data: { underlyingErrorMessage: "Item already owned." } } }, 2500);
    if (${JSON.stringify(restore)} === "already-open") { grant().then(fail); return; }
    return fail();
  }
  if (call.methodName === "restorePurchases") {
    if (${JSON.stringify(restore)} === "other-account") return reply({ success: false, error: { message: "The receipt is already in use by another subscriber.", code: "7" } });
    if (${JSON.stringify(restore)} === "transfer") { grant().then(() => reply({ success: true, data: active })); return; }
    return reply({ success: true, data: window.__rfGranted ? active : empty });
  }
  if (call.methodName === "getCustomerInfo") return reply({ success: true, data: window.__rfGranted ? active : empty });
  return reply({ success: true, data: {} });
} };`;

const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "15", domain: "localhost", path: "/" },
];

const OLD_FAILURE = /No se pudo completar|Не получилось завершить/;

async function buyWhileOwned(page: Page, context: BrowserContext, restore: Restore): Promise<void> {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await context.addInitScript({ content: `${storeAlreadyOwned(restore)}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}` });
  await page.goto("/es/profile?tab=subscription");
  await dismissWelcomeOverlay(page);
  const platform = await page.evaluate(
    () => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.(),
  );
  expect(platform, "подстановка моста обязана подействовать").toBe("android");
  await page.evaluate(() => sessionStorage.removeItem("rf-bridge-calls"));
  await page.getByTestId("native-purchase-option").first().click();
}

async function bridgeCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("rf-bridge-calls") || "[]"));
}

test("код 6, подписка на другой учётке сайта, перенос запрещён — так и сказано, без «No se pudo» и без кода", async ({ page, context }) => {
  await buyWhileOwned(page, context, "other-account");
  const message = page.getByTestId("native-purchase-message");
  await expect(message).toHaveText(/Ya tienes esta suscripción en tu cuenta de Google\b/, { timeout: 20_000 });
  await expect(message).toHaveText(/otra cuenta de RusoFácil/);
  await expect(message).not.toHaveText(OLD_FAILURE);
  await expect(page.getByTestId("native-purchase-code")).toHaveCount(0);
  // Восстановление попробовано само, ровно один раз.
  expect((await bridgeCalls(page)).filter((c) => c === "restorePurchases")).toHaveLength(1);
});

test("код 6, перенос разрешён — восстановление само, доступ открыт, сказано честно про другую учётку", async ({ page, context }) => {
  await buyWhileOwned(page, context, "transfer");
  const message = page.getByTestId("native-purchase-message");
  await expect(message).toHaveText(/ya funciona en esta cuenta/, { timeout: 30_000 });
  await expect(message).toHaveText(/otra cuenta de RusoFácil/);
  await expect(message).not.toHaveText(OLD_FAILURE);
  await expect(page.getByTestId("native-purchase-code")).toHaveCount(0);
  expect((await bridgeCalls(page)).filter((c) => c === "restorePurchases")).toHaveLength(1);
});

test("код 6, а доступ на этой учётке уже открыт — «уже открыт», восстановление не нужно", async ({ page, context }) => {
  await buyWhileOwned(page, context, "already-open");
  const message = page.getByTestId("native-purchase-message");
  await expect(message).toHaveText(/Ya tienes esta suscripción en tu cuenta de Google\b/, { timeout: 20_000 });
  await expect(message).toHaveText(/ya está abierto/);
  await expect(message).not.toHaveText(OLD_FAILURE);
  await expect(page.getByTestId("native-purchase-code")).toHaveCount(0);
  expect((await bridgeCalls(page)).filter((c) => c === "restorePurchases")).toHaveLength(0);
});
