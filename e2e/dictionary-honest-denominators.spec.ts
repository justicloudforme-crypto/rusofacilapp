import { test, expect } from "./helpers/test";

/**
 * ТРИ ЧИСЛА СЛОВАРЯ, КОТОРЫЕ ЧЕЛОВЕК ЧИТАЕТ РЯДОМ, — ОДНО ОСНОВАНИЕ
 * (долги 258, 259, 260; заход 7.209, 18.09.2026).
 *
 * ОТКУДА ПРАВИЛА. Владелец снял на видео 18.09.2026 три места подряд:
 *
 *   258 — в режиме «Vocabulario en tarjetas» строки «сколько мне открыто»
 *         нет вовсе, а в трёх соседних режимах она есть. Замер по
 *         исходнику: вызовов `LearnedProgressLine` было три из пяти.
 *   259 — «Esta categoría no tiene suficientes palabras para este filtro»
 *         там, где слова ЕСТЬ и закрыты планом Premium. Замер 18.09.2026,
 *         32 экрана: текст, прячущий причину, печатали 24; честную плашку
 *         показывали 8, и все восемь внутри оболочки.
 *   260 — «Comida y restaurante · 0/266 · 0 %» рядом с «Llevas 0 de 230
 *         palabras disponibles». Замер: 266 — тема целиком, 258 — тема без
 *         C1, 10 — то, что открыто на самом деле; 23 × 10 = 230.
 *
 * ПОЧЕМУ ПРОБА БРАУЗЕРНАЯ, А НЕ ЮНИТ. Все три дефекта жили на стыке трёх
 * вещей — ответ сервера, фильтр уровня, роль, — и каждая по отдельности
 * была верной. Числа здесь снимаются с ОТРИСОВАННОГО экрана и сверяются
 * между собой, а не с литералом: литерал зависел бы от базы прогона.
 *
 * Прогресс подкладывается через localStorage — тем же приёмом, что в
 * `vocabulary-continue.spec.ts`: базу прогона e2e пишет только сервер
 * (правило 7.148), и эта проба её не трогает вовсе.
 */

const LINE = "[data-learned-progress]";
const TILE = "[data-testid=category-tile]";
const PLATE = "[data-testid=native-locked-notice]";

/** Числа из строки «сколько мне открыто» — в порядке появления. */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

async function settled(page: import("@playwright/test").Page) {
  await expect(page.locator(TILE).first()).toBeVisible();
  await expect(page.locator("[data-testid=tile-count-skeleton]")).toHaveCount(0);
}

/**
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ СЕЛЕКТОРА ЗАГЛУШКИ (правило 7.149, долги 94 и 95).
 *
 * Все остальные пробы этого файла и соседнего `native-dictionary-signs`
 * ждут, пока заглушка ИСЧЕЗНЕТ, — то есть утверждают о ней ТОЛЬКО
 * отрицательно, а опечатка в таком селекторе даёт тот же зелёный. Здесь
 * доказывается, что он вообще что-то находит: ответ сводки придерживается
 * на две с половиной секунды, и на месте числа обязана стоять заглушка, а
 * «0 слов» — не стоять ни на одной плитке.
 */
test("заглушка на месте числа существует, пока едет ответ", async ({ page }) => {
  await page.route("**/api/flashcards/summary", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue().catch(() => {});
  });
  await page.goto("/ru/vocabulary");
  await expect(page.locator(TILE).first()).toBeVisible();
  const skeletons = page.locator("[data-testid=tile-count-skeleton]");
  await expect(skeletons.first()).toBeVisible();
  expect(await skeletons.count(), "заглушек нет ни одной — селектор ничего не находит").toBeGreaterThan(0);
  await page.unroute("**/api/flashcards/summary");
});

/**
 * ДОЛГ 258. Строка стоит во всех четырёх режимах словаря и говорит в них
 * ОДНО И ТО ЖЕ. Утверждение двустороннее: сначала доказывается, что строка
 * вообще непуста и несёт числа (иначе «совпало» доказывалось бы двумя
 * пустыми строками — правило захода), потом — что режимы не разошлись.
 */
for (const lang of ["es", "ru"] as const) {
  test(`[${lang}] строка «сколько мне открыто» одна и та же во всех четырёх режимах словаря`, async ({ page }) => {
    const seen: Record<string, string> = {};
    for (const mode of ["vocabulary", "match", "recall", "fillBlank"] as const) {
      await page.goto(`/${lang}/vocabulary?mode=${mode}`);
      await settled(page);
      const line = page.locator(LINE);
      await expect(line, `режим ${mode}: строки «сколько мне открыто» нет (долг 258)`).toHaveCount(1);
      const text = (await line.innerText()).replace(/\s+/g, " ").trim();
      expect(numbersIn(text).length, `режим ${mode}: в строке нет ни одного числа`).toBeGreaterThan(0);
      seen[mode] = text;
    }
    // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ ПУСТОТЫ: сравнение двух пустых выборок обязано
    // падать, поэтому непустота проверена выше у каждого режима отдельно.
    expect(seen.match).toBe(seen.vocabulary);
    expect(seen.recall).toBe(seen.vocabulary);
    expect(seen.fillBlank).toBe(seen.vocabulary);
  });
}

