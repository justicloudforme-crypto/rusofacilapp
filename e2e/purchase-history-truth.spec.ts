import { readFileSync } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/**
 * ДОЛГ 359: ШАПКА «ACTIVA», А СТРОКА «ACCESOS Y PAGOS» — «EXPIRADA» —
 * заход 7.264.
 *
 * ====================================================================
 * ЧТО ИЗМЕРЕНО ПО БОЕВОЙ БАЗЕ (только SELECT)
 * ====================================================================
 *
 * Владелец 29.09.2026 (1.0.12, POCO) покупал «Un mes» из «Mi perfil →
 * Suscripción», имея ДЕВЯТЬ прежних строк магазина; последняя истекла в
 * 01:25:13 UTC, новая покупка записана вебхуком в 01:25:47 — через 34 с,
 * та же дата. Пока страница не перерисована, история «Accesos y pagos» —
 * это ответ сервера ДО покупки, и верхняя строка в ней — прежняя
 * «Mensual · 28 sept · Expirada», а шапка уже «Activa» (клиент узнал о
 * доступе раньше страницы: `ActivationAwareStatus`). Первая настоящая
 * покупка 13.10.2026 (новая учётка, строк до покупки 0) этого не дала:
 * старой строки не было, а вкладку открыли через ~10 с после перерисовки.
 *
 * ====================================================================
 * ПРИБОР
 * ====================================================================
 *
 * Мост Capacitor — дословно из пакета оболочки, нативная сторона
 * подставная (как в `purchase-unlocks-current-page.spec.ts`). «Вебхук»
 * доезжает через 3 с, перерисовка страницы задержана на 1,5 с — порядок
 * телефона. Наблюдатель в странице пишет КАЖДУЮ смену шапки и строк
 * истории с отметкой времени; противоречие — момент, когда шапка не
 * серверная («Activando…» или «Activa» до перерисовки), а верхняя строка
 * истории говорит «Expirada».
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

/** Наблюдатель: шапка подписки и статусы строк истории, каждая смена — с
 *  временем от нажатия тарифа. Ищет узлы по тексту заголовка истории, а не
 *  по меткам: проба обязана читать и код ДО правки. */
const WATCHER = `
window.__rfLog = [];
window.__rfT0 = 0;
window.__rfSnap = function () {
  var head = Array.prototype.find.call(document.querySelectorAll("span"), function (s) {
    return /^Accesos y pagos$/i.test((s.textContent || "").trim());
  });
  if (!head) return null;
  var section = head.closest("section");
  var top = section && section.firstElementChild;
  var badge = top ? Array.prototype.filter.call(top.querySelectorAll("span"), function (s) {
    return /rounded-full/.test(s.className);
  }).map(function (s) { return (s.textContent || "").trim(); }).join("|") : "";
  var box = head.parentElement;
  var rows = Array.prototype.map.call(box.querySelectorAll("div > div"), function (row) {
    var spans = row.querySelectorAll(":scope > span");
    return spans.length ? (spans[spans.length - 1].textContent || "").trim() : "";
  }).filter(Boolean);
  var updating = !!box.querySelector("[data-testid=payment-history-updating]");
  return { badge: badge, rows: rows, updating: updating };
};
window.__rfStartWatch = function () {
  window.__rfT0 = performance.now();
  var last = "";
  function tick() {
    var s = window.__rfSnap();
    var key = JSON.stringify(s);
    if (key !== last) { last = key; window.__rfLog.push({ t: Math.round(performance.now() - window.__rfT0), s: s }); }
    if (performance.now() - window.__rfT0 < 20000) requestAnimationFrame(tick);
  }
  tick();
};`;

interface Snap {
  badge: string;
  rows: string[];
  updating: boolean;
}

let delayedRefreshes = 0;

