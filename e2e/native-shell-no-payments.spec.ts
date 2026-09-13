import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ДОЛГ 179, ЧАСТИ 1 И 2 ЗАХОДА 7.192 — НАСТОЯЩИМ БРАУЗЕРОМ.
 *
 * Что проверяют ДРУГИЕ проверки и чего им не хватает. `check:native-payments`
 * спрашивает СЕРВЕР: что лежит в ответе на запрос, представившийся
 * оболочкой. На вопрос «что произойдёт, когда человек нажмёт» ответить
 * можно только браузером — и ровно этот вопрос владелец задал 13.09.2026,
 * открыв в приложении платный рассказ: кнопка подписки не срабатывала
 * вовсе. Причина была не в вёрстке: `openPaywall` внутри оболочки звал
 * витрину RevenueCat, а она отвечает отказом ещё до магазина, потому что
 * SDK не сконфигурирован — продуктов в консолях нет ни одного.
 *
 * ПОЧЕМУ ОБОЛОЧКА ИЗОБРАЖАЕТСЯ КУКОЙ, А НЕ User-Agent. Оба признака
 * законны и оба читает сервер (`src/lib/native-shell.ts`), но кука — это
 * ровно тот случай, в котором дефект и жил: переход внутри приложения
 * делает service worker, и его запрос токена в User-Agent не несёт. Проба
 * по куке проверяет ту половину, которой раньше не было вовсе.
 */
const SHELL_COOKIE = { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" };

test("внутри оболочки тап по закрытому материалу открывает замок, а не пейвол", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies([SHELL_COOKIE]);

  await page.goto("/ru/word-games");
  const locked = page.locator('a[data-locked="true"]').first();
  await expect(locked, "закрытая плитка есть — иначе проверять нечего").toBeVisible();
  await locked.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Замок, а не пейвол: ни одной цены и ни одной кнопки покупки.
  await expect(dialog.locator("[data-plan-price]")).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Этот материал закрыт" })).toBeVisible();
  const dialogText = await dialog.innerText();
  expect(dialogText).not.toMatch(/MXN|OXXO|\$\s?\d/);
  // И закрывается тем единственным органом, который в нём есть. Именно
  // `getByText`: подпись «Понятно» рама кладёт ещё и в `aria-label` фона и
  // крестика, а проверяется здесь ТА кнопка, которую человек видит.
  await dialog.getByText("Понятно", { exact: true }).click();
  await expect(dialog).toBeHidden();
});

test("внутри оболочки страница цен отдаёт объяснение, и платных входов на ней нет", async ({ page, context }) => {
  await context.addCookies([SHELL_COOKIE]);
  await page.goto("/ru/pricing");

  await expect(page.getByRole("heading", { name: "Что открыто в приложении" })).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/OXXO|MXN|Оплатить/);
  await expect(page.locator('form[action="/api/checkout"]')).toHaveCount(0);
  // Ссылки «Цены» в шапке и в меню внутри оболочки тоже нет.
  await expect(page.locator('a[href="/ru/pricing"]')).toHaveCount(0);
});

/**
 * Отрицательный контроль, без которого две проверки выше ничего не
 * доказывают: тот же браузер БЕЗ куки обязан увидеть веб-кассу на месте.
 * Проверка, которая не видит кассу там, где она заведомо есть, зелёная
 * говорит только о том, что она слепа (ПРАВИЛА ЗАМЕРА 4.1).
 */
test("в вебе (без признака оболочки) веб-касса на месте — контроль слепоты", async ({ page }) => {
  await page.goto("/ru/pricing");
  // Утверждения ПОЛОЖИТЕЛЬНЫЕ, и это не стилистика: селектор, живущий
  // только в отрицаниях, никем не доказан — опечатка в нём даёт тот же
  // зелёный (`check:e2e-live-probes`, долги 94 и 95). Здесь те же два
  // селектора, что выше, обязаны ЧТО-ТО найти.
  await expect(page.locator('form[action="/api/checkout"]').first()).toBeVisible();
  await expect(page.locator('a[href="/ru/pricing"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Что открыто в приложении" })).toHaveCount(0);
});