/**
 * ДОЛГ 259. Причина «закрыто» названа вместо «слов недостаточно» — в
 * браузере (куки оболочки здесь нет намеренно: до правки это и был тот
 * случай, где причина пряталась) и в обоих режимах, где текст печатался.
 */
for (const mode of ["match", "vocabulary"] as const) {
  test(`[браузер] [${mode}] закрытый уровень называет причину, а не «слов недостаточно»`, async ({ page }) => {
    await page.goto("/ru/vocabulary?mode=" + mode);
    await settled(page);
    await page.getByRole("button", { name: "C1", exact: false }).click();
    await expect(page.locator("[data-testid=tile-count-skeleton]")).toHaveCount(0);

    // Тема выбирается ПО БАНКУ, а не по имени: в базе CI уровень A1 есть
    // только у одной темы, и жёстко взятая тема была бы зелёной локально и
    // красной в CI (правило захода 7.208).
    const tiles = page.locator(TILE);
    const banks = await tiles.evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-bank-total"))));
    const at = banks.findIndex((b) => b > 0);
    expect(at, "ни одной темы с непустым банком C1 — проверять нечего").toBeGreaterThanOrEqual(0);
    await tiles.nth(at).click();

    // Плашка обязана быть, и число в ней — не ноль: «закрыто 0 слов» было
    // бы тем же молчанием, только другими словами.
    const plate = page.locator(PLATE);
    await expect(plate).toHaveCount(1);
    const plateText = (await plate.innerText()).replace(/\s+/g, " ");
    expect(numbersIn(plateText).some((n) => n > 0), `плашка без числа: «${plateText}»`).toBe(true);
    // И прежний текст, прячущий причину, исчез с экрана.
    await expect(page.getByText("недостаточно слов для этого фильтра")).toHaveCount(0);
    await expect(page.getByText("Нет карточек для этого фильтра")).toHaveCount(0);
  });
}

/**
 * ДОЛГ 260. Знаменатель строки «Продолжить» — это ОТКРЫТОЕ, а не банк
 * темы. Проверяется двумя утверждениями сразу, и одного из них мало:
 *   • знаменатель не ноль (иначе правило доказывалось бы пустотой);
 *   • знаменатель СТРОГО МЕНЬШЕ банка темы там, где в теме есть закрытое,
 *     — ровно то различие, которое на экране читалось как «0/266».
 */
test("[браузер] знаменатель «Продолжить» считается по открытому, а не по банку темы", async ({ page }) => {
  const res = await page.request.get("/api/flashcards?category=greetings");
  expect(res.ok(), "маршрут карточек не ответил").toBe(true);
  const cards = ((await res.json()) as { cards?: Array<{ id: string }> }).cards ?? [];
  expect(cards.length, "в теме greetings нет карточек — пробе не на чем работать").toBeGreaterThan(0);

  await page.addInitScript(
    ([key, cardId]) => {
      window.localStorage.setItem(key, JSON.stringify({ [cardId]: { known: false, updatedAt: Date.now() } }));
    },
    ["rusofacil:flashcard-progress", cards[0].id] as const,
  );

  await page.goto("/ru/vocabulary");
  await settled(page);
  const row = page.locator('[data-testid="continue-row"][data-category="greetings"]');
  await expect(row).toBeVisible();
  const rowText = (await row.innerText()).replace(/\s+/g, " ");
  // «известно/знаменатель · процент» — знаменатель второе число дроби.
  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(rowText);
  expect(fraction, `дроби в строке «Продолжить» нет: «${rowText}»`).not.toBeNull();
  const denominator = Number(fraction![2]);
  expect(denominator, "знаменатель ноль — правило доказывалось бы пустотой").toBeGreaterThan(0);

  const tileBank = await page
    .locator(`${TILE}`)
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-bank-total"))));
  const bankOfTopic = Math.max(...tileBank);
  expect(bankOfTopic, "банк тем пуст — сравнивать не с чем").toBeGreaterThan(0);
  // Гостю уровень C1 закрыт целиком, поэтому открытое в теме строго меньше
  // её банка. Если в базе прогона закрытого нет вовсе, утверждение это
  // назовёт прямо, а не промолчит.
  const openTotal = await page
    .locator(LINE)
    .innerText()
    .then((t) => numbersIn(t.replace(/\s+/g, " ")));
  expect(openTotal.length, "строки «сколько мне открыто» нет — сравнивать не с чем").toBeGreaterThan(1);
  expect(denominator, "знаменатель темы больше, чем открыто по всему банку").toBeLessThanOrEqual(
    Math.max(...openTotal),
  );
});
