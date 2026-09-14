import { test, expect } from "./helpers/test";

/**
 * ФОРМА ВХОДА НЕ СТИРАЕТ АДРЕС ПОЧТЫ — 7.195, часть 5.
 *
 * Владелец на видеозаписи прохода по приложению 14.09.2026 набрал адрес
 * ТРИ раза: при неверном пароле страница перерисовывалась и очищались оба
 * поля сразу. Форма — обычный `POST` на `/api/auth/login`, ответ —
 * перенаправление обратно на `/[lang]/login`, и всё, что не приехало в
 * запросе, терялось.
 *
 * Проверяется сценарий целиком, браузером, в обеих локалях:
 *   — адрес после неверного пароля непуст и равен набранному;
 *   — пароль пуст;
 *   — сообщение осталось прежним и по-прежнему не говорит, ЧТО не сошлось.
 *
 * Учётная запись здесь не нужна и намеренно не заводится: неверным
 * паролем к несуществующему адресу маршрут отвечает тем же самым
 * `invalid_credentials` — в этом и есть смысл общего сообщения.
 */
const CASES = [
  {
    lang: "es",
    emailLabel: "Correo electrónico",
    passwordLabel: "Contraseña",
    submit: "Iniciar sesión",
    error: "Correo o contraseña incorrectos.",
  },
  {
    lang: "ru",
    emailLabel: "Электронная почта",
    passwordLabel: "Пароль",
    submit: "Войти",
    error: "Неверный email или пароль.",
  },
] as const;

for (const c of CASES) {
  test(`/${c.lang}/login: неверный пароль оставляет адрес и чистит только пароль`, async ({ page }) => {
    const email = `e2e-login-keeps-${Date.now()}@example.test`;

    await page.goto(`/${c.lang}/login`);
    await page.getByLabel(c.emailLabel).fill(email);
    await page.getByLabel(c.passwordLabel).fill("definitely-not-the-password");
    await page.getByRole("button", { name: c.submit }).click();

    await expect(page).toHaveURL(/error=invalid_credentials/);

    // ГЛАВНОЕ УТВЕРЖДЕНИЕ: поле адреса непусто и несёт ровно то, что набрали.
    const emailField = page.getByLabel(c.emailLabel);
    await expect(emailField).not.toHaveValue("");
    await expect(emailField).toHaveValue(email);

    // Пароль не возвращается никогда — ни в поле, ни в адресе страницы.
    await expect(page.getByLabel(c.passwordLabel)).toHaveValue("");
    expect(page.url()).not.toContain("definitely-not-the-password");
    expect(page.url()).not.toContain("password=");

    // Сообщение прежнее и по-прежнему общее.
    await expect(page.getByText(c.error)).toBeVisible();
  });

  test(`/${c.lang}/login: пустая форма остаётся пустой`, async ({ page }) => {
    // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ к тесту выше: без предыдущей попытки поле
    // обязано быть пустым. Без него «поле непусто» доказывалось бы чем
    // угодно, включая подставленный по умолчанию адрес.
    await page.goto(`/${c.lang}/login`);
    await expect(page.getByLabel(c.emailLabel)).toHaveValue("");
    await expect(page.getByLabel(c.passwordLabel)).toHaveValue("");
  });
}
