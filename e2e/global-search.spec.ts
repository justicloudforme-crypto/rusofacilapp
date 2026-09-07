import { test, expect } from "./helpers/test";
import { loginWithSubscription, loginWithoutSubscription } from "./helpers/auth";

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

/**
 * Строка выдачи ведёт на САМ объект там, где адрес объекта существует.
 *
 * Что чинилось. Замер на живом проде 07.09.2026 (PROGRESS.md 7.133,
 * часть 4): восемь запросов, каждый — ПОЛНОЕ название одного пазла,
 * совпало 1–2 объекта, и все восемь раз выдача отдавала одну свёрнутую
 * строку на `/es|ru/word-games`. Адрес у пазла есть, лежит в том же
 * индексе — а поиск уводил в общее меню раздела. Своих адресов это
 * касалось 3277 записей из 10 720 (30,6%).
 *
 * Тест выше («игры показаны одной свёрнутой строкой») — не соперник этому,
 * а его позитивный контроль: он показывает, что свёртка ЖИВА там, где она
 * и заводилась, — на запросе, совпадающем с сотнями шаблонных названий.
 * Оба случая обязаны стоять рядом, иначе починка одного молча отменяет
 * другой.
 *
 * CROSSWORD A1/1 есть и в dev.db, и в e2e/fixtures/word-games.json с одной
 * и той же темой (`ciencia`), поэтому его название совпадает локально и в
 * CI.
 */
test("полное название одного пазла уводит на сам пазл, а не на хаб игр", async ({ page }) => {
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill("Crucigrama de ciencia en ruso (A1)");

  const gameSection = page.locator('[data-testid="search-section-game"]');
  await expect(gameSection).toBeVisible();
  const rows = gameSection.locator('[data-testid="search-result"]');
  await expect(rows).toHaveCount(1);
  // Свёрнутая строка носит свою пометку — здесь её быть не должно.
  await expect(rows.first()).not.toHaveAttribute("data-collapsed", "true");
  await expect(rows.first()).toHaveAttribute("href", "/es/word-games/CROSSWORD/A1/1");

  await Promise.all([page.waitForURL("**/es/word-games/CROSSWORD/A1/1"), rows.first().click()]);
});

/**
 * Платное остаётся платным: у закрытого пазла в выдаче есть пометка про
 * подписку, адрес — его собственный, и без подписки он не открывается.
 *
 * Почему проб две. КАКОЙ пазл закрыт — свойство базы, а не правила:
 * в фикстуре CI закрыт `WORD_SEARCH A1 №2`, а в полной `dev.db` тот же
 * номер бесплатен (у него есть тема) и первый закрытый — `№134`. Обе
 * строки спрашиваются, и хотя бы одна ОБЯЗАНА дать закрытую строку —
 * иначе тест прошёл бы на пустоте, ничего не проверив. Скобка в запросе
 * не украшение: без неё «nº 2» совпало бы ещё и с «nº 20», «nº 21» и так
 * далее, и раздел свернулся бы по числу совпадений.
 */
test("закрытый пазл: пометка про подписку, свой адрес, и без подписки не открывается", async ({
  page,
}) => {
  const probes = [
    "Sopa de letras en ruso, nivel A1 nº 2 (",
    "Sopa de letras en ruso, nivel A1 nº 134 (",
  ];

  let href: string | null = null;
  for (const probe of probes) {
    await openSearch(page, "es");
    // Ждать ОТВЕТ, а не таймер: счёт строк сразу после `fill` вернул бы
    // ноль просто потому, что задержка ввода (300 мс) ещё не истекла, — и
    // «пазл не найден» было бы неотличимо от «я спросил слишком рано».
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/search") && r.status() === 200),
      page.getByRole("searchbox").fill(probe),
    ]);
    if (((await response.json()) as { total: number }).total === 0) continue;

    const locked = page
      .locator('[data-testid="search-section-game"] [data-testid="search-result"]')
      .filter({ has: page.locator('[data-testid="search-result-locked"]') });
    await expect(locked.first()).toBeVisible();
    href = await locked.first().getAttribute("href");
    break;
  }

  // Без этой строки цикл выше при двух пустых пробах «прошёл» бы молча.
  expect(href, "ни одна проба не дала закрытого пазла — тест проверил бы пустоту").not.toBeNull();
  expect(href).toMatch(/^\/es\/word-games\/WORD_SEARCH\/A1\/\d+$/);

  // …и без подписки он действительно не открывается: страница пазла сама
  // отправляет анонима на пейволл, унося с собой адрес возврата.
  await page.goto(href!);
  await expect(page).toHaveURL(new RegExp(`/es/pricing\\?next=${href!.replace(/\//g, "\\/")}$`));
});

