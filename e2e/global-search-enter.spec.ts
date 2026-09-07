import { test, expect } from "./helpers/test";

/**
 * Enter в поле поиска уводит на первый результат выдачи.
 *
 * Чего этот путь стоил и почему появился отдельный файл. Замер 07.09.2026
 * на живом проде (PROGRESS.md 7.133, часть 1) прошёл 64 конфигурации —
 * ширины 640/768/834/1024 × две локали × chromium/webkit × аноним и
 * вошедший, отдельным проходом с тачем и UA планшета — и в каждой из них
 * получил одно и то же: на поле не висело НИ ОДНОГО обработчика `keydown`,
 * формы вокруг поля не было, и Enter не делал ровно ничего. То есть путь
 * не ломался — он не был написан. Замер 7.132, разбиравший ту же жалобу
 * «поиск не работает», этот путь не проверял ни разу: он мерил видимость
 * кнопки, открытие окна, попадание выдачи в экран и нажатие МЫШЬЮ по
 * строке.
 *
 * Позитивный контроль здесь обязателен и стоит рядом: «Enter уводит» без
 * случая «Enter НЕ уводит, когда уводить некуда» доказывал бы только то,
 * что окно вообще умеет менять адрес.
 */

const RESULTS = '[data-testid="global-search-results"]';
const RESULT = '[data-testid="search-result"]';

async function openSearch(page: import("@playwright/test").Page, lang: "es" | "ru") {
  await page.goto(`/${lang}`);
  await page.getByRole("button", { name: lang === "es" ? "Buscar" : "Поиск" }).click();
  await expect(page.locator(RESULTS)).toBeVisible();
}

// «Cuentos» / «Рассказы» — подпись раздела в словаре, то есть строка,
// которая есть и в пустой базе CI. Совпадение точное, а раздел `page`
// стоит в выдаче первым (SECTION_ORDER в match.ts), поэтому первый
// результат предсказуем: каталог рассказов.
const QUERY = { es: "Cuentos", ru: "Рассказы" } as const;
const EXPECTED = { es: "/es/stories", ru: "/ru/stories" } as const;

for (const lang of ["es", "ru"] as const) {
  test(`Enter уводит на первый результат выдачи (${lang})`, async ({ page }) => {
    await openSearch(page, lang);
    const input = page.getByRole("searchbox");
    await input.fill(QUERY[lang]);

    const first = page.locator(`${RESULTS} ${RESULT}`).first();
    await expect(first).toBeVisible();
    // Адрес берётся из САМОЙ выдачи, а не вписывается в тест: утверждение
    // должно звучать «Enter повторил нажатие по первой строке», а не «Enter
    // ведёт туда, куда я сегодня думаю».
    const href = await first.getAttribute("href");
    expect(href).toBe(EXPECTED[lang]);

    await Promise.all([page.waitForURL(`**${href}`), input.press("Enter")]);
    await expect(page.locator("h1")).toBeVisible();
    // Окно после перехода закрыто — ровно как при нажатии мышью.
    await expect(page.locator(RESULTS)).toBeHidden();
  });
}

test("пустая выдача: Enter не уводит никуда, не закрывает окно и не перезагружает страницу", async ({
  page,
}) => {
  await openSearch(page, "es");
  const input = page.getByRole("searchbox");
  await input.fill("zzqqxwv-нет-такого");
  await expect(page.locator(RESULTS).getByText("No se encontraron resultados")).toBeVisible();

  // Метка живёт в текущем документе: перезагрузка (например, неявная
  // отправка формы) её сотрёт, клиентская навигация — нет. Без неё
  // «страница не перезагрузилась» проверялось бы только по адресу, а адрес
  // при перезагрузке той же страницы не меняется.
  await page.evaluate(() => {
    (window as unknown as { __enterProbe?: string }).__enterProbe = "alive";
  });
  const before = page.url();

  await input.press("Enter");
  // Ждать нечего по построению — поэтому пауза фиксированная и короткая:
  // она даёт возможному переходу состояться, а не маскирует его.
  await page.waitForTimeout(1000);

  expect(page.url()).toBe(before);
  await expect(page.locator(RESULTS)).toBeVisible();
  await expect(input).toHaveValue("zzqqxwv-нет-такого");
  expect(await page.evaluate(() => (window as unknown as { __enterProbe?: string }).__enterProbe)).toBe("alive");
});

test("Enter, нажатый ДО прихода выдачи, всё равно уводит на первый результат", async ({ page }) => {
  // Задержка ввода — 300 мс, и человек, набравший слово и сразу нажавший
  // Enter, укладывается в неё легко. Ответ задерживается намеренно, чтобы
  // случай проверял именно этот порядок событий, а не удачу планировщика.
  await page.route("**/api/search**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

  await openSearch(page, "es");
  const input = page.getByRole("searchbox");
  await input.pressSequentially(QUERY.es, { delay: 0 });
  await Promise.all([page.waitForURL(`**${EXPECTED.es}`), input.press("Enter")]);
  await expect(page.locator("h1")).toBeVisible();
});
