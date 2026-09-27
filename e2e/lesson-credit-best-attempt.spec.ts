import { test, expect } from "./helpers/test";
import type { BrowserContext, Page } from "@playwright/test";
import { fillAllExercises } from "./helpers/exercises";

/**
 * ЗАЧЁТ УРОКА ДЕРЖИТСЯ ПО ЛУЧШЕЙ ПОПЫТКЕ — ЗАХОД 7.238 (задача А1).
 *
 * Находка владельца (POCO, аккаунт Vasya, урок /es A1/1): урок сдан
 * 20/25 (80 %), на странице уровня галочка. «Volver a intentar» → 8/25
 * (32 %) — и галочка сменилась цифрой «1», «Siguiente lección» серая,
 * под итогом «Completa los ejercicios con al menos 70%…». Причина — одна
 * строка `LessonProgress` на урок, и КАЖДАЯ попытка перезаписывала в ней
 * `passed`. Так было с первого коммита (PROGRESS.md 7.238, часть 2 —
 * прогон этой пробы на сборке до 7.236).
 *
 * Правило: зачёт (галочка, следующий урок, «Ya aprobaste») ставится
 * удачной попыткой и неудачной не снимается; экран упражнений показывает
 * ПОСЛЕДНЮЮ попытку. То же — для ответа из очереди без сети. И время
 * попытки — время ответа, а не приёма: иначе ответ позавчерашний
 * добавлял в календарь «сегодня».
 *
 * Сданная попытка кладётся прямо запросом (правильные ответы урока проба
 * не знает); это и есть случай владельца: «1» в localStorage телефона
 * при этом не пишется, зачёт знает только сервер. Базу проба не открывает
 * (правило 7.148) — числа сервера из `/api/test/progress-ledger`, и
 * только с сетью (7.237: без сети учётная книга врёт).
 */

const LESSON = "/es/courses/a1/1";
const LEVEL = "/es/courses/a1";
const PASSWORD = "TestPass123!";
const UNLOCK_HINT = "Completa los ejercicios con al menos 70%";

interface Ledger {
  attempt: { score: number; passed: boolean; completedAt: string } | null;
  studyDays: { dateKey: string; source: string }[];
  activityDays?: string[];
  receipts: number;
}

