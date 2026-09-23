import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ЭКРАН ПОКУПКИ НЕ ВИСИТ И НАЗЫВАЕТ ПРИЧИНУ — заход 7.225, настоящим
 * браузером и настоящим мостом Capacitor.
 *
 * ОТКУДА ВЗЯЛАСЬ ЭТА ПРОБА. 23.09.2026 владелец снял с телефона дефект:
 * экран покупки вечно показывал «Загружаем варианты…», ошибки не было, и
 * в RevenueCat не появилось ни одного клиента. Причина — `return
 * mod.Purchases` из `async`-функции: объект плагина THENABLE, и промис не
 * завершался никогда. Ни один прибор этого не видел, потому что ВСЕ они
 * работали в браузере, где `Capacitor.isNativePlatform()` — false и код
 * выходит ДО первого обращения к плагину.
 *
 * ПОЭТОМУ ЗДЕСЬ МОСТ НАСТОЯЩИЙ. `native-bridge.js` берётся ДОСЛОВНО из
 * того же пакета, которым собрана оболочка, — это тот самый файл, который
 * `Bridge.java` кладёт в `<head>` каждого документа
 * (`addDocumentStartJavaScript` / `JSInjector`). Рядом кладутся `globalJS`
 * и `PluginHeaders` ровно в той форме, что их печатает `JSExport.java`.
 * Браузер после этого считает себя Android и уходит в НАТИВНУЮ ветку
 * `@capacitor/core`, а не в веб-заглушку плагина.
 *
 * ЧЕГО ЭТА ПРОБА НЕ ДОКАЗЫВАЕТ. Настоящей покупки здесь нет: нативной
 * стороны не существует, её изображает подставной `androidBridge`.
 * Проверяется ровно то, ради чего заход: экран ВСЕГДА выходит из
 * «загружаем», называет причину своими словами и печатает код.
 */

const BRIDGE_JS = readFileSync(
  path.join(
    process.cwd(),
    "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js",
  ),
  "utf8",
);

/** JSExport.getGlobalJS — дословно. */
const GLOBAL_JS = `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };`;

/** JSExport.getPluginJS — та его часть, без которой `@capacitor/core`
 *  ушёл бы в веб-заглушку и ничего бы не проверил. */
const PLUGIN_JS = `window.Capacitor.PluginHeaders = ${JSON.stringify([
  {
    name: "Purchases",
    methods: [
      "configure",
      "logIn",
      "logOut",
      "getOfferings",
      "getCustomerInfo",
      "purchasePackage",
      "restorePurchases",
    ].map((name) => ({ name, rtype: "promise" })),
  },
])};`;

const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "4", domain: "localhost", path: "/" },
];

/** Нативная сторона ОТВЕЧАЕТ, а товаров в ответе нет. Так выглядит
 *  аккаунт Google, не допущенный к треку закрытого теста. */
const ANSWERS_WITHOUT_PRODUCTS = `
  window.androidBridge = { postMessage(raw) {
    const call = JSON.parse(raw);
    setTimeout(() => window.Capacitor.fromNative({
      callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName,
      success: true,
      data: call.methodName === "getOfferings" ? { all: {}, current: null } : {},
    }), 20);
  } };`;

/** Нативная сторона приняла вызов и не ответила НИКОГДА — ровно то, что
 *  мост Capacitor устраивает сам, проглатывая вызов в `cap.toNative`. */
const NEVER_ANSWERS = `window.androidBridge = { postMessage() {} };`;

async function openPurchaseScreen(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  bridge: string,
) {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await context.addInitScript({ content: `${bridge}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}` });
  await page.goto("/ru/pricing");
  await expect(page.getByTestId("native-purchase")).toBeVisible();
  // Утверждение ПОЛОЖИТЕЛЬНОЕ: подстановка моста обязана подействовать,
  // иначе всё ниже проверяло бы обычный браузер (долги 94 и 95).
  const platform = await page.evaluate(
    () => (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.(),
  );
  expect(platform, "подстановка моста обязана подействовать").toBe("android");
}

test("магазин ответил, а товаров нет — так и сказано, и есть «Повторить»", async ({ page, context }) => {
  await openPurchaseScreen(page, context, ANSWERS_WITHOUT_PRODUCTS);

  await expect(page.getByTestId("native-purchase-message")).toHaveText(/вариантов для вашей учётной записи не нашлось/, {
    timeout: 25_000,
  });
  await expect(page.getByTestId("native-purchase-retry")).toBeVisible();
  await expect(page.getByTestId("native-purchase-code")).toHaveText(/RC-EMPTY-OFR/);
});

/**
 * ГЛАВНЫЙ ПРИМЕР ЗАХОДА. До правки экран в этом обличье висел на
 * «Загружаем варианты…» бесконечно — замерено 45 секундами и ни разу не
 * вышло.
 */
test("нативная сторона молчит — экран выходит из «загружаем» по сроку, а не висит", async ({ page, context }) => {
  await openPurchaseScreen(page, context, NEVER_ANSWERS);

  await expect(page.getByTestId("native-purchase-message")).toHaveText(/Не удалось связаться с магазином/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("native-purchase-retry")).toBeVisible();
  await expect(page.getByTestId("native-purchase-code")).toHaveText(/RC-CONN-/);
});

/**
 * ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: без моста (обычный браузер) исход обязан быть
 * ДРУГИМ. Иначе два примера выше не доказывали бы, что причины
 * различаются, — они доказывали бы только, что экран что-то печатает.
 */
test("моста нет вовсе — исход другой: «эта версия не умеет открывать магазин»", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await page.goto("/ru/pricing");

  await expect(page.getByTestId("native-purchase-message")).toHaveText(/Обновите приложение до последней версии/, {
    timeout: 25_000,
  });
  await expect(page.getByTestId("native-purchase-code")).toHaveText(/RC-PLG-IMP/);
  await expect(page.getByTestId("native-purchase-retry")).toBeVisible();
});
