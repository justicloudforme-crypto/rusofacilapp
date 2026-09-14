import { test, expect } from "./helpers/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * СЛОВАРЬ ВНУТРИ ПРИЛОЖЕНИЯ — ТРИ НАХОДКИ ВЛАДЕЛЬЦА (7.195, части 1, 3, 4).
 *
 * Сняты с живого устройства 14.09.2026, после мержа #313:
 *   1. плашка замка на уровне C1 рисовалась ДВА РАЗА подряд;
 *   2. плитки тем на уровне C1 писали «0 слов» при непустом банке;
 *   3. корона и замок стояли вперемешку на одном и том же материале.
 *
 * Юнит-проверки (`src/components/flashcards/native-signs.test.tsx`) держат
 * правило на компонентах; здесь тот же экран собирается целиком — с
 * настоящим ответом `/api/flashcards/summary`, настоящим фильтром уровня и
 * настоящей ролью, — потому что ровно на стыке этих трёх вещей дефект и
 * жил: число приходило с сервера, а фильтр накладывал браузер.
 *
 * Оболочка изображается кукой — тем признаком, которым её видит service
 * worker (разбор — в `native-shell-no-payments.spec.ts`).
 */
const SHELL_COOKIE = { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" };
const PLATE = "[data-testid=native-locked-notice]";
/** Знак сорта НА ПЛИТКЕ. Один и тот же селектор в обоих направлениях:
 *  положительное утверждение ниже доказывает, что он вообще что-то
 *  находит, отрицательное — что в вебе не находит ничего (правило 7.149). */
const TILE_MARK = "[data-testid=category-tile] [data-access-mark]";

async function openVocabulary(page: import("@playwright/test").Page) {
  await page.goto("/ru/vocabulary");
  await expect(page.locator("[data-testid=category-tile]").first()).toBeVisible();
}

test("гость: на уровне C1 плашка замка ровно одна, и на сетке, и внутри темы", async ({ page, context }) => {
  await context.addCookies([SHELL_COOKIE]);
  await openVocabulary(page);

  await page.getByRole("button", { name: "C1", exact: false }).click();
  await expect(page.locator(PLATE)).toHaveCount(1);

  // Внутрь темы — то самое нажатие, после которого сервер отвечает
  // `limited: true` и до 7.195 появлялась ВТОРАЯ плашка.
  await page.locator("[data-testid=category-tile]").first().click();
  await expect(page.locator(PLATE)).toHaveCount(1);
});

test("вошедший без подписки: на уровне C1 плашка тоже одна", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies([SHELL_COOKIE]);
  await openVocabulary(page);

  await page.getByRole("button", { name: "C1", exact: false }).click();
  await expect(page.locator(PLATE)).toHaveCount(1);
  await page.locator("[data-testid=category-tile]").first().click();
  await expect(page.locator(PLATE)).toHaveCount(1);
});

test("ни одна плитка не пишет «0 слов», когда в банке по этому пересечению есть карточки", async ({ page, context }) => {
  await context.addCookies([SHELL_COOKIE]);
  await openVocabulary(page);
  await page.getByRole("button", { name: "C1", exact: false }).click();

  const tiles = page.locator("[data-testid=category-tile]");
  const count = await tiles.count();
  expect(count, "плитки есть — иначе проверять нечего").toBeGreaterThan(0);

  let withBank = 0;
  for (let i = 0; i < count; i += 1) {
    const tile = tiles.nth(i);
    const bank = Number(await tile.getAttribute("data-bank-total"));
    const shown = Number(await tile.getAttribute("data-total"));
    if (bank > 0) {
      withBank += 1;
      expect(shown, `плитка ${i}: в банке ${bank}, а напечатано ${shown}`).toBeGreaterThan(0);
      // И знак сорта на ней стоит: весь C1 — премиальный материал.
      await expect(tile.locator("[data-access-mark=premium-tier]")).toHaveCount(1);
    }
  }
  // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: если банк пуст на всех плитках, цикл выше
  // ничего не проверил. Такой прогон обязан падать, а не считаться зелёным.
  expect(withBank, "ни одной плитки с непустым банком — проверка пустая").toBeGreaterThan(0);
  /**
   * ЗНАК СТОИТ НА ВСЕХ ПЛИТКАХ, А НЕ ТОЛЬКО НА НЕПУСТЫХ — 7.196, часть 1.
   *
   * До 14.09.2026 здесь ожидалось `withBank`, и это было верно для
   * прежнего правила: знак печатался там, где нельзя открыть НИЧЕГО.
   * Новое правило владельца другое: 👑 — метка СОРТА материала, и весь
   * уровень C1 премиальный независимо от того, сколько строк лежит в
   * конкретной теме и какая у смотрящего роль. Поэтому корона обязана
   * стоять на КАЖДОЙ плитке — и в базе CI (2 темы с карточками C1 из 23),
   * и на полном банке прода (23 из 23).
   *
   * Утверждение осталось двусторонним: `withBank > 0` выше не даёт циклу
   * оказаться пустым, а отрицательный контроль веба ниже ищет тот же
   * селектор и обязан не найти ничего.
   */
  await expect(page.locator(TILE_MARK)).toHaveCount(count);
  expect(count, "плиток на экране меньше, чем плиток с банком").toBeGreaterThanOrEqual(withBank);
});

test("веб не тронут: без куки оболочки ни плашки, ни знаков на плитках нет", async ({ page }) => {
  // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ ко всем трём проверкам выше: всё, что они ищут,
  // обязано отсутствовать ровно на том же экране в браузере.
  await openVocabulary(page);
  await page.getByRole("button", { name: "C1", exact: false }).click();
  await expect(page.locator(PLATE)).toHaveCount(0);
  await expect(page.locator(TILE_MARK)).toHaveCount(0);
});
