import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";

/**
 * «ВЫЙТИ НА ВСЕХ ОСТАЛЬНЫХ УСТРОЙСТВАХ» — ОСТАЛЬНЫЕ, А НЕ ЭТО — ЗАХОД 7.218.
 *
 * ЗАМЕР ВЛАДЕЛЬЦА 20.09.2026 на проде: нажатие уводило браузер на
 * `/api/auth/logout-everywhere`, вместо страницы показывался серый экран
 * Chrome «ERR_NETWORK_CHANGED», а после перезагрузки владельца выкидывало
 * на форму входа — при подписи «кроме этого устройства».
 *
 * Это одна беда, а не две: новый признак сеанса ЭТОГО устройства приезжал
 * заголовком `Set-Cookie` ответа на тот самый POST. Ответ потерян —
 * значит в базе версия сеанса увеличена, а на устройстве куки старая.
 *
 * Здесь это заперто двумя живыми окнами одного аккаунта: после нажатия
 * первое обязано остаться в кабинете, второе — уехать на вход. Обратный
 * контроль стоит в том же прогоне ДО нажатия: оба окна обязаны быть
 * живыми, иначе «второе умерло» ничего не доказывает.
 */
test("после «выйти на остальных устройствах» это окно живо, другое — нет", async ({ browser }) => {
  const first = await browser.newContext();
  const firstPage = await first.newPage();
  await loginWithSubscription(firstPage);

  // Второе окно — тот же аккаунт, отдельный контекст: свои куки, как на
  // другом устройстве. Куки берутся у первого, потому что вход один.
  const second = await browser.newContext({ storageState: await first.storageState() });
  const secondPage = await second.newPage();

  // Кнопка живёт во вкладке «Настройки», в разделе «Безопасность»
  // (гармошка, открыт один раздел за раз) — поэтому до неё надо дойти,
  // как доходит человек.
  await firstPage.goto("/ru/profile?tab=settings");
  await expectPageIsItself(firstPage, "/ru/profile", "кабинет, первое окно");
  // Приветствие дня — первое, что видит вошедший; пока оно открыто,
  // нажать в кабинете нельзя ничего (см. e2e/helpers/welcome-overlay.ts).
  await firstPage.getByRole("button", { name: "Продолжить" }).click();
  await firstPage.getByRole("button", { name: "Безопасность" }).click();
  await secondPage.goto("/ru/profile?tab=settings");
  await expectPageIsItself(secondPage, "/ru/profile", "кабинет, второе окно");

  // ОБРАТНЫЙ КОНТРОЛЬ: до нажатия живы ОБА.
  expect(new URL(firstPage.url()).pathname, "до нажатия первое окно уже не в кабинете").toBe("/ru/profile");
  expect(new URL(secondPage.url()).pathname, "до нажатия второе окно уже не в кабинете").toBe("/ru/profile");

  await firstPage.getByRole("button", { name: /остальных устройствах/i }).click();

  // Страница осталась на месте — человек не смотрит на пустой экран.
  await expect(firstPage.getByRole("status")).toContainText(/остальные устройства|разлогинен/i);
  expect(new URL(firstPage.url()).pathname, "нажатие увело браузер со страницы настроек").toBe("/ru/profile");

  // Это окно живо: перезагрузка снова показывает кабинет, а не вход.
  await firstPage.reload();
  expect(new URL(firstPage.url()).pathname, "это устройство выкинуло из аккаунта — ровно то, чего подпись обещает не делать").toBe(
    "/ru/profile",
  );

  // Другое окно — мертво.
  await secondPage.goto("/ru/profile");
  expect(new URL(secondPage.url()).pathname, "другое устройство осталось в аккаунте — кнопка не сделала того, ради чего нажата").toBe(
    "/ru/login",
  );

  await first.close();
  await second.close();
});