async function openProfile(page: Page, context: BrowserContext, withExpiredRow: boolean): Promise<void> {
  await loginWithoutSubscription(page);
  if (withExpiredRow) {
    const seeded = await page.context().request.post("/api/test/grant-subscription", {
      data: { expiredStore: true },
    });
    expect(seeded.ok(), "не удалось завести старую истёкшую строку магазина").toBe(true);
  }
  await context.addCookies(SHELL);
  await context.addInitScript({
    content: `${storeThatSells(3_000)}\n${GLOBAL_JS}\n${BRIDGE_JS}\n${PLUGIN_JS}\n${WATCHER}`,
  });
  // Перерисовка страницы на телефоне — не мгновенная: задержать ответы
  // перечитывания (RSC) на 1,5 с (на уровне контекста: на прод-сборке
  // запросы идут через воркер, и `page.route` их не видит), чтобы окно между «клиент узнал» и
  // «страница перерисована» было видно прибору, как на видео владельца.
  await context.route(
    (url) => url.pathname === "/es/profile",
    async (route) => {
      const headers = route.request().headers();
      if (headers["rsc"] || headers["next-router-state-tree"]) {
        delayedRefreshes += 1;
        await new Promise((r) => setTimeout(r, 1_500));
      }
      await route.continue();
    },
  );
  await page.goto("/es/profile?tab=subscription");
  await dismissWelcomeOverlay(page);
  await expect(page.getByTestId("native-purchase-option").first(), "вариантов покупки в кабинете нет").toBeVisible({
    timeout: 30_000,
  });
}

/** Отрезки, где шапка уже не серверная, а верх истории — «Expirada». */
function contradictions(log: { t: number; s: Snap | null }[]): { from: number; to: number; badge: string }[] {
  const out: { from: number; to: number; badge: string }[] = [];
  for (let i = 0; i < log.length; i += 1) {
    const s = log[i].s;
    if (!s) continue;
    const clientBadge = /Activa|Activando/.test(s.badge);
    if (clientBadge && !s.updating && s.rows[0] === "Expirada") {
      out.push({ from: log[i].t, to: log[i + 1]?.t ?? log[i].t, badge: s.badge });
    }
  }
  return out;
}

async function buyAndRecord(page: Page): Promise<{ t: number; s: Snap | null }[]> {
  await page.evaluate(() => (window as unknown as { __rfStartWatch: () => void }).__rfStartWatch());
  await page.getByTestId("native-purchase-option").first().click();
  await expect(page.getByTestId("subscription-badge"), "после «вебхука» шапка не стала серверной «Activa»").toHaveText(
    "Activa",
    { timeout: 30_000 },
  );
  // Дать перерисовке осесть и наблюдателю — записать последнее состояние.
  await page.waitForTimeout(1_000);
  return page.evaluate(() => (window as unknown as { __rfLog: { t: number; s: Snap | null }[] }).__rfLog);
}

test("359: старая истёкшая строка магазина — после покупки история ни на миг не «Expirada» рядом с «Activa»/«Activando…»", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(150_000);
  await openProfile(page, context, true);
  const before = await page.evaluate(() => (window as unknown as { __rfSnap: () => Snap | null }).__rfSnap());
  expect(before?.rows[0], "ОБРАТНЫЙ КОНТРОЛЬ: до покупки верхняя строка истории — старая «Expirada»").toBe("Expirada");

  delayedRefreshes = 0;
  const log = await buyAndRecord(page);
  // Окно воспроизводится задержкой перерисовки, а её перехват видит
  // запросы воркера только в Chromium (в WebKit `context.route` их не
  // получает). Там требование «задержка сработала» и проверяется; в WebKit
  // проба идёт с окном той длины, какое даёт движок.
  if (browserName === "chromium") {
    expect(delayedRefreshes, "перерисовка страницы не прошла через задержку — окно не воспроизведено").toBeGreaterThan(0);
  }
  const bad = contradictions(log);
  console.log(`359 журнал: ${JSON.stringify(log)}`);
  console.log(`359 противоречий: ${bad.length}; ${JSON.stringify(bad)}`);
  expect(bad, "шапка не серверная, а верхняя строка «Accesos y pagos» — «Expirada»: ровно долг 359").toEqual([]);

  expect(
    log.some((e) => e.s?.updating),
    "в окне между оплатой и перерисовкой история говорит «Actualizando…»",
  ).toBe(true);
  const last = log[log.length - 1]?.s;
  expect(last?.updating, "после перерисовки «Actualizando…» снято").toBe(false);
  expect(last?.rows[0], "после перерисовки верхняя строка истории — новая покупка, «Activa»").toBe("Activa");
  expect(last?.rows, "старая строка осталась в истории как была").toContain("Expirada");
});

test("359, контроль: новичок без истории (как первая настоящая покупка 13.10.2026) — «Expirada» нет вовсе", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await openProfile(page, context, false);
  const log = await buyAndRecord(page);
  console.log(`359 новичок журнал: ${JSON.stringify(log)}`);
  expect(log.some((e) => e.s?.rows.includes("Expirada"))).toBe(false);
  expect(log[log.length - 1]?.s?.rows[0]).toBe("Activa");
});
