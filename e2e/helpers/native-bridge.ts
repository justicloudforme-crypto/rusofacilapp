import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * НАСТОЯЩИЙ МОСТ CAPACITOR В БРАУЗЕРЕ — ОБЩИЙ ПОМОЩНИК (долг 303, заход 7.298).
 *
 * Зачем. Весь нативный слой сайта ветвится по `Capacitor.isNativePlatform()`,
 * а в браузере, Playwright и vitest это `false` — всё, что стоит после ветки,
 * не исполнял ни один прибор. В 7.225 `e2e/native-purchase-outcomes.spec.ts`
 * впервые подложил в страницу НАСТОЯЩИЙ `native-bridge.js` из того же пакета
 * `@capacitor/android`, которым собрана оболочка, — но только для покупки.
 * Здесь та же подстановка вынесена в помощник, чтобы любой нативный узел мог
 * получить пробу.
 *
 * Как устроено (повторяет то, что делает сама оболочка до загрузки страницы):
 *  1. `JSExport.getGlobalJS` — `window.Capacitor` с пустым `Plugins`;
 *  2. `JSExport.getPluginJS` — `PluginHeaders`: какие плагины «есть в
 *     оболочке» и какие у них методы; `@capacitor/core` строит по ним прокси;
 *  3. `native-bridge.js` дословно из `node_modules`;
 *  4. `window.androidBridge.postMessage` — нативная сторона. Здесь она
 *     ЗАПИСЫВАЕТ каждый вызов в `window.__rfNativeCalls` и отвечает успехом
 *     (`answers` — данные ответа по имени метода; по умолчанию `{}`).
 *     Подписки (`addListener`) не отвечаются сразу: их `callbackId`
 *     запоминается, и `fireNativeEvent` позже шлёт по нему событие — так,
 *     как это делает Android (`notifyListeners`).
 *
 * Утверждение «мы действительно на Android» проверяется в каждой пробе
 * (`expectNativeAndroid`), а не принимается на веру.
 */

const BRIDGE_JS = readFileSync(
  path.join(process.cwd(), "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js"),
  "utf8",
);

export interface NativePluginHeader {
  name: string;
  methods: string[];
}

export interface NativeCall {
  pluginId: string;
  methodName: string;
  options: Record<string, unknown>;
  callbackId: string;
}

/** Плагины, которые сайт зовёт из нативных узлов (имена — как в `registerPlugin`). */
export const SITE_NATIVE_PLUGINS: NativePluginHeader[] = [
  { name: "App", methods: ["addListener", "removeListener", "removeAllListeners", "exitApp", "getInfo", "getState"] },
  { name: "Haptics", methods: ["impact", "notification", "vibrate", "selectionStart", "selectionChanged", "selectionEnd"] },
  {
    name: "LocalNotifications",
    methods: [
      "schedule",
      "getPending",
      "cancel",
      "checkPermissions",
      "requestPermissions",
      "removeAllDeliveredNotifications",
      "getDeliveredNotifications",
      "addListener",
      "removeAllListeners",
    ],
  },
];

export async function installNativeBridge(
  context: BrowserContext,
  options: { plugins?: NativePluginHeader[]; answers?: Record<string, unknown> } = {},
): Promise<void> {
  const plugins = options.plugins ?? SITE_NATIVE_PLUGINS;
  const headers = plugins.map((p) => ({
    name: p.name,
    methods: p.methods.map((name) => ({ name, rtype: name === "addListener" ? "callback" : "promise" })),
  }));
  const answers = JSON.stringify(options.answers ?? {});
  const script = [
    `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };`,
    `window.Capacitor.PluginHeaders = ${JSON.stringify(headers)};`,
    // Нативная сторона — ДО моста: `native-bridge.js` выбирает платформу и
    // канал отправки (`postToNative`) один раз, в момент загрузки, по
    // наличию `window.androidBridge`. Поставленная после, она оставила бы
    // `getPlatform() === "android"`, но все вызовы ушли бы в никуда
    // (замерено: 3 пробы из 5 без единого вызова, 7.298).
    `(() => {
      const answers = ${answers};
      window.__rfNativeCalls = [];
      window.androidBridge = { postMessage(raw) {
        const call = JSON.parse(raw);
        if (!call || !call.pluginId) return;
        window.__rfNativeCalls.push({
          pluginId: call.pluginId, methodName: call.methodName,
          options: call.options || {}, callbackId: call.callbackId,
        });
        if (call.methodName === "addListener") return;
        setTimeout(() => window.Capacitor.fromNative({
          callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName,
          success: true, data: answers[call.pluginId + "." + call.methodName] ?? {},
        }), 10);
      } };
    })();`,
    BRIDGE_JS,
  ].join("\n");
  await context.addInitScript({ content: script });
}

/** Платформа страницы — та, которую видит `@capacitor/core`. */
export async function nativePlatformOf(page: Page): Promise<{ platform: string; native: boolean }> {
  return page.evaluate(() => {
    const cap = (window as unknown as { Capacitor?: { getPlatform(): string; isNativePlatform(): boolean } }).Capacitor;
    return { platform: cap?.getPlatform() ?? "none", native: cap?.isNativePlatform() ?? false };
  });
}

export async function nativeCalls(page: Page, pluginId?: string, methodName?: string): Promise<NativeCall[]> {
  const all = await page.evaluate(
    () => (window as unknown as { __rfNativeCalls?: NativeCall[] }).__rfNativeCalls ?? [],
  );
  return all.filter((c) => (!pluginId || c.pluginId === pluginId) && (!methodName || c.methodName === methodName));
}

/**
 * Событие с нативной стороны по последней подписке `pluginId`/`eventName`.
 * Возвращает false, если подписки нет, — проба обязана это проверить.
 */
export async function fireNativeEvent(
  page: Page,
  pluginId: string,
  eventName: string,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  return page.evaluate(
    ({ pluginId, eventName, data }) => {
      const calls = (window as unknown as { __rfNativeCalls?: NativeCall[] }).__rfNativeCalls ?? [];
      const sub = [...calls]
        .reverse()
        .find((c) => c.pluginId === pluginId && c.methodName === "addListener" && c.options.eventName === eventName);
      if (!sub) return false;
      (window as unknown as { Capacitor: { fromNative(m: unknown): void } }).Capacitor.fromNative({
        callbackId: sub.callbackId,
        pluginId,
        methodName: "addListener",
        success: true,
        data,
      });
      return true;
    },
    { pluginId, eventName, data },
  );
}
