import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * «0 ИЗ 0» НЕ ПЕЧАТАЕТСЯ НИГДЕ — находка владельца 17.09.2026 (видео
 * проверки 7.207), тот же класс, что убран в 7.204.
 *
 * ЧТО СНЯТО. И у бесплатного аккаунта (POCO, /es), и у доступа по коду
 * (iPhone, /ru) при выборе уровня C1 строка из долга 249 печатает
 * «Llevas 0 de 0 palabras disponibles · 988 más con Premium» /
 * «Вы выучили 0 из 0 доступных · ещё 988 в Premium». Дробь с нулевым
 * знаменателем не значит ничего: уровень C1 целиком в Premium, и сказать
 * надо ровно это.
 *
 * ЧТО ПРОВЕРЯЕТСЯ. На уровне, где доступного ноль (ответ
 * `/api/flashcards/summary` — источник, а не догадка):
 *
 *   1) строка на экране ЕСТЬ (её не убрали молчком);
 *   2) в ней нет ни одного одинокого нуля — то есть ни «0 из 0», ни
 *      «0 de 0»;
 *   3) в ней названо число закрытого планом Premium — тем же числом,
 *      которым его назвал сервер.
 *
 * И положительный контроль тут же: на разрезе «все уровни», где
 * доступного больше нуля, печатается прежняя дробь со знаменателем.
 *
 * Все три режима словаря, обе локали, ширина 384 (POCO X6 Pro).
 */
const WIDTH = 384;
const LINE = '[data-learned-progress="grid"]';
const MODES = ["match", "recall", "fillBlank"] as const;

interface Summary {
  totalKnown: number;
  availableWords: number;
  premiumOnlyWords: number;
  subscriptionOnlyWords: number;
}

for (const lang of ["es", "ru"] as const) {
  test(`[${lang}] уровень, на котором доступного ноль, не печатает дробь «0 из 0»`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 900 });
    await loginWithSubscription(page, { tier: "standard" });

    // Числа берутся у того же маршрута, из которого их берёт страница.
    const res = await page.request.post("/api/flashcards/summary", { data: { level: "C1" } });
    expect(res.ok(), "маршрут сводки не ответил").toBe(true);
    const summary = (await res.json()) as Summary;
    // Условие пробы — именно нулевой знаменатель. Если банк когда-нибудь
    // откроет C1 этому разряду, проба обязана покраснеть, а не тихо
    // проверять другой случай.
    expect(summary.availableWords, "на C1 у разряда standard доступного не ноль — проба судит не тот случай").toBe(0);
    expect(summary.premiumOnlyWords, "закрытого планом Premium ноль — сказать было бы нечего").toBeGreaterThan(0);

    for (const mode of MODES) {
      await page.goto(`/${lang}/vocabulary?mode=${mode}`);
      const line = page.locator(LINE);
      await expect(line).toBeVisible();
      await page.locator("[data-testid=level-filter] button").filter({ hasText: "C1" }).first().click();
      await expect(line).toBeVisible();
      const text = ((await line.textContent()) ?? "").trim();
      expect(text.length, `[${mode}] строка пуста`).toBeGreaterThan(0);
      expect(text, `[${mode}] на экране дробь с нулевым знаменателем: «${text}»`).not.toMatch(/(^|\D)0(\D|$)/);
      expect(text, `[${mode}] закрытое планом Premium не названо числом`).toContain(String(summary.premiumOnlyWords));
    }
  });

  test(`[${lang}] там, где доступное есть, знаменатель по-прежнему печатается`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 900 });
    await loginWithSubscription(page, { tier: "standard" });

    const res = await page.request.post("/api/flashcards/summary", { data: {} });
    expect(res.ok(), "маршрут сводки не ответил").toBe(true);
    const summary = (await res.json()) as Summary;
    expect(summary.availableWords, "доступного ноль — контроль ничего не судит").toBeGreaterThan(0);

    await page.goto(`/${lang}/vocabulary?mode=match`);
    const line = page.locator(LINE);
    await expect(line).toBeVisible();
    await expect(line).toContainText(String(summary.availableWords));
  });
}