/**
 * Вошедший пользователь. Пробел, названный в 7.128 частью 5 №7: все
 * десять прогонов этой спеки шли анонимно, а обещание «состав выдачи не
 * зависит от уровня доступа» до сих пор держал только юнит-тест.
 *
 * Проверяются оба обещания сразу, и второе — это позитивный контроль к
 * первому:
 *
 *   1. состав выдачи одинаков у анонима, у вошедшего без подписки и у
 *      вошедшего с подпиской: то же число совпадений, те же строки, те же
 *      адреса;
 *   2. закрытый объект в выдаче ЕСТЬ и помечен — у первых двух, и НЕ
 *      помечен у третьего.
 *
 * Без второго пункта первый прошёл бы и на выдаче, в которой пометки нет
 * ни у кого вовсе. Подопытный объект — второй урок A1: бесплатен только
 * первый урок уровня (isFreeTrialLesson), название приходит из словаря,
 * поэтому случай работает и в пустой базе CI.
 */
const LOCKED_LESSON = "Saludos, despedidas y presentaciones";

async function searchSnapshot(page: import("@playwright/test").Page) {
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill(LOCKED_LESSON);

  const section = page.locator('[data-testid="search-section-lesson"]');
  await expect(section).toBeVisible();
  const results = page.locator(`${RESULTS} [data-testid="search-result"]`);
  await expect(results.first()).toBeVisible();

  const hrefs = await results.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
  // Название строки, а не весь её текст: пометка «нужна подписка» — тоже
  // текст внутри ссылки, и сравнивать её здесь значило бы объявить
  // разным состав выдачи, который не изменился.
  const titles = await results.evaluateAll((nodes) =>
    nodes.map((n) => (n.querySelector("span.block") ?? n).textContent?.trim() ?? ""),
  );
  const locked = await page.locator(`${RESULTS} [data-testid="search-result-locked"]`).count();
  return { hrefs, titles, locked };
}

test("состав выдачи не зависит от уровня доступа; закрытый объект помечен и адрес тот же", async ({ page }) => {
  const anonymous = await searchSnapshot(page);
  // Без этой строки всё сравнение ниже прошло бы на пустой выдаче.
  expect(anonymous.hrefs.length).toBeGreaterThan(0);
  expect(anonymous.hrefs).toContain("/es/courses/a1/2");
  expect(anonymous.locked).toBeGreaterThan(0);

  await loginWithoutSubscription(page);
  const signedInFree = await searchSnapshot(page);
  expect(signedInFree.hrefs).toEqual(anonymous.hrefs);
  expect(signedInFree.titles).toEqual(anonymous.titles);
  expect(signedInFree.locked).toBe(anonymous.locked);

  await loginWithSubscription(page);
  const subscriber = await searchSnapshot(page);
  // Состав тот же — то же число строк и те же адреса.
  expect(subscriber.hrefs).toEqual(anonymous.hrefs);
  expect(subscriber.titles).toEqual(anonymous.titles);
  // …и ровно одна разница: пометки у подписчика нет. Это и есть
  // доказательство, что пометка вообще умеет пропадать, а «совпало» выше
  // не совпадение двух пустот.
  expect(subscriber.locked).toBe(0);
});
