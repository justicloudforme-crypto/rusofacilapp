import type { Page, Route } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";
import { waitPageInteractive } from "./helpers/page-interactive";

/**
 * ВИЗИТЫ ВЛАДЕЛЬЦА НЕ СЧИТАЮТСЯ В СТАТИСТИКЕ (заход 7.310).
 *
 * Что стережётся — три правила `src/lib/stats-opt-out.ts`, сквозь настоящие
 * компоненты `<Analytics>` / `<SpeedInsights>` из `src/components/SiteAnalytics.tsx`:
 *
 *   1. браузер без пометки шлёт просмотры и замеры скорости, как раньше;
 *   2. браузер с пометкой «не считать» не шлёт ничего ни с какой страницы;
 *   3. страницы админки не уходят НИКОГДА — и при снятой пометке тоже.
 *   Плюс: заход в админку ставит пометку сам, строка в шапке админки её
 *   показывает, кнопка снимает и ставит, снятую заход не перебивает.
 *
 * ПОЧЕМУ СКРИПТ VERCEL ПОДМЕНЁН. Настоящий `/_vercel/insights/script.js`
 * существует только на Vercel (на `next start` — 404), а его код (v1,
 * прочитан 25.11.2026) первой же строкой выходит, если
 * `navigator.webdriver` — то есть под Playwright он не отправил бы ничего и
 * без нашего фильтра, и «с пометкой не уходит» было бы зелёным на любом коде.
 * Поэтому на месте обоих скриптов — заглушка по их договору с компонентами:
 * разобрать очередь `vaq` / `siq`, запомнить `beforeSend`, на каждое событие
 * спросить его и при ответе `null` не слать. Отправка — настоящий `fetch`
 * на те же адреса (`/_vercel/insights/view`, `/_vercel/speed-insights/vitals`),
 * и считаются именно сетевые запросы, а не флажки на странице.
 *
 * Позитивный контроль в каждом тесте: на той же странице и тем же стендом
 * событие без пометки ДОХОДИТ — иначе «0 запросов» значило бы и «стенд
 * мёртв» (раздел 4.1).
 *
 * Воркер выключен (`serviceWorkers: "block"`): запросы страницы, прошедшие
 * через воркер, `page.route` не видит, а к аналитике воркер отношения не имеет.
 */

test.use({ serviceWorkers: "block" });

const KEY = "rf-stats-opt-out";

/** Договор `window.va` / `window.vaq` (компонент Vercel Analytics v2, режим
 *  disableAutoTrack: просмотры приходят вызовом `va("pageview", {route, path})`). */
const VA_STUB = `(() => {
  if (window.vai) return; window.vai = true;
  let before = null; let lastPath = null;
  window.__rfVaLog = window.__rfVaLog || [];
  function send(type) {
    const url = lastPath ? new URL(lastPath, location.origin).href : location.href;
    const ev = { type, url };
    const out = before ? before(ev) : ev;
    const sent = !(out === null || out === false);
    window.__rfVaLog.push({ type, url, sent });
    if (!sent) return;
    fetch(type === "pageview" ? "/_vercel/insights/view" : "/_vercel/insights/event", {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ o: out.url }),
    }).catch(() => {});
  }
  window.va = function (name, props) {
    if (name === "beforeSend") { before = props; return; }
    if (name === "pageview") { if (props && props.path) lastPath = props.path; send("pageview"); return; }
    if (name === "event") send("event");
  };
  (window.vaq || []).forEach(([n, p]) => window.va(n, p));
})();`;

/** Договор `window.si` / `window.siq` (Speed Insights v2). Замер скорости
 *  настоящий скрипт шлёт сам по событиям страницы; здесь — по вызову теста. */
const SI_STUB = `(() => {
  if (window.sil) return; window.sil = true;
  let before = null;
  window.si = function (name, fn) { if (name === "beforeSend") before = fn; };
  (window.siq || []).forEach(([n, f]) => window.si(n, f));
  window.__rfSiSend = function () {
    const ev = { type: "vital", url: location.href };
    const out = before ? before(ev) : ev;
    if (!out) return false;
    fetch("/_vercel/speed-insights/vitals", { method: "POST", keepalive: true, body: JSON.stringify({ u: out.url }) }).catch(() => {});
    return true;
  };
})();`;

type Bench = { views: string[]; vitals: string[] };

async function bench(page: Page): Promise<Bench> {
  const b: Bench = { views: [], vitals: [] };
  const js = (body: string) => (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body });
  await page.route("**/_vercel/insights/script.js", js(VA_STUB));
  await page.route("**/_vercel/speed-insights/script.js", js(SI_STUB));
  await page.route("**/_vercel/insights/view", (route) => {
    b.views.push(new URL(JSON.parse(route.request().postData() ?? "{}").o).pathname);
    return route.fulfill({ status: 200, body: "ok" });
  });
  await page.route("**/_vercel/speed-insights/vitals", (route) => {
    b.vitals.push(new URL(JSON.parse(route.request().postData() ?? "{}").u).pathname);
    return route.fulfill({ status: 200, body: "ok" });
  });
  return b;
}

