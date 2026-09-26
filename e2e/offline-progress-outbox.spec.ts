import { test, expect } from "./helpers/test";
import type { BrowserContext, Page } from "@playwright/test";
import { fillAllExercises } from "./helpers/exercises";

/**
 * ОЧЕРЕДЬ ОТВЕТОВ БЕЗ СЕТИ — ЗАХОД 7.236 (ОФЛАЙН-3б).
 *
 * Что было до правки — прогоном на сборке main f6d1261 (PROGRESS.md
 * 7.236, часть 1): ответ «Comprobar» без сети лёг в localStorage без
 * ключа, без владельца и без времени; повтор после потерянного ответа
 * сервер обработал ВТОРОЙ раз; попытка A после выхода и входа B легла под
 * B; при возврате сети страница перезагружалась (Serwist
 * `reloadOnOnline`), и введённые, но не проверенные ответы пропадали.
 *
 * Здесь каждое обещание проверяется ЧИСЛАМИ СЕРВЕРА
 * (`/api/test/progress-ledger`: попытка, дни занятия, квитанции), а не
 * только экраном. Базу проба не открывает (правило 7.148).
 *
 * Урок A1/1 бесплатный — подписка аккаунтам не нужна.
 */

const LESSON = "/es/courses/a1/1";
const PASSWORD = "TestPass123!";

interface Ledger {
  attempt: { score: number; passed: boolean; completedAt: string } | null;
  studyDays: { dateKey: string; source: string }[];
  receipts: number;
}

