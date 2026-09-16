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

/**
 * ДОЛГИ 184–189, ЗАХОД 7.193 — ТРИ РОЛИ, А НЕ ОДНА.
 *
 * Чего не хватало пробам выше. Все они шли либо совсем без учётной записи,
 * либо со случайной: вопрос «что видит аккаунт БЕЗ подписки» не задавал
 * никто. А владелец снял на живом телефоне именно его: под каждым уровнем
 * курса в кабинете и на трёх вкладках закрытого урока стояла кнопка
 * «Смотреть тарифы» — аккаунту без подписки, внутри приложения.
 */
test("аккаунту БЕЗ подписки внутри оболочки не показывают ни одной платной кнопки", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies([SHELL_COOKIE]);

  // Кабинет: список курсов живёт на вкладке «Прогресс» — без `?tab=` его в
  // ответе нет вовсе, и поэтому его не видела ни одна прежняя проверка.
  await page.goto("/ru/profile?tab=progress");
  await expect(page.getByText("Смотреть тарифы")).toHaveCount(0);
  await expect(page.locator('a[href*="/pricing"]')).toHaveCount(0);
  // Положительное утверждение: сам список курсов на месте, то есть
  // проверка выше смотрела на страницу, а не в пустоту.
  await expect(page.getByRole("link", { name: "Начать" }).first()).toBeVisible();

  // Закрытый урок: три вкладки, на каждой стояла кнопка.
  await page.goto("/ru/courses/a1/2");
  await expect(page.getByText("Смотреть тарифы")).toHaveCount(0);
  await expect(page.locator('a[href*="/pricing"]')).toHaveCount(0);
  // Три карточки — по одной на закрытую вкладку. Именно `toHaveCount`, а
  // не `toBeVisible`: страница кладёт в разметку ВСЕ вкладки сразу и
  // прячет неактивные классом `hidden` (так их видит поисковик), поэтому
  // видима из трёх ноль, пока человек не переключит вкладку.
  await expect(page.getByText("Эта часть курса закрыта в этой версии приложения.")).toHaveCount(3);
  await page.getByRole("tab", { name: /Словарь|Vocabulario/ }).click();
  // Переключились — и теперь ровно одна из трёх видима, и это она.
  await expect(page.locator(".paywall-lock:visible")).toHaveCount(1);
  await expect(page.locator(".paywall-lock:visible")).toContainText(
    "Эта часть курса закрыта в этой версии приложения.",
  );

  // Реферальный блок обещал 30 дней за чужую подписку и вёл на сайт.
  await page.goto("/ru/profile?tab=overview");
  await expect(page.getByText("Приглашайте и получайте")).toHaveCount(0);

  // Подвал предлагал скачать приложение тому, кто уже в приложении.
  await expect(page.getByRole("link", { name: "Скачать приложение" })).toHaveCount(0);
});

test("в вебе тот же аккаунт без подписки видит платные кнопки на месте — контроль слепоты", async ({ page }) => {
  await loginWithoutSubscription(page);

  await page.goto("/ru/profile?tab=progress");
  await expect(page.getByText("Смотреть тарифы").first()).toBeVisible();

  await page.goto("/ru/courses/a1/2");
  await expect(page.locator('a[href*="/pricing"]').first()).toBeAttached();

  await page.goto("/ru/profile?tab=overview");
  await expect(page.getByText("Приглашайте и получайте")).toBeVisible();
  await expect(page.getByRole("link", { name: "Скачать приложение" })).toBeVisible();
});

/**
 * ДОЛГ 185. Закрытый УРОК обязан вести себя как закрытый РАССКАЗ: окно
 * «Этот материал закрыт» и одна кнопка «Понятно», а не страница с
 * вкладками. Две разные реакции на одно и то же положение дел человек
 * читает как два разных положения дел.
 */
test("внутри оболочки тап по закрытому УРОКУ открывает то же окно, что и тап по рассказу", async ({ page, context }) => {
  await loginWithoutSubscription(page);
  await context.addCookies([SHELL_COOKIE]);

  await page.goto("/ru/courses/a1");
  await page.locator('a[href="/ru/courses/a1/2"]').first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Этот материал закрыт" })).toBeVisible();
  // Никуда не ушли: адрес прежний, как и у закрытого рассказа.
  await expect(page).toHaveURL(/\/ru\/courses\/a1$/);
  await dialog.getByText("Понятно", { exact: true }).click();
  await expect(dialog).toBeHidden();
});

/** ДОЛГ 187. Быстрый список и выдача по набранному слову — РАЗНЫЕ места, и
 *  7.192 закрыл только первое. */
test("внутри оболочки поиск не находит страницу цен по слову «Цены»", async ({ page, context }) => {
  await context.addCookies([SHELL_COOKIE]);
  const shell = await page.request.get("/api/search?q=%D0%A6%D0%B5%D0%BD%D1%8B&lang=ru");
  const shellBody = (await shell.json()) as { sections: { hits: { href: string }[] }[] };
  const shellHrefs = shellBody.sections.flatMap((s) => s.hits.map((h) => h.href));
  expect(shellHrefs).not.toContain("/ru/pricing");
  // Контроль слепоты: поиск вообще что-то нашёл, и в вебе нашёл именно её.
  expect(shellHrefs.length).toBeGreaterThan(0);

  await context.clearCookies({ name: "rf_native_shell" });
  const web = await page.request.get("/api/search?q=%D0%A6%D0%B5%D0%BD%D1%8B&lang=ru");
  const webBody = (await web.json()) as { sections: { hits: { href: string }[] }[] };
  expect(webBody.sections.flatMap((s) => s.hits.map((h) => h.href))).toContain("/ru/pricing");
});
