import { test, expect } from "./helpers/test";

/**
 * ВХОД ПОКАЗЫВАЕТ, ЧТО ЗАПРОС ПОШЁЛ — ДОЛГ 241, заход 7.206.
 *
 * Владелец снял 17.09.2026 на POCO, внутри оболочки: после нажатия
 * «Iniciar sesión» экран около трёх секунд не меняется ничем, и понять,
 * сработало нажатие или нет, неоткуда. Здесь проверяются обе половины
 * правки, и обе — в настоящем браузере:
 *
 *   1. ПРИЗНАК. Пока запрос летит, кнопка неактивна и называет
 *      происходящее словом «Entrando…».
 *   2. ОДИН ЗАПРОС. Второе нажатие (и второй Enter — тот же путь у
 *      человека с клавиатурой) второго запроса НЕ отправляет.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ идёт первым и обязателен: измеритель здесь —
 * счётчик POST-запросов, и счётчик, который никогда не видел двойки,
 * ничего не доказывает. Первая проверка отправляет форму ДВАЖДЫ по-
 * настоящему (с возвратом на страницу между попытками) и требует ровно
 * двух запросов. Если она когда-нибудь станет печатать единицу — сломан
 * прибор, а не продукт.
 *
 * ПОЧЕМУ ОТВЕТ — 204, А НЕ ЗАДЕРЖКА И НЕ ОБРЫВ. Это перебрано, а не
 * выбрано:
 *
 *   • ЗАДЕРЖКА не работает. Любое обращение к странице — и `locator`, и
 *     `expect` — Playwright откладывает до конца НАЧАТОЙ навигации, а
 *     отправка обычной формы и есть навигация. В журнале отказа это видно
 *     дословно: «waiting for … navigation to finish». То есть смотреть
 *     «пока летит» этими средствами нельзя вовсе.
 *   • ОБРЫВ (`route.abort()`) уводит браузер на свою страницу ошибки
 *     (`chrome-error://chromewebdata/`), и смотреть становится не на что.
 *   • 204 No Content — это ответ, на который браузер по стандарту
 *     НИКУДА НЕ УХОДИТ: навигация кончается, документ не меняется,
 *     страница остаётся ровно в том виде, в каком её застала отправка.
 *     Кнопка при этом стоит неактивная и читается «Entrando…» — то
 *     самое состояние, которого человек не видел три секунды.
 *
 * Запрос считается ушедшим по событию `request`, а не по ответу, — то
 * есть счётчик не зависит от того, чем перехват ответил.
 */
/** Неверный пароль намеренно: маршрут в обоих случаях возвращает 303 на
 *  ту же страницу, и ни одного аккаунта этот файл не заводит. */
const PASSWORD = "WrongPass123!";

function countPosts(page: import("@playwright/test").Page, path: string): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes(path)) seen.push(request.url());
  });
  return seen;
}

test("положительный контроль: две НАСТОЯЩИЕ отправки формы входа дают два запроса", async ({ page }) => {
  const posts = countPosts(page, "/api/auth/login");
  const email = `e2e-login-control-${Date.now()}@example.test`;

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/es/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(/\/es\/login\?/);
  }

  expect(posts.length).toBe(2);
});

test("вход: пока запрос летит, кнопка неактивна и говорит «Entrando…», а второй запрос не уходит", async ({ page }) => {
  const posts = countPosts(page, "/api/auth/login");
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 204 }));

  await page.goto("/es/login");
  await page.getByLabel("Correo electrónico").fill(`e2e-login-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  // До гидратации форму отправляет ОДИН браузер, и замка нет ни на миг:
  // слушатель ещё не повешен. Атрибут `data-auth-submit` появляется ровно
  // тогда, когда он повешен, и ждать здесь надо именно его — иначе
  // проверка мерила бы скорость сборки страницы, а не правку.
  await expect(page.locator('[data-auth-submit="ready"]')).toBeVisible();
  // НАЖАТИЕ НЕ ДОЖИДАЕТСЯ — И ЭТО НЕ МЕЛОЧЬ. `click()` возвращает
  // управление только после того, как начатая им навигация закончилась,
  // а нам нужно посмотреть на кнопку ИМЕННО ПОКА запрос летит. Первая
  // редакция проверки ждала нажатие и оттого читала уже СЛЕДУЮЩУЮ
  // страницу, где кнопка, разумеется, снова обычная.
  await page.getByRole("button", { name: "Iniciar sesión" }).click().catch(() => {});

  // 1. Признак виден человеку.
  const pending = page.getByRole("button", { name: "Entrando…" });
  await expect(pending).toBeVisible();
  await expect(pending).toBeDisabled();

  // 2. Второе нажатие — тем путём, которым оно и бывает у человека с
  // клавиатурой: Enter в поле пароля. Неактивная кнопка его не ловит, и
  // без `preventDefault` форма ушла бы второй раз.
  await page.locator('input[name="password"]').press("Enter").catch(() => {});
  await page.locator('input[name="email"]').press("Enter").catch(() => {});

  // Страница осталась той же — обрыв навигации её не сменил.
  await expect(page).toHaveURL(/\/es\/login$/);
  expect(posts.length).toBe(1);
});

test("регистрация: двойная отправка — один запрос", async ({ page }) => {
  const posts = countPosts(page, "/api/auth/register");
  await page.route("**/api/auth/register", (route) => route.fulfill({ status: 204 }));

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(`e2e-register-double-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña").fill("TestPass123!");
  await expect(page.locator('[data-auth-submit="ready"]')).toBeVisible();
  await page.getByRole("button", { name: "Crear cuenta" }).click().catch(() => {});

  await expect(page.getByRole("button", { name: "Creando cuenta…" })).toBeDisabled();
  await page.locator('input[name="password"]').press("Enter").catch(() => {});

  expect(posts.length).toBe(1);
});
