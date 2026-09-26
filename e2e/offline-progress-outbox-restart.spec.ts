/**
 * «УБИТЬ ПРИЛОЖЕНИЕ» И ЗАПУСТИТЬ С СЕТЬЮ — заход 7.236, отдельным файлом.
 *
 * Отдельно от e2e/offline-progress-outbox.spec.ts только ради исключения
 * из проекта `mobile-iphone` (playwright.config.ts, testIgnore): в WebKit
 * Playwright переход НОВОЙ страницы после `setOffline(false)` падает в
 * самом воркере стенда («FetchEvent.respondWith received an error:
 * TypeError: Load failed») — 3 прогона из 3, и с повтором перехода тоже.
 * Тот же дефект стенда, из-за которого там исключены соседние офлайн-пробы.
 * Остальные пять тестов очереди идут в WebKit.
 */
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

async function openExercises(page: Page) {
  await page.goto(LESSON);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  const retry = page.getByRole("button", { name: "Volver a intentar" });
  if (await retry.isVisible().catch(() => false)) await retry.click();
  await fillAllExercises(page);
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

test.describe("очередь ответов урока без сети (7.236) — перезапуск", () => {
  test("ответ без сети → пометка → закрыть всё → открыть с сетью: одна запись, один день, пометка ушла", async ({
    page,
    context,
  }) => {
    await register(context);
    await openExercises(page);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ прибора: до ответа на сервере пусто — иначе
    // «одна запись» ниже ничего бы не доказывала.
    expect(await ledger(context)).toMatchObject({
      attempt: null,
      receipts: 0,
      studyDays: [],
    });

    await context.setOffline(true);
    await checkAnswers(page);
    await expect(page.locator("[data-rf-outbox-note]")).toHaveText(
      "Guardado, se enviará al volver la conexión",
    );
    expect(await outboxCount(page)).toBe(1);

    // «Убить приложение»: закрыть страницу. IndexedDB — хранилище
    // контекста, оно страницу переживает (как и убийство процесса на
    // Android — прогон эмулятора 7.236).
    await page.close();
    const again = await context.newPage();
    await context.setOffline(false);
    await again.goto("/es");
    // Отправка идёт с ЛЮБОЙ страницы (ProgressOutboxSync), не только из урока.
    await expect.poll(() => outboxCount(again), { timeout: 15_000 }).toBe(0);
    const after = await ledger(context);
    expect(after.receipts).toBe(1);
    expect(after.attempt).not.toBeNull();
    expect(after.studyDays).toHaveLength(1);
    expect(after.studyDays[0].source).toBe("lesson");

    await again.goto(LESSON);
    await again.getByRole("tab", { name: /Ejercicios/ }).click();
    await expect(again.locator("[data-rf-outbox-note]")).toHaveCount(0);
  });
});
