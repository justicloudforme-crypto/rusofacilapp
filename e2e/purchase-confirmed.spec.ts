import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ПОСЛЕ ОПЛАТЫ: ПОДТВЕРЖДЕНИЕ И ЗАМКИ — заход 7.264, видео первой
 * настоящей покупки 13.10.2026.
 *
 * Что на видео (кадры через 0,5 с): Google взял оплату (~6,3 с), вебхук
 * записал доступ через 10,59 с (≈16,9 с), а наша шторка на 18,5–19,0 с
 * всё ещё «Completando la compra…» — магазин ответил только после листа
 * «Puntos de Google Play». На 19,5 с шторки нет, сообщения об успехе не
 * было, «🔒 Con suscripción» висит до 20,5 с.
 *
 * Прибор повторяет порядок: «вебхук» через 1,5 с после нажатия, ответ
 * магазина — через 7 с, шторку закрывают на «Completando la compra…»,
 * перерисовка страницы задержана на 1,5 с. Мост Capacitor — дословно из
 * пакета оболочки (как `purchase-unlocks-current-page.spec.ts`).
 *
 * ДО ПРАВКИ (тот же прибор): подтверждения нет вовсе, а замки видны до
 * ответа магазина + опроса + перерисовки.
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

/** Вебхук раньше ответа магазина — порядок с видео. */
const storeAnsweringLate = (webhookMs: number, storeMs: number) => `
window.__rfGranted = false;
window.androidBridge = { postMessage(raw) {
  const call = JSON.parse(raw);
  const ENT = "rusof\\u00e1cilapp_pro";
  const pkg = { identifier: "$rc_monthly", packageType: "MONTHLY",
    product: { identifier: "rf_monthly", priceString: "149,00 MXN", price: 149, currencyCode: "MXN", title: "Mes", description: "" } };
  const empty = { customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] } };
  const active = { customerInfo: { entitlements: { active: { [ENT]: { identifier: ENT, productIdentifier: "rf_monthly", isActive: true } } }, allPurchasedProductIdentifiers: ["rf_monthly"] } };
  const answer = (data, ms) => setTimeout(() => window.Capacitor.fromNative({
    callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName, success: true, data }), ms || 20);
  if (call.methodName === "getOfferings") return answer({ all: { default: { availablePackages: [pkg] } }, current: { identifier: "default", availablePackages: [pkg] } });
  if (call.methodName === "purchasePackage") {
    window.__rfTap = performance.now();
    setTimeout(function () {
      fetch("/api/test/grant-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(function () { window.__rfGranted = true; window.__rfWebhook = performance.now(); });
    }, ${webhookMs});
    setTimeout(function () { window.__rfStore = performance.now(); }, ${storeMs});
    return answer(active, ${storeMs});
  }
  if (call.methodName === "getCustomerInfo" || call.methodName === "restorePurchases") return answer(window.__rfGranted ? active : empty);
  return answer({});
} };`;

const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "5", domain: "localhost", path: "/" },
];

/** Видимые знаки «🔒 Con suscripción» и сколько их в разметке. */
const LOCKS = `(() => {
  const all = Array.from(document.querySelectorAll('[data-access-mark="subscription"]'));
  return { present: all.length, visible: all.filter((n) => n.getClientRects().length > 0).length };
})()`;

async function openLevelWithLateStore(page: Page, context: BrowserContext): Promise<void> {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await context.addInitScript({ content: `${storeAnsweringLate(1_500, 7_000)}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}` });
  // Перерисовка на телефоне не мгновенная (видео: ~1 с) — задержать её.
  await context.route(
    (url) => url.pathname === "/es/courses/a1",
    async (route) => {
      const h = route.request().headers();
      if (h["rsc"] || h["next-router-state-tree"]) await new Promise((r) => setTimeout(r, 1_500));
      await route.continue();
    },
  );
  await page.goto("/es/courses/a1");
  const before = (await page.evaluate(LOCKS)) as { present: number; visible: number };
  expect(before.visible, "ОБРАТНЫЙ КОНТРОЛЬ: у аккаунта без доступа замки видны").toBeGreaterThan(0);
  await page.locator('a[href*="/es/courses/a1/"]').nth(1).click();
  await expect(page.getByRole("dialog"), "тап по закрытому уроку не открыл шторку").toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("native-purchase-option").first()).toBeVisible({ timeout: 30_000 });
}

test("видео 13.10: шторку закрыли на «Completando la compra…» — подтверждение есть, замки уходят до ответа магазина", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await openLevelWithLateStore(page, context);
  await page.getByTestId("native-purchase-option").first().click();
  await expect(page.getByTestId("native-purchase-message")).toHaveText("Completando la compra…", { timeout: 5_000 });
  // Как на видео: шторки на экране больше нет, магазин ещё не ответил.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Замки: время от «вебхука» до момента, когда ни одного не видно.
  const timing = await page.evaluate(
    (locksExpr) =>
      new Promise<{ hiddenAfterWebhook: number; storeAnsweredFirst: boolean; presentWhenHidden: number }>((resolve, reject) => {
        const w = window as unknown as { __rfWebhook?: number; __rfStore?: number };
        const started = performance.now();
        const tick = () => {
          const locks = (0, eval)(locksExpr) as { present: number; visible: number };
          if (w.__rfWebhook !== undefined && locks.visible === 0) {
            resolve({
              hiddenAfterWebhook: Math.round(performance.now() - w.__rfWebhook),
              storeAnsweredFirst: w.__rfStore !== undefined,
              presentWhenHidden: locks.present,
            });
            return;
          }
          if (performance.now() - started > 30_000) reject(new Error(`замки видны 30 с: ${JSON.stringify(locks)}`));
          else requestAnimationFrame(tick);
        };
        tick();
      }),
    LOCKS,
  );
  console.log(`7.264 задача 2: ${JSON.stringify(timing)}`);
  expect(timing.storeAnsweredFirst, "замки ушли только после ответа магазина — как на видео (19,0 → 20,5 с)").toBe(false);
  // Опрос сервера раз в 3 с: от вебхука до ответа — не больше круга + запас.
  expect(timing.hiddenAfterWebhook).toBeLessThan(4_500);

  await expect(page.getByTestId("purchase-confirmed"), "после оплаты нет подтверждения на экране").toContainText(
    "¡Listo! Tu suscripción está activa",
    { timeout: 5_000 },
  );
  expect(new URL(page.url()).pathname, "замки сняты переходом, а не на той же странице").toBe("/es/courses/a1");

  // Перерисовка доезжает и убирает знаки из разметки совсем.
  await expect.poll(async () => ((await page.evaluate(LOCKS)) as { present: number }).present, { timeout: 30_000 }).toBe(0);
});

test("шторка открыта до ответа сервера — «Listo» говорит она, второго подтверждения поверх нет", async ({ page, context }) => {
  test.setTimeout(150_000);
  await openLevelWithLateStore(page, context);
  await page.getByTestId("native-purchase-option").first().click();
  await expect(page.getByTestId("native-purchase-message"), "шторка не сказала «Listo»").toHaveText(
    "Listo: tu acceso ya está abierto.",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("purchase-confirmed")).toHaveCount(0);
  const locks = (await page.evaluate(LOCKS)) as { visible: number };
  expect(locks.visible, "под открытой шторкой замки видны после ответа сервера").toBe(0);
});
