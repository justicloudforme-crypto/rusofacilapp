import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * НАЖАТИЕ НА ТАРИФ В ПРИЛОЖЕНИИ — ТОЛЬКО МОСТ ПОКУПКИ, НИКАКИХ МАГАЗИНОВ
 * (заход 7.244, `check:purchase-no-store-link` — статическая половина).
 *
 * ОТКУДА. 29.09.2026 владелец снял на POCO (1.0.12): тариф → «Activando…» →
 * вместо окна Google системное «Запрошенное приложение не найдено» от
 * RuStore → «No se pudo completar». Страница не открывает ни `market://`,
 * ни `play.google.com/store/apps`, ни `intent://` ни на одном экране с
 * тарифами — это здесь и доказывается НАСТОЯЩИМ мостом Capacitor (тот же
 * `native-bridge.js`, что кладёт оболочка), а нативную сторону изображает
 * подставной `androidBridge`, который записывает каждый вызов.
 *
 * Покупка в примерах ОТВЕЧАЕТ ОШИБКОЙ — ровно как на видео: магазин
 * вызван, вернул отказ. Требование: страница говорит «No se pudo
 * completar…» у себя и никуда не уходит.
 *
 * ЧЕГО НЕ ДОКАЗЫВАЕТ. Что делает Google Play/система ПОСЛЕ вызова моста —
 * это за пределами страницы (см. PROGRESS 7.244).
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

/** Магазин продаёт один тариф; покупка отвечает ОШИБКОЙ магазина (код 2 —
 *  STORE_PROBLEM у RevenueCat). Каждый вызов моста — в `sessionStorage`,
 *  чтобы запись пережила переход, если страница всё-таки уйдёт. */
const STORE_THAT_FAILS = `
window.androidBridge = { postMessage(raw) {
  const call = JSON.parse(raw);
  try {
    const log = JSON.parse(sessionStorage.getItem("rf-bridge-calls") || "[]");
    log.push(call.pluginId + "." + call.methodName);
    sessionStorage.setItem("rf-bridge-calls", JSON.stringify(log));
  } catch (e) {}
  const pkg = { identifier: "$rc_monthly", packageType: "MONTHLY",
    product: { identifier: "rf_monthly", priceString: "8,49 $", price: 8.49, currencyCode: "USD", title: "Un mes", description: "" } };
  const empty = { customerInfo: { entitlements: { active: {} }, allPurchasedProductIdentifiers: [] } };
  const reply = (extra) => setTimeout(() => window.Capacitor.fromNative(Object.assign({
    callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName }, extra)), 20);
  if (call.methodName === "getOfferings") return reply({ success: true, data: { all: { default: { availablePackages: [pkg] } }, current: { identifier: "default", availablePackages: [pkg] } } });
  if (call.methodName === "purchasePackage") return reply({ success: false, error: { message: "There was a problem with the store.", code: "2" } });
  if (call.methodName === "getCustomerInfo" || call.methodName === "restorePurchases") return reply({ success: true, data: empty });
  return reply({ success: true, data: {} });
} };`;

/** Любой уход страницы наружу: `window.open` и нажатая ссылка. */
const EXIT_SPY = `
window.open = function (u) { try { const l = JSON.parse(sessionStorage.getItem("rf-exits") || "[]"); l.push("open:" + u); sessionStorage.setItem("rf-exits", JSON.stringify(l)); } catch (e) {} return null; };
document.addEventListener("click", function (e) {
  const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!a) return;
  try { const l = JSON.parse(sessionStorage.getItem("rf-exits") || "[]"); l.push("a:" + a.getAttribute("href")); sessionStorage.setItem("rf-exits", JSON.stringify(l)); } catch (e2) {}
}, true);`;

const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "13", domain: "localhost", path: "/" },
];

const STORE_LINK = /^(market:|intent:)|play\.google\.com\/store\/apps|details\?id=/i;

type Watch = { requests: string[]; popups: number };

async function openAsApp(page: Page, context: BrowserContext): Promise<Watch> {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await context.addInitScript({ content: `${STORE_THAT_FAILS}\n${EXIT_SPY}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}` });
  const watch: Watch = { requests: [], popups: 0 };
  page.on("request", (r) => {
    if (STORE_LINK.test(r.url())) watch.requests.push(r.url());
  });
  context.on("page", () => watch.popups++);
  // Приветствие дня показывается один раз — снимаем его здесь, дальше
  // экраны открываются без него.
  await page.goto("/es/profile?tab=subscription");
  await dismissWelcomeOverlay(page);
  return watch;
}