async function register(context: BrowserContext): Promise<void> {
  const email = `e2e-credit-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await context.request.post("/api/auth/register", {
    form: { email, password: PASSWORD, lang: "es", redirectTo: "/es" },
  });
  expect(new URL(res.url()).searchParams.get("error"), "регистрация отказала").toBeNull();
}

async function ledger(context: BrowserContext): Promise<Ledger> {
  const res = await context.request.get("/api/test/progress-ledger?level=a1&lesson=1");
  expect(res.status()).toBe(200);
  return (await res.json()) as Ledger;
}

/** Сданная попытка 80 % — как у владельца 20/25. */
async function passByRequest(context: BrowserContext, extra: Record<string, unknown> = {}) {
  const res = await context.request.post("/api/progress", {
    data: { level: "a1", lesson: "1", score: 80, passed: true, mistakes: [], answers: {}, ...extra },
  });
  expect(res.status()).toBe(200);
}

async function screenPercent(page: Page): Promise<number | null> {
  const text = await page.locator('[data-offline-panel="exercises"]').innerText();
  const m = /\d+\s*\/\s*\d+\s*\((\d+)\s*%\)/.exec(text);
  return m ? Number(m[1]) : null;
}

async function checkAnswers(page: Page) {
  await page.getByRole("button", { name: "Comprobar" }).click();
  const close = page.getByRole("button", { name: "Continuar" });
  await close.click({ timeout: 3000 }).catch(() => {});
  await expect(close).toHaveCount(0, { timeout: 5000 });
}

/** Неудачная повторная попытка через экран: «Volver a intentar» → первые варианты → «Comprobar». */
async function failRetry(page: Page, beforeAnswers?: () => Promise<void>): Promise<number> {
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await page.getByRole("button", { name: "Volver a intentar" }).click({ timeout: 15_000 });
  // Сеть рвётся ПОСЛЕ того, как вкладка восстановила сданную попытку
  // (без сети восстанавливать нечем: GET `/api/progress` — NetworkOnly).
  if (beforeAnswers) await beforeAnswers();
  await fillAllExercises(page, "first");
  await checkAnswers(page);
  const pct = await screenPercent(page);
  // ПОЗИТИВНЫЙ КОНТРОЛЬ: попытка действительно несданная, иначе проба
  // ничего не мерит.
  expect(pct, "повторная попытка не распознана на экране").not.toBeNull();
  expect(pct as number, "повторная попытка сдана — пробе нечего проверять").toBeLessThan(70);
  return pct as number;
}

/** Зачёт на месте: в уроке — последняя попытка, но следующий урок открыт; на уровне — галочка. */
async function expectCreditKept(page: Page, context: BrowserContext, lastPct: number) {
  await page.goto(LESSON);
  await page.getByRole("tab", { name: /Ejercicios/ }).click();
  await expect(page.getByText("Este es tu intento anterior")).toBeVisible({ timeout: 15_000 });
  expect(await screenPercent(page), "экран упражнений показывает не последнюю попытку").toBe(lastPct);
  await expect(page.getByText(UNLOCK_HINT), "под итогом снова «Completa… 70%» — зачёт снят неудачной попыткой").toHaveCount(0);
  await expect(page.getByRole("link", { name: /Siguiente lección/ }), "«Siguiente lección» серая").toBeVisible();
  await page.goto(LEVEL);
  await expect(page.locator('[aria-label="Lección aprobada"]').first(), "на странице уровня нет галочки урока 1").toBeVisible();
  await expect(page.locator('[aria-label="Intentada, todavía no aprobada"]')).toHaveCount(0);
  const after = await ledger(context);
  expect(after.attempt?.passed, "сервер снял зачёт").toBe(true);
  expect(after.attempt?.score, "сервер хранит не последнюю попытку").toBe(lastPct);
}

test.describe("зачёт урока держится по лучшей попытке (7.238, А1)", () => {
  test("с сетью: сдан 80 %, повторная неудачная — галочка и следующий урок на месте", async ({ page, context }) => {
    // Ожидания: 15 + 3 + 5 + 15 + ожидания видимости по умолчанию (6 × 5) — 68 с.
    test.setTimeout(120_000);
    await register(context);
    // Позитивный контроль селекторов: несданная попытка видна на уровне как
    // «Intentada…», сданная — как «Lección aprobada».
    await passByRequest(context, { score: 20, passed: false });
    await page.goto(LEVEL);
    await expect(page.locator('[aria-label="Intentada, todavía no aprobada"]').first()).toBeVisible();
    await passByRequest(context);
    await page.goto(LEVEL);
    await expect(page.locator('[aria-label="Lección aprobada"]').first()).toBeVisible();

    await page.goto(LESSON);
    const pct = await failRetry(page);
    await expect.poll(async () => (await ledger(context)).attempt?.score ?? null, { timeout: 15_000 }).toBe(pct);
    await expectCreditKept(page, context, pct);
  });

  test("из очереди без сети: неудачная повторная дошла позже — зачёт на месте", async ({ page, context }) => {
    // Ожидания: 15 + 3 + 5 + 5 + 20 + 15 + по умолчанию (5 × 5) — 88 с.
    test.setTimeout(150_000);
    await register(context);
    await passByRequest(context);
    await page.goto(LESSON);
    await page.waitForLoadState("networkidle");
    const pct = await failRetry(page, () => context.setOffline(true));
    await expect(page.locator("[data-rf-outbox-note]")).toBeVisible();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await ledger(context)).receipts, { timeout: 20_000 }).toBe(1);
    await expectCreditKept(page, context, pct);
  });

  test("время попытки — время ответа: позавчерашний ответ из очереди не делает «сегодня» днём урока", async ({ page, context }) => {
    // Ожидания: 15 + 3 + 5 + 15 + 10 + 15 + по умолчанию (5 × 5) — 88 с.
    test.setTimeout(150_000);
    await register(context);
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    // Запись очереди без владельца: ключ и время действия (как шлёт очередь).
    await passByRequest(context, { key: `e2e-credit-${Date.now()}-0000000000`, at: twoDaysAgo });
    const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    const key = (ms: number, tz: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
    const then = new Set([key(twoDaysAgo, zone), key(twoDaysAgo, "UTC")]);
    const now = new Set([key(Date.now(), zone), key(Date.now(), "UTC")]);

    const before = await ledger(context);
    expect(before.receipts, "запись с ключом не принята").toBe(1);
    const completedDay = key(Date.parse(before.attempt?.completedAt ?? ""), "UTC");
    expect(then.has(completedDay), `время попытки ${completedDay} — время приёма, а ответ был ${[...then].join(" / ")}`).toBe(true);
    expect(before.activityDays ?? [], "в календаре не только день ответа").toHaveLength(1);
    expect(then.has((before.activityDays ?? [])[0])).toBe(true);

    // Неудачная повторная СЕГОДНЯ: сегодня становится днём урока, позавчера остаётся.
    await page.goto(LESSON);
    const pct = await failRetry(page);
    await expect.poll(async () => (await ledger(context)).attempt?.score ?? null, { timeout: 15_000 }).toBe(pct);
    // День сегодняшний ставится в `after()` — ждать, а не читать один раз.
    await expect.poll(async () => ((await ledger(context)).activityDays ?? []).length, { timeout: 10_000 }).toBe(2);
    const days = (await ledger(context)).activityDays ?? [];
    expect(days.some((d) => then.has(d)), "позавчерашний день урока пропал задним числом").toBe(true);
    expect(days.some((d) => now.has(d))).toBe(true);
    await expectCreditKept(page, context, pct);
  });
});