async function register(context: BrowserContext): Promise<string> {
  const email = `e2e-outbox-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await context.request.post("/api/auth/register", {
    form: { email, password: PASSWORD, lang: "es", redirectTo: "/es" },
  });
  expect(
    new URL(res.url()).searchParams.get("error"),
    "регистрация отказала",
  ).toBeNull();
  return email;
}

async function signIn(context: BrowserContext, email: string) {
  const res = await context.request.post("/api/auth/login", {
    form: { email, password: PASSWORD, lang: "es", redirectTo: "/es/profile" },
  });
  expect(
    new URL(res.url()).searchParams.get("error"),
    "вход отказал",
  ).toBeNull();
}

async function ledger(context: BrowserContext): Promise<Ledger> {
  const res = await context.request.get(
    "/api/test/progress-ledger?level=a1&lesson=1",
  );
  expect(res.status()).toBe(200);
  return (await res.json()) as Ledger;
}

const outboxCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("rf-progress-outbox");
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("outbox")) return resolve(0);
          const req = db.transaction("outbox").objectStore("outbox").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(-1);
        };
        open.onerror = () => resolve(-1);
      }),
  );

async function openExercises(page: Page, pick: "first" | "last" = "first") {
  await page.goto(LESSON);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  const retry = page.getByRole("button", { name: "Volver a intentar" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await fillAllExercises(page, pick);
}

/** «18/25 (72%)» на экране итога — процент числом. */
async function screenPercent(page: Page): Promise<number | null> {
  const text = await page.locator('[data-offline-panel="exercises"]').innerText();
  const m = /\d+\s*\/\s*\d+\s*\((\d+)\s*%\)/.exec(text);
  return m ? Number(m[1]) : null;
}

async function checkAnswers(page: Page) {
  await page.getByRole("button", { name: "Comprobar" }).click();
  // Модалка итога закрывает кнопку «Volver a intentar». В WebKit она
  // успевает смениться, пока в неё целятся («element was detached») —
  // поэтому нажатие без ожидания до потолка, а итог утверждается отдельно.
  const close = page.getByRole("button", { name: "Continuar" });
  await close.click({ timeout: 3000 }).catch(() => {});
  await expect(close).toHaveCount(0, { timeout: 5000 });
}

test.describe("очередь ответов урока без сети (7.236)", () => {
  test("сеть вернулась, пока открыта страница: не перезагружается, пометка исчезает, ответы на экране целы", async ({
    page,
    context,
  }) => {
    await register(context);
    await openExercises(page);
    await context.setOffline(true);
    await checkAnswers(page);
    await expect(page.locator("[data-rf-outbox-note]")).toBeVisible();

    let loads = 0;
    page.on("load", () => (loads += 1));
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.locator("[data-rf-outbox-note]")).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(
      loads,
      "страница перезагрузилась по `online` — Serwist reloadOnOnline снова включён",
    ).toBe(0);
    await expect(
      page.getByRole("button", { name: "Volver a intentar" }),
    ).toBeVisible();
    expect((await ledger(context)).receipts).toBe(1);
  });

  test("ответы введены без сети, сеть вернулась ДО «Comprobar» — ничего не потеряно", async ({
    page,
    context,
  }) => {
    await register(context);
    await page.goto(LESSON);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Ejercicios/ }).click();
    await context.setOffline(true);
    await fillAllExercises(page);
    const check = page.getByRole("button", { name: "Comprobar" });
    await expect(check).toBeEnabled();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(2000);
    await expect(page.getByRole("tab", { name: /Ejercicios/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      check,
      "ответы пропали — страница перезагрузилась при возврате сети",
    ).toBeEnabled();
  });

  test.describe("без воркера", () => {
    // Воркер заблокирован только здесь: `/api/progress` идёт через его
    // маршрут NetworkOnly (sw.ts, 7.236), а запросы воркера `page.route`
    // не видит — обрыв было бы нечем изобразить. Суть проверки (ключ и
    // квитанция на сервере) от воркера не зависит.
    test.use({ serviceWorkers: "block" });
    test("два ответа, сеть рвётся посреди отправки: сервер принял каждый ровно раз, дней — один", async ({
      page,
      context,
    }) => {
      await register(context);
      await openExercises(page);
      // Фаза 1: сети для ответов нет — обе проверки ложатся в очередь.
      await page.route("**/api/progress", (route) =>
        route.request().method() === "POST"
          ? route.abort("internetdisconnected")
          : route.continue(),
      );
      await checkAnswers(page);
      await page.getByRole("button", { name: "Volver a intentar" }).click();
      await fillAllExercises(page);
      await checkAnswers(page);
      await expect.poll(() => outboxCount(page)).toBe(2);
      await page.unroute("**/api/progress");

      // Фаза 2: первая отправка ДОХОДИТ до сервера, а ответ до браузера —
      // нет: ровно тот случай, в котором до правки сервер писал попытку дважды.
      const keys: string[] = [];
      let cut = true;
      await page.route("**/api/progress", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        keys.push(JSON.parse(route.request().postData() ?? "{}").key);
        const response = await route.fetch();
        if (cut) {
          cut = false;
          return route.abort("connectionreset");
        }
        return route.fulfill({ response });
      });
      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect.poll(() => outboxCount(page), { timeout: 20_000 }).toBe(0);

      // Позитивный контроль в том же тесте: обрыв действительно случился и
      // первый ключ действительно ушёл на сервер ДВАЖДЫ.
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys.filter((k) => k === keys[0]).length).toBe(2);
      const after = await ledger(context);
      expect(after.receipts, "каждый ключ принят ровно один раз").toBe(2);
      expect(after.studyDays).toHaveLength(1);
    });
  });

  test("правило владельца: выход A с неотправленным → вход B → у B пусто, запись A ждёт; A вернулся — ушла под A", async ({
    page,
    context,
  }) => {
    const a = await register(context);
    await openExercises(page);
    await context.setOffline(true);
    await checkAnswers(page);
    expect(await outboxCount(page)).toBe(1);
    await page.goto("about:blank").catch(() => {});
    await context.setOffline(false);
    await context.clearCookies();

    await register(context); // B
    await page.goto(LESSON);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Ejercicios/ }).click();
    await page.waitForTimeout(4000);
    const underB = await ledger(context);
    expect(underB, "попытка A ушла под B").toMatchObject({
      attempt: null,
      receipts: 0,
    });
    expect(
      await outboxCount(page),
      "запись A стёрта, а не сохранена до его входа",
    ).toBe(1);

    // Сервер тоже держит правило: чужая запись с чужим владельцем — 409.
    const forged = await context.request.post("/api/progress", {
      data: {
        level: "a1",
        lesson: "1",
        score: 1,
        passed: false,
        key: "forged-key-7236-000000",
        at: Date.now(),
        owner: "someone-else",
      },
    });
    expect(forged.status()).toBe(409);

    await context.clearCookies();
    await signIn(context, a);
    await page.goto("/es");
    await expect.poll(() => outboxCount(page), { timeout: 15_000 }).toBe(0);
    const underA = await ledger(context);
    expect(underA.receipts).toBe(1);
    expect(underA.attempt).not.toBeNull();
  });

  test("день занятия — по времени ответа, а не отправки", async ({
    page,
    context,
  }) => {
    await register(context);
    await openExercises(page);
    const today = (await ledger(context)).studyDays.length;
    expect(today).toBe(0);
    // Ответ «позавчера»: часы страницы на 48 ч назад.
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    await page.clock.setFixedTime(twoDaysAgo);
    await context.setOffline(true);
    await checkAnswers(page);
    // Отправка — уже «сегодня»: часы страницы возвращаются к настоящим.
    await page.clock.setFixedTime(Date.now());
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect
      .poll(async () => (await ledger(context)).receipts, { timeout: 20_000 })
      .toBe(1);
    const days = (await ledger(context)).studyDays.map((d) => d.dateKey);
    const zone = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    const key = (ms: number, tz: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(ms));
    const expected = new Set([key(twoDaysAgo, zone), key(twoDaysAgo, "UTC")]);
    expect(days).toHaveLength(1);
    expect(
      expected.has(days[0]),
      `день ${days[0]}, а ответ был ${[...expected].join(" / ")}`,
    ).toBe(true);
  });

  test.describe("«intento anterior» — последняя попытка (7.237)", () => {
    // Воркер заблокирован: отправку очереди нужно ЗАДЕРЖАТЬ, а запросы
    // воркера `page.route` не видит (см. describe выше).
    test.use({ serviceWorkers: "block" });
    test("ответ без сети ушёл позже, чем открылась вкладка: на экране он, а не прошлая попытка сервера", async ({
      page,
      context,
    }) => {
      await register(context);
      // Попытка 1 — с сетью (у владельца 18/25).
      await openExercises(page, "first");
      await checkAnswers(page);
      const first = await screenPercent(page);
      await expect.poll(async () => (await ledger(context)).attempt?.score ?? null, { timeout: 15_000 }).toBe(first);

      // Попытка 2 — без сети, другими ответами (у владельца 20/25).
      await context.setOffline(true);
      await page.getByRole("button", { name: "Volver a intentar" }).click();
      await fillAllExercises(page, "last");
      await checkAnswers(page);
      const second = await screenPercent(page);
      await expect(page.locator("[data-rf-outbox-note]")).toBeVisible();
      // ПОЗИТИВНЫЙ КОНТРОЛЬ: попытки различимы, иначе проба ничего не мерит.
      expect(first, "две попытки дали один и тот же балл — пробе нечем различить старую и новую").not.toBe(second);

      // Сеть вернулась, но первая отправка очереди идёт медленно (у владельца
      // — сеть ещё не готова, следующая попытка через 20 с).
      let posts = 0;
      await page.route("**/api/progress", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        posts += 1;
        await new Promise((r) => setTimeout(r, 4000));
        return route.continue();
      });
      await context.setOffline(false);
      await page.goto(LESSON);
      await page.getByRole("tab", { name: /Ejercicios/ }).click();
      await expect(page.getByText("Este es tu intento anterior")).toBeVisible({ timeout: 15_000 });
      expect(
        await screenPercent(page),
        `«intento anterior» показывает ${first}% — прошлую попытку сервера, а последняя (${second}%) ещё в очереди`,
      ).toBe(second);

      // Очередь дошла: на сервере последняя, по квитанции на попытку, день один.
      await expect.poll(async () => (await ledger(context)).attempt?.score ?? null, { timeout: 20_000 }).toBe(second);
      const final = await ledger(context);
      expect(final.receipts).toBe(2);
      expect(final.studyDays).toHaveLength(1);
      expect(posts, "очередь не отправлялась — задержка не изображена").toBeGreaterThan(0);
      expect(await screenPercent(page)).toBe(second);
      expect(await outboxCount(page)).toBe(0);
    });
  });
});
