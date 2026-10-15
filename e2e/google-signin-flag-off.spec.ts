import { test, expect } from "./helpers/test";

/**
 * ВХОД ЧЕРЕЗ GOOGLE ЗА ФЛАГОМ — заход 7.267.
 *
 * Пока владелец не завёл в Vercel GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET,
 * кнопок нет нигде, и сайт ведёт себя ровно как до захода. Сервер e2e этих
 * переменных не получает никогда (playwright.config.ts), поэтому здесь —
 * та самая «мерж без настроек»: страницы входа и регистрации в обеих
 * локалях, в браузере и в приложении (кука оболочки + версия 17, то есть
 * сборка С плагином), и все четыре маршрута — 404.
 *
 * Позитивный контроль селектора (с включённым флагом блок рисуется с тем же
 * `data-google-signin` и тем же текстом) — `src/components/auth/
 * GoogleSignInBlock.test.tsx`; поведение маршрутов с флагом —
 * `check:google-signin`.
 */
const PAGES = ["/es/login", "/es/register", "/ru/login", "/ru/register"];
const BUTTON_TEXT = /Continuar con Google|Войти через Google/;

for (const inApp of [false, true]) {
  for (const path of PAGES) {
    test(`флаг выключен: ${path} ${inApp ? "в приложении" : "в браузере"} — кнопки Google нет`, async ({ page, context }) => {
      if (inApp) {
        await context.addCookies([
          { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" },
          { name: "rf_shell_version", value: "17", domain: "localhost", path: "/" },
        ]);
      }
      await page.goto(path);
      // Страница действительно нарисовалась — иначе «нет кнопки» ничего не значит.
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator("[data-google-signin]")).toHaveCount(0);
      await expect(page.getByText(BUTTON_TEXT)).toHaveCount(0);
      await expect(page.locator('a[href^="/api/auth/google"]')).toHaveCount(0);
    });
  }
}

test("флаг выключен: маршруты входа через Google отвечают 404", async ({ request }) => {
  expect((await request.get("/api/auth/google/start?lang=es", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/api/auth/google/callback?code=x&state=y", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.post("/api/auth/google/nonce")).status()).toBe(404);
  expect(
    (await request.post("/api/auth/google/native", { data: { idToken: "x" }, headers: { "content-type": "application/json" } })).status()
  ).toBe(404);
});

/**
 * Контроль самих селекторов: на разметке С кнопкой (та же форма, что
 * отдаёт `GoogleSignInBlock` при включённом флаге — её дословно держит
 * `GoogleSignInBlock.test.tsx`) каждый находит ровно один элемент. Опечатка
 * в селекторе сделала бы отрицания выше вечнозелёными — здесь она красная.
 */
test("контроль: селекторы кнопки Google находят кнопку, когда она есть", async ({ page }) => {
  await page.setContent(
    '<div class="mt-6" data-google-signin="web"><a href="/api/auth/google/start?lang=es&amp;redirectTo=%2Fes%2Fprofile"><span>Continuar con Google</span></a></div>'
  );
  await expect(page.locator("[data-google-signin]")).toHaveCount(1);
  await expect(page.locator('a[href^="/api/auth/google"]')).toHaveCount(1);
  await expect(page.getByText(BUTTON_TEXT)).toHaveCount(1);
});