async function assertBridgeOnly(page: Page, watch: Watch, where: string) {
  const before = new URL(page.url()).pathname + new URL(page.url()).search;
  // Судится только то, что случилось ПОСЛЕ нажатия на тариф: нажатие на
  // закрытый урок, открывшее окно, — тоже ссылка, но не путь покупки.
  await page.evaluate(() => {
    sessionStorage.removeItem("rf-bridge-calls");
    sessionStorage.removeItem("rf-exits");
  });
  await page.getByTestId("native-purchase-option").first().click();

  // Ж.1 цел: «покупка идёт» сразу, до ответа магазина.
  // Затем — отказ магазина, сказанный У СЕБЯ.
  await expect(page.getByTestId("native-purchase-message"), `${where}: отказ магазина не сказан на странице`).toHaveText(
    /No se pudo completar|Не получилось завершить/,
    { timeout: 20_000 },
  );
  // Код ответа магазина на экране — чтобы с видео было видно, ЧТО ответил
  // Google (до 7.244 отказ был немым).
  await expect(page.getByTestId("native-purchase-code"), `${where}: нет кода отказа`).toHaveText(/RC-BUY-2\b/);

  const calls: string[] = await page.evaluate(() => JSON.parse(sessionStorage.getItem("rf-bridge-calls") || "[]"));
  const exits: string[] = await page.evaluate(() => JSON.parse(sessionStorage.getItem("rf-exits") || "[]"));
  expect(calls.filter((c) => c === "Purchases.purchasePackage"), `${where}: тариф не вызвал мост покупки`).toHaveLength(1);
  expect(calls.filter((c) => !c.startsWith("Purchases.")), `${where}: из пути покупки ушёл вызов другого плагина`).toEqual([]);
  expect(exits, `${where}: страница пыталась уйти наружу`).toEqual([]);
  expect(watch.requests, `${where}: запрос к магазину приложений`).toEqual([]);
  expect(watch.popups, `${where}: открылось новое окно`).toBe(0);
  expect(new URL(page.url()).pathname + new URL(page.url()).search, `${where}: адрес сменился`).toBe(before);
}

async function assertApp(page: Page) {
  const platform = await page.evaluate(
    () => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.(),
  );
  expect(platform, "подстановка моста обязана подействовать").toBe("android");
}

test("Mi perfil → Suscripción: тариф → мост покупки, отказ — на месте, наружу ничего", async ({ page, context }) => {
  test.setTimeout(120_000);
  const watch = await openAsApp(page, context);
  await assertApp(page);
  await expect(page.getByTestId("native-purchase-option").first()).toBeVisible({ timeout: 30_000 });
  await assertBridgeOnly(page, watch, "Suscripción");
});

test("/pricing в приложении: тариф → мост покупки, наружу ничего", async ({ page, context }) => {
  test.setTimeout(120_000);
  const watch = await openAsApp(page, context);
  await page.goto("/es/pricing");
  await assertApp(page);
  await expect(page.getByTestId("native-purchase-option").first()).toBeVisible({ timeout: 30_000 });
  await assertBridgeOnly(page, watch, "/pricing");
});

test("окно замка (закрытый урок): тариф → мост покупки, наружу ничего", async ({ page, context }) => {
  test.setTimeout(120_000);
  const watch = await openAsApp(page, context);
  await page.goto("/ru/courses/a1");
  await assertApp(page);
  await page.locator('a[href*="/ru/courses/a1/"]').nth(1).click();
  await expect(page.getByRole("dialog"), "тап по закрытому уроку не открыл окно").toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("native-purchase-option").first()).toBeVisible({ timeout: 30_000 });
  await assertBridgeOnly(page, watch, "окно замка");
});

test("карточка замка «Abrir el acceso completo» (урок/рассказ) → окно → тариф → мост покупки, наружу ничего", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const watch = await openAsApp(page, context);
  // Первая страница, где сервер нарисовал карточку замка с кнопкой покупки.
  const candidates = [
    "/es/courses/a1/2",
    "/es/courses/a2/1",
    "/es/courses/b1/1",
    "/es/stories/e2e-fixture-story-camaleon",
    "/es/stories/e2e-fixture-story-paraguas-olvidado",
  ];
  let found: string | null = null;
  for (const url of candidates) {
    await page.goto(url);
    if ((await page.locator("[data-rf-native-buy]").count()) > 0) {
      found = url;
      break;
    }
  }
  expect(found, `ни на одной из ${candidates.length} страниц нет карточки замка с кнопкой покупки`).not.toBeNull();
  await assertApp(page);
  // У урока карточка замка стоит на закрытых вкладках (Presentación,
  // Vocabulario, Ejercicios) — открываем «Vocabulario», как владелец.
  const buyVisible = page.locator("[data-rf-native-buy]:visible");
  if ((await buyVisible.count()) === 0) {
    await page.getByRole("tab", { name: /Vocabulario/ }).or(page.getByRole("button", { name: /^Vocabulario/ })).first().click();
  }
  await buyVisible.first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("native-purchase-option").first()).toBeVisible({ timeout: 30_000 });
  await assertBridgeOnly(page, watch, `карточка замка ${found}`);
});

/**
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: в браузере те же тарифы — касса сайта, не мост.
 * Без него примеры выше не отличали бы «приложение» от «чего угодно».
 */
test("браузер (контроль): тариф на /pricing — форма кассы сайта, моста покупки нет", async ({ page }) => {
  await loginWithoutSubscription(page);
  await page.goto("/es/profile");
  await dismissWelcomeOverlay(page);
  await page.goto("/es/pricing");
  await expect(page.getByTestId("native-purchase")).toHaveCount(0);
  const forms = page.locator('form[action="/api/checkout"]');
  expect(await forms.count(), "в браузере нет формы кассы сайта").toBeGreaterThan(0);
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/api/checkout") && r.method() === "POST"),
    forms.first().locator('button[type="submit"], button:not([type])').first().click(),
  ]);
  expect(req.url()).toContain("/api/checkout");
});
