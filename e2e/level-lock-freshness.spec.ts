import { expect, test } from "@playwright/test";
import { loginWithoutSubscription } from "./helpers/auth";

/**
 * ЗНАК ЗАМКА НА СТРАНИЦЕ УРОВНЯ ОБЯЗАН ГОВОРИТЬ ТО ЖЕ, ЧТО И СТРАНИЦА
 * УРОКА, — заход 7.226, задача 1.
 *
 * Наблюдение владельца 23.09.2026 (одно фото, без записи шагов): в
 * браузере у активного подписчика на `/ru/courses/a1` у уроков 2–8 стоял
 * знак «🔒 По подписке», хотя В САМ УРОК пускало; после перехода в
 * «Мой профиль» и обратно знаки пропали.
 *
 * Проба воспроизводит ровно эту форму: доступ выдаётся ВНЕ страницы (как
 * его выдаёт вебхук RevenueCat с телефона, а не действие в этой
 * вкладке), после чего страница уровня и страница урока спрашиваются
 * тремя разными способами перехода. Все три обязаны согласиться.
 */
const LOCK = "[data-access-mark]";

test.describe("страница уровня и страница урока судят о доступе одинаково", () => {
  test("знаки платного исчезают после выдачи доступа при любом способе перехода", async ({ page }) => {
    await loginWithoutSubscription(page);

    // 1. ДО выдачи доступа: знаки есть, и это точка отсчёта.
    await page.goto("/ru/courses/a1");
    const before = await page.locator(LOCK).count();
    expect(before, "у аккаунта без доступа на странице уровня обязаны быть знаки платного").toBeGreaterThan(0);

    // 2. Доступ выдан ВНЕ этой вкладки — так его выдаёт вебхук магазина.
    const granted = await page.context().request.post("/api/test/grant-subscription", { data: {} });
    expect(granted.ok()).toBe(true);

    // 3а. Полная перезагрузка — самый прямой способ спросить сервер.
    await page.goto("/ru/courses/a1");
    const afterReload = await page.locator(LOCK).count();

    // 3б. Переход КЛИЕНТСКИМ роутером: уходим по ссылке и возвращаемся
    //     по ссылке — ровно то, что делает человек в приложении и на
    //     сайте, и ровно тот путь, у которого есть свой кеш.
    await page.getByRole("link", { name: /Курсы|курсам/i }).first().click();
    await page.waitForURL("**/ru/courses");
    await page.getByRole("link", { name: /A1/ }).first().click();
    await page.waitForURL("**/ru/courses/a1");
    const afterClientNav = await page.locator(LOCK).count();

    // 3в. Кнопка «назад» браузера — у неё свой кеш и свои правила.
    await page.goBack();
    await page.waitForURL("**/ru/courses");
    await page.goForward();
    await page.waitForURL("**/ru/courses/a1");
    const afterBackForward = await page.locator(LOCK).count();

    expect(
      { afterReload, afterClientNav, afterBackForward },
      "после выдачи доступа знаков платного не должно остаться ни при одном способе перехода",
    ).toEqual({ afterReload: 0, afterClientNav: 0, afterBackForward: 0 });
  });
});
