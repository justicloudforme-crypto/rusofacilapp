import { test, expect } from "./helpers/test";

/**
 * Поиск по сайту: открытие, ввод, переход по результату.
 *
 * Что этот файл сторожит помимо самого себя. До 06.09.2026 поиск был
 * клиентским фильтром по восьми пунктам меню и не находил ни одного
 * объекта сайта — 0 из 13 разделов (PROGRESS.md 7.127). Сторож охвата
 * (`check:search-coverage`) проверяет ПОЛНОТУ индекса на настоящей базе,
 * но он не открывает браузера: он не видит ни того, что окно открывается,
 * ни того, что по строке выдачи можно уйти. Это здесь.
 *
 * Всё, что нужно этим случаям, есть и в пустой базе CI: подписи разделов
 * приходят из словарей, а игровые пазлы — из e2e/fixtures/word-games.json
 * (см. scripts/seed-e2e-fixture.mjs). Поэтому файл не пропускает себя под
 * `process.env.CI` — ровно та привычка, из-за которой CI однажды прогнал
 * 25 тестов из 49 и был зелёным (7.52).
 */

const RESULTS = '[data-testid="global-search-results"]';

async function openSearch(page: import("@playwright/test").Page, lang: "es" | "ru") {
  await page.goto(`/${lang}`);
  await page.getByRole("button", { name: lang === "es" ? "Buscar" : "Поиск" }).click();
  await expect(page.locator(RESULTS)).toBeVisible();
}

test("ввод находит раздел и переход по результату уводит на его страницу (es)", async ({ page }) => {
  await openSearch(page, "es");

  // Пустая строка — по-прежнему список разделов, без единого запроса.
  await expect(page.locator(RESULTS).getByRole("link")).toHaveCount(8);

  await page.getByRole("searchbox").fill("Cuentos");
  const result = page.locator(RESULTS).getByRole("link", { name: "Cuentos", exact: true });
  await expect(result).toBeVisible();

  await Promise.all([page.waitForURL("**/es/stories"), result.click()]);
  await expect(page.locator("h1")).toBeVisible();
});

test("ввод находит раздел и переход по результату уводит на его страницу (ru)", async ({ page }) => {
  await openSearch(page, "ru");
  await page.getByRole("searchbox").fill("Рассказы");
  const result = page.locator(RESULTS).getByRole("link", { name: "Рассказы", exact: true });
  await expect(result).toBeVisible();
  await Promise.all([page.waitForURL("**/ru/stories"), result.click()]);
  await expect(page.locator("h1")).toBeVisible();
});

test("живой объект базы находится по своему названию и ведёт на свою страницу", async ({ page }) => {
  // `sustantivo` — строка глоссария из e2e/fixtures/glossary.json, то есть
  // настоящая продовая запись. Это тот самый случай, который замер
  // 05.09.2026 назвал ненаходимым.
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill("sustantivo");

  // Строка берётся из раздела глоссария, а не по точному имени ссылки:
  // подпись строки несёт ещё и русский эквивалент («существительное»),
  // поэтому доступное имя ссылки — это две строки, а не одна.
  const glossary = page.locator('[data-testid="search-section-glossary"]');
  await expect(glossary).toBeVisible();
  const result = glossary.locator('[data-testid="search-result"]').first();
  // Точное совпадение стоит выше подстроки — первой обязана быть сама
  // запись, а не «sustantivo solo en plural».
  await expect(result).toContainText("sustantivo");
  await Promise.all([page.waitForURL("**/es/glossary/sustantivo"), result.click()]);
  await expect(page.locator("h1")).toBeVisible();
});

test("несуществующая строка даёт пустую выдачу", async ({ page }) => {
  // Отрицательный контроль: без него «нашлось» выше доказывало бы только
  // то, что окно печатает что попало.
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill("zzqqxwv-нет-такого");
  await expect(page.locator(RESULTS).getByText("No se encontraron resultados")).toBeVisible();
  await expect(page.locator(RESULTS).locator('[data-testid="search-result"]')).toHaveCount(0);
});

test("игры показаны одной свёрнутой строкой, сколько бы пазлов ни совпало", async ({ page }) => {
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill("sopa de letras");

  const gameSection = page.locator('[data-testid="search-section-game"]');
  await expect(gameSection).toBeVisible();
  // Строка раздела игр ровно одна — правило, ради которого свёртка и
  // заведена: шаблонных названий 3277, и поштучно они вытеснили бы из
  // выдачи все остальные разделы.
  await expect(gameSection.locator('[data-testid="search-result"]')).toHaveCount(1);
  await expect(gameSection.getByText(/puzles coinciden/)).toBeVisible();

  await Promise.all([
    page.waitForURL("**/es/word-games"),
    gameSection.locator('[data-testid="search-result"]').click(),
  ]);
});
