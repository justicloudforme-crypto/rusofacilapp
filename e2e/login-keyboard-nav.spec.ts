import { test, expect } from "./helpers/test";

/**
 * НИЖНЕЕ МЕНЮ НЕ ПРЫГАЕТ ПРИ ОТКРЫТИИ КЛАВИАТУРЫ НА ВХОДЕ — долг 246
 * (заход 7.287).
 *
 * Замер на эмуляторе (Android 16, оболочка 1.0.16, `/es/login`, касание
 * поля почты, 3 прогона): на старом коде меню пряталось только после
 * того, как клавиатура уже сжала окно (904 → 568 CSS-px), и 12 кадров
 * (≈198 мс) стояло на краю клавиатуры, съезжая анимацией; на новом —
 * уходит в момент касания, кадров над клавиатурой 0.
 *
 * Здесь клавиатуры нет, поэтому проба судит ровно ту разницу, что
 * сделала правка: меню снято КАСАНИЕМ поля, до любого изменения окна
 * (старый код в этих условиях оставлял его на месте — красный), и без
 * анимации. Вторая проба — обратная сторона: клавиатура не пришла
 * (аппаратная), меню через `KEYBOARD_EXPECT_MS` возвращается.
 *
 * Оболочка — кукой `rf_native_shell`, как в `purchase-no-store-link.spec.ts`:
 * в приложении меню есть и у гостя (долг 192).
 */
const SHELL = [
  { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
  { name: "rf_shell_version", value: "13", domain: "localhost", path: "/" },
];

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function openLoginAsApp(page: import("@playwright/test").Page) {
  await page.context().addCookies(SHELL);
  await page.goto("/es/login");
  const nav = page.locator("nav.fixed.bottom-0");
  await expect(nav).toBeVisible();
  await expect(nav).toHaveClass(/translate-y-0/);
  return nav;
}

test("касание поля почты снимает нижнее меню до того, как клавиатура сожмёт окно (долг 246)", async ({ page }) => {
  const nav = await openLoginAsApp(page);
  const heightBefore = await page.evaluate(() => window.innerHeight);

  await page.locator("input[type=email]").tap();

  await expect(nav).toHaveClass(/translate-y-full/, { timeout: 500 });
  // Без анимации: съезжающая на виду полоса и была «прыжком».
  await expect(nav).toHaveClass(/transition-none/);
  await expect(nav).toHaveAttribute("data-rf-keyboard-hidden", "");
  // Окно не менялось — значит, меню сняло касание, а не сжатие окна.
  expect(await page.evaluate(() => window.innerHeight)).toBe(heightBefore);
});

test("если клавиатура не пришла, меню возвращается (долг 246)", async ({ page }) => {
  const nav = await openLoginAsApp(page);
  await page.locator("input[type=email]").tap();
  await expect(nav).toHaveClass(/translate-y-full/, { timeout: 500 });
  await expect(nav).toHaveClass(/translate-y-0/, { timeout: 4000 });
  await expect(nav).toHaveClass(/transition-transform/);
});
