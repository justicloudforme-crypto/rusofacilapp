import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ПОКУПКА ВНУТРИ ПРИЛОЖЕНИЯ — ЗАХОД 7.224, НАСТОЯЩИМ БРАУЗЕРОМ.
 *
 * Что проверяют другие приборы и чего им не хватает. `check:native-payments`
 * спрашивает СЕРВЕР: что лежит в ответе на запрос, представившийся
 * оболочкой версии 4. `check:native-purchase` судит ИСХОДНИКИ. Ни один из
 * них не отвечает на вопрос «что увидит человек, открыв закрытый материал
 * в приложении» — на него отвечает только браузер.
 *
 * ОБОЛОЧКА ИЗОБРАЖАЕТСЯ ДВУМЯ КУКАМИ. Признак `rf_native_shell` говорит
 * «это приложение», число в `rf_shell_version` — какое именно. Ровно так
 * сайт узнаёт версию у запроса, который за webview выполняет service
 * worker: токена в User-Agent такой запрос не несёт вовсе
 * (`src/lib/native-shell.ts`).
 *
 * ЧЕГО ЭТА ПРОБА НЕ ДОКАЗЫВАЕТ И ЧТО НАПИСАНО ЧЕСТНО. Настоящей покупки
 * здесь нет: `Capacitor.isNativePlatform()` в обычном браузере — false,
 * SDK магазина не настраивается, и экран покупки честно говорит, что
 * варианты не загрузились. Проверяется ровно то, что можно проверить
 * браузером: экран на месте, ведёт себя разумно, и веб-кассы рядом с ним
 * нет ни в каком виде.
 */
const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "4", domain: "localhost", path: "/" },
];

test("в оболочке 4 страница цен показывает экран покупки и ни одного входа в веб-кассу", async ({
  page,
  context,
}) => {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);
  await page.goto("/ru/pricing");

  // Утверждения ПОЛОЖИТЕЛЬНЫЕ: селектор, живущий только в отрицаниях,
  // никем не доказан (долги 94 и 95).
  await expect(page.getByTestId("native-purchase")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Открыть весь курс" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Восстановить покупки" })).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/OXXO|MXN|Оплатить/);
  await expect(page.locator('form[action="/api/checkout"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/ru/pricing"]')).toHaveCount(0);
});

test("в оболочке 4 тап по закрытому материалу открывает покупку, а не тупик", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies(SHELL);

  await page.goto("/ru/word-games");
  const locked = page.locator('a[data-locked="true"]').first();
  await expect(locked, "закрытая плитка есть — иначе проверять нечего").toBeVisible();
  await locked.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("native-purchase")).toBeVisible();
  // Ни одной цены нашей стороны: их печатает магазин.
  const dialogText = await dialog.innerText();
  expect(dialogText).not.toMatch(/MXN|OXXO|\$\s?\d/);
});

/**
 * ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ, без которого обе пробы выше ничего не значат:
 * тот же браузер БЕЗ кук оболочки обязан увидеть веб-кассу на месте, а
 * экрана покупки не увидеть вовсе. В браузере сайт не менялся ни на байт.
 */
test("в вебе веб-касса на месте, а нативного экрана покупки нет — контроль слепоты", async ({ page }) => {
  await page.goto("/ru/pricing");
  await expect(page.locator('form[action="/api/checkout"]').first()).toBeVisible();
  // Тот же селектор, что в отрицании выше, обязан ЧТО-ТО находить: иначе
  // его ноль в оболочке не доказывает ничего (долги 94 и 95).
  await expect(page.locator('a[href^="/ru/pricing"]').first()).toBeAttached();
  await expect(page.getByTestId("native-purchase")).toHaveCount(0);
});

/**
 * СТАРАЯ ОБОЛОЧКА ПОКУПКИ НЕ ВИДИТ. Версия 3 живёт в закрытом тесте, и
 * магазинной покупки её webview выполнить не может: ни плагина, ни
 * разрешения BILLING в том пакете нет. Кнопка, которая ничего не делает, —
 * дефект сама по себе, и это ровно то, чем был долг 179.
 */
test("в оболочке 3 покупки нет, а замок на месте", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies([
    { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
    { name: "rf_shell_version", value: "3", domain: "localhost", path: "/" },
  ]);
  await page.goto("/ru/pricing");

  await expect(page.getByRole("heading", { name: "Что открыто в приложении" })).toBeVisible();
  await expect(page.getByTestId("native-purchase")).toHaveCount(0);
});