/** Открыть адрес и дождаться, пока заглушка РЕШИТ судьбу просмотра этого
 *  адреса (отправить или нет). Возвращает решение. */
async function visit(page: Page, path: string): Promise<boolean> {
  await page.goto(path);
  await waitPageInteractive(page, 30_000);
  return decision(page, path);
}

async function decision(page: Page, path: string): Promise<boolean> {
  const handle = await page.waitForFunction(
    (p) => {
      const log = (window as unknown as { __rfVaLog?: { type: string; url: string; sent: boolean }[] }).__rfVaLog ?? [];
      const hit = log.filter((e) => e.type === "pageview" && new URL(e.url).pathname === p).at(-1);
      return hit ? { sent: hit.sent } : null;
    },
    path,
    { timeout: 15_000 },
  );
  return ((await handle.jsonValue()) as { sent: boolean }).sent;
}

const siSend = (page: Page) => page.evaluate(() => (window as unknown as { __rfSiSend: () => boolean }).__rfSiSend());

test("без пометки просмотры и замеры уходят, с пометкой — ни один", async ({ page }) => {
  const b = await bench(page);

  // Контроль: обычный посетитель.
  expect(await visit(page, "/es")).toBe(true);
  await expect.poll(() => b.views).toContain("/es");
  expect(await siSend(page)).toBe(true);
  await expect.poll(() => b.vitals).toContain("/es");

  // Пометка «не считать» — те же страницы молчат.
  await page.evaluate((k) => localStorage.setItem(k, "1"), KEY);
  expect(await visit(page, "/ru")).toBe(false);
  expect(await visit(page, "/es/pricing")).toBe(false);
  expect(await siSend(page)).toBe(false);

  // Обратный контроль на той же вкладке: сняли — снова уходит.
  await page.evaluate((k) => localStorage.setItem(k, "0"), KEY);
  expect(await visit(page, "/es/glossary")).toBe(true);
  await expect.poll(() => b.views).toContain("/es/glossary");

  expect(b.views.filter((p) => p === "/ru" || p === "/es/pricing")).toEqual([]);
  expect(b.vitals).toEqual(["/es"]);
});

test("админка: пометка ставится сама, страницы админки не уходят никогда, кнопка меняет пометку", async ({ page }) => {
  const b = await bench(page);
  await loginWithoutSubscription(page);
  const granted = await page.context().request.post("/api/test/grant-staff");
  expect(granted.status(), "тестовая учётка не стала администратором").toBe(200);

  // Контроль: до админки этот браузер считается.
  expect(await visit(page, "/es")).toBe(true);

  // Первый заход в админку — пометка ставится сама, строка это говорит.
  expect(await visit(page, "/es/admin/search-demand")).toBe(false);
  const banner = page.getByTestId("stats-opt-out");
  await expect(banner).toHaveAttribute("data-mark", "excluded");
  await expect(banner).toContainText("no cuentan");
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("1");

  // Кнопка снимает пометку — и даже тогда страница админки не уходит.
  await banner.getByRole("button").click();
  await expect(banner).toHaveAttribute("data-mark", "counted");
  await expect(banner).toContainText("cuentan");
  await page.locator('nav a[href="/es/admin/lessons"]').click();
  await page.waitForURL("**/es/admin/lessons");
  expect(await decision(page, "/es/admin/lessons")).toBe(false);
  expect(await siSend(page)).toBe(false);

  // Снятая вручную пометка: обычные страницы считаются, повторный заход в
  // админку её не перебивает.
  expect(await visit(page, "/ru")).toBe(true);
  expect(await visit(page, "/ru/admin/search-demand")).toBe(false);
  await expect(page.getByTestId("stats-opt-out")).toHaveAttribute("data-mark", "counted");
  await expect(page.getByTestId("stats-opt-out")).toContainText("считаются");

  // Кнопка ставит пометку обратно — обычные страницы снова молчат.
  await page.getByTestId("stats-opt-out").getByRole("button").click();
  await expect(page.getByTestId("stats-opt-out")).toHaveAttribute("data-mark", "excluded");
  await expect(page.getByTestId("stats-opt-out")).toContainText("не считаются");
  expect(await visit(page, "/es/pricing")).toBe(false);

  // Ни одного просмотра админки в сети за весь тест.
  expect(b.views.filter((p) => p.includes("/admin"))).toEqual([]);
  expect(b.vitals.filter((p) => p.includes("/admin"))).toEqual([]);
  expect(b.views).toEqual(["/es", "/ru"]);
});
