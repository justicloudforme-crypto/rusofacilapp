import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * ПРОСМОТРЕННОЕ ПЕРЕЖИВАЕТ ДВА ВЫКАТА ПОДРЯД — ЗАХОД 7.301, ДОЛГ 308.
 *
 * ====================================================================
 * ЧТО БЫЛО СЛОМАНО
 * ====================================================================
 *
 * Сохранённая копия урока лежит в кеше с отпечатком сборки
 * (`rf-pages-content-<отпечаток>`, долг 14). С 7.237 активация воркера
 * нового выката оставляла копии ровно ОДНОГО предыдущего поколения
 * (метка поколения) и стирала всё, что старше. Человек сохранил урок →
 * выкат → открыл приложение с сетью, но не этот урок → ещё выкат → без
 * сети на месте урока каркас «эта страница не сохранилась».
 *
 * ====================================================================
 * КАК ВЫКАТ ИЗОБРАЖАЕТСЯ ЗДЕСЬ — И ПОЧЕМУ ЭТО ЧЕСТНО
 * ====================================================================
 *
 * Отпечаток сборки воркер считает из своего precache-манифеста
 * (`buildFingerprint`). Новая сборка = другой манифест. Здесь браузеру
 * отдаётся ТОТ ЖЕ собранный `public/sw.js`, в котором у одной записи
 * манифеста изменена ревизия: отпечаток другой, байты файла другие, и
 * браузер сам ставит и активирует новый воркер — со всем НАСТОЯЩИМ кодом
 * активации. Руками в кешах проба ничего не трогает.
 *
 * ПОЧЕМУ ПОСРЕДНИК, А НЕ `context.route`. Замер 7.301: проверку
 * обновления воркера (`registration.update()` и сама навигация) браузер
 * делает мимо перехвата Playwright — перехват видит только ПЕРВУЮ
 * регистрацию, и подменённый `sw.js` до браузера не доходил (новый воркер
 * не ставился ни разу). Поэтому проба ходит через свой маленький
 * посредник: всё, кроме `/sw.js`, он передаёт серверу e2e как есть, а
 * `/sw.js` отдаёт «сборкой номер N» — для браузера это обычный выкат.
 *
 * Без сети — та же оболочка, что у `offline-saved-content.spec.ts`:
 * регистрация воркера снимается, на документ отвечает каркас
 * `public/offline.html` по исходному адресу (так делает
 * `OfflineShellWebViewClient` в приложении).
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ТЕСТЕ: после ПЕРВОГО выката копия обязана
 * лежать (это поведение 7.237) — иначе стенд не изображает выкат вовсе,
 * и зелёный итог ничего бы не значил. На коде до 7.301 тест краснеет на
 * последнем шаге: после второго выката копии нет ни в одном кеше.
 */

const SHELL_HTML = readFileSync("public/offline.html", "utf8");
const LESSON = "/ru/courses/a1/2";

/** Посредник перед сервером e2e: `/sw.js` — «сборка номер N», прочее — как есть. */
const UPSTREAM_PORT = 3100;
const PROXY_PORT = 3197;
let proxy: Server | null = null;
let deployNo = 0;
let realWorker = "";

test.use({ baseURL: `http://localhost:${PROXY_PORT}` });

test.beforeAll(async () => {
  realWorker = readFileSync("public/sw.js", "utf8");
  proxy = createServer((req, res) => {
    if ((req.url ?? "").split("?")[0] === "/sw.js") {
      res.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" });
      res.end(deployedWorker(realWorker, deployNo));
      return;
    }
    const upstream = httpRequest(
      { host: "127.0.0.1", port: UPSTREAM_PORT, method: req.method, path: req.url, headers: req.headers },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve, reject) => {
    proxy!.once("error", reject);
    proxy!.listen(PROXY_PORT, "127.0.0.1", () => resolve());
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (proxy ? proxy.close(() => resolve()) : resolve()));
});

/** «Сборка номер N»: тот же воркер, другая ревизия одной записи манифеста. */
function deployedWorker(real: string, deploy: number): string {
  if (deploy === 0) return real;
  const marker = "{'revision':'";
  const at = real.indexOf(marker);
  if (at < 0) throw new Error("в public/sw.js не найден манифест вида {'revision':'…'} — изображать выкат нечем");
  return real.slice(0, at + marker.length) + `rfdeploy${deploy}` + real.slice(at + marker.length);
}

/** Отпечаток АКТИВНОГО воркера — его собственный ответ, не догадка. */
async function activeFingerprint(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active;
    if (!worker || worker.state !== "activated") return null;
    return new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve((event.data as { fingerprint?: string }).fingerprint ?? null);
      };
      worker.postMessage({ type: "rf-cache-names" }, [channel.port2]);
    });
  });
}

/** Выкат: браузер находит новый `sw.js`, ставит и активирует его. */
async function deploy(page: Page, before: string): Promise<string> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  let now: string | null = null;
  await expect
    .poll(
      async () => {
        now = await activeFingerprint(page);
        return now !== null && now !== before;
      },
      { timeout: 60_000, message: "новый воркер так и не активировался — выкат не изображён" },
    )
    .toBe(true);
  return now!;
}

/** Где на телефоне лежит копия адреса: имена кешей содержания. */
async function copiesOf(page: Page, path: string): Promise<string[]> {
  return page.evaluate(async (want) => {
    const out: string[] = [];
    for (const name of await caches.keys()) {
      if (!/^rf-pages-(?:content|section)-[a-z0-9]+$/.test(name)) continue;
      if (!(await caches.has(name))) continue;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((k) => new URL(k.url).pathname === want)) out.push(name);
    }
    return out;
  }, path);
}

async function becomeNativeShell(page: Page, context: BrowserContext): Promise<void> {
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: SHELL_HTML });
  });
  await context.setOffline(true);
}

/** Переход без сети — с повтором ПОДГОТОВКИ (замер 7.227: первый
 *  `goto` после `setOffline` может отмениться самой страницей). */
async function visit(page: Page, path: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.waitForTimeout(attempt === 1 ? 1200 : 400);
    const arrived = await page
      .goto(path, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (arrived) return;
  }
}

test("сохранённый урок открывается без сети после двух выкатов подряд (долг 308)", async ({ page, context }) => {
  // Бюджет числом: установка воркера, урок с сетью, два выката по ≤60 с,
  // переход без сети с повтором.
  test.setTimeout(240_000);

  deployNo = 0;
  await loginWithSubscription(page);
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  // Активация — асинхронная работа; отпечаток спрашивается, когда
  // воркер ДОШЁЛ до «activated», а не в первый миг управления страницей.
  let fp0: string | null = null;
  await expect
    .poll(async () => (fp0 = await activeFingerprint(page)), { timeout: 30_000, message: "воркер не ответил своим отпечатком" })
    .toBeTruthy();

  // 1. ЧЕЛОВЕК ОТКРЫЛ УРОК С СЕТЬЮ — копия легла.
  await page.goto(LESSON);
  const lessonHeading = (await page.locator("h1").first().textContent())?.trim() ?? "";
  expect(lessonHeading.length, "урок не отрисовался — сохранять нечего").toBeGreaterThan(0);
  await expect
    .poll(() => copiesOf(page, LESSON), { timeout: 20_000, message: "копия урока так и не легла в кеш содержания" })
    .toEqual([`rf-pages-content-${fp0}`]);

  // 2. ВЫКАТ 1, человек открывает приложение с сетью — но не урок.
  deployNo = 1;
  const fp1 = await deploy(page, fp0!);
  await page.goto("/ru");
  await page.waitForTimeout(800);
  // Позитивный контроль: один выкат копия переживает (7.237).
  expect(await copiesOf(page, LESSON), "КОНТРОЛЬ: копия не пережила даже ОДНОГО выката — стенд не тот").toEqual([
    `rf-pages-content-${fp0}`,
  ]);

  // 3. ВЫКАТ 2, снова только главная.
  deployNo = 2;
  const fp2 = await deploy(page, fp1);
  await page.goto("/ru");
  await page.waitForTimeout(800);
  expect(new Set([fp0, fp1, fp2]).size, "отпечатки трёх «сборок» обязаны различаться").toBe(3);
  const after = await copiesOf(page, LESSON);
  expect(after, `после второго выката копии урока нет ни в одном кеше — ровно долг 308 (кеши: ${after.join(", ") || "—"})`).toEqual([
    `rf-pages-content-${fp0}`,
  ]);

  // 4. ТЕЛЕФОН БЕЗ СЕТИ — урок открывается копией, со стилями.
  await becomeNativeShell(page, context);
  await visit(page, LESSON);
  await page
    .waitForFunction(() => document.body?.dataset.offlineCopy === "1", null, { timeout: 25_000 })
    .catch(() => {});
  const surface = await page.evaluate(() => ({
    copy: document.body?.dataset.offlineCopy === "1",
    shell: document.body?.dataset.offlineShell === "1",
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    styles: document.head.querySelectorAll("style").length,
  }));
  expect(surface.copy, "без сети на месте урока каркас — долг 308").toBe(true);
  expect(surface.shell).toBe(false);
  expect(surface.heading, "открылась не та копия").toBe(lessonHeading);
  expect(surface.styles, "копия без своих листов стилей").toBeGreaterThan(0);
});
