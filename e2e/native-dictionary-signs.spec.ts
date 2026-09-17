import { test, expect } from "./helpers/test";
import { loginWithoutSubscription, loginWithSubscription } from "./helpers/auth";

/**
 * СЛОВАРЬ НА УРОВНЕ C1 — ТРИ НАХОДКИ ВЛАДЕЛЬЦА (7.195, части 1, 3, 4) И
 * СМЕНА ПРАВИЛА ПРО ВЕБ (долг 257, 18.09.2026).
 *
 * ЧТО ЗДЕСЬ БЫЛО СНЯТО 14.09.2026, после мержа #313:
 *   1. плашка замка на уровне C1 рисовалась ДВА РАЗА подряд;
 *   2. плитки тем на уровне C1 писали «0 слов» при непустом банке;
 *   3. корона и замок стояли вперемешку на одном и том же материале.
 *
 * ====================================================================
 * ЧТО ИМЕННО В ЭТОЙ СПЕКЕ ИЗМЕНИЛОСЬ 18.09.2026 И ПОЧЕМУ ЭТО НЕ ОТКАЗ ОТ
 * ПРОВЕРКИ
 * ====================================================================
 *
 * С 14.09.2026 здесь стоял отрицательный контроль, который утверждал
 * ОБРАТНОЕ сегодняшнему правилу: «веб не тронут: без куки оболочки ни
 * плашки, ни знаков на плитках нет». Он был верен и был нужен: правку
 * 7.195 требовалось удержать от растекания на серверную отдачу 23 страниц
 * словаря.
 *
 * Решением владельца от 18.09.2026 (долг 257) правило поменялось: в
 * браузере обязано быть ТО ЖЕ САМОЕ, что в приложении. Цена прежнего
 * правила названа замером 18.09.2026 на прод-сборке (три роли × две локали
 * × оболочка/веб = 12 экранов, ширина 384): внутри оболочки на C1 стоят 23
 * короны, 23 замка и сумма чисел на плитках 988, а в браузере у
 * бесплатного и у доступа по коду — 0 корон, 0 замков и сумма 0 при тех же
 * 988 строках банка. Один раздел выглядел пустым в браузере и полным в
 * приложении.
 *
 * ПОЭТОМУ УТВЕРЖДЕНИЕ НЕ УБРАНО, А РАЗВЁРНУТО. Ищется ТОТ ЖЕ селектор, на
 * том же экране, той же ролью — и он обязан найти РОВНО СТОЛЬКО ЖЕ, сколько
 * находит внутри оболочки. Проверка осталась двусторонней и стала строже:
 * прежде веб доказывал «ничего нет», и это проходило бы и на сломанном
 * экране, где нет вообще ничего; теперь веб доказывает РАВЕНСТВО двум
 * непустым числам, снятым в том же прогоне.
 *
 * Оболочка изображается кукой — тем признаком, которым её видит service
 * worker (разбор — в `native-shell-no-payments.spec.ts`).
 */
const SHELL_COOKIE = { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" };
const PLATE = "[data-testid=native-locked-notice]";
/** Знак сорта НА ПЛИТКЕ. */
const TILE_MARK = "[data-testid=category-tile] [data-access-mark]";
/** Знак состояния НА ПЛИТКЕ — ДРУГОЙ признак, не перепутать (долг 251). */
const TILE_LOCK = "[data-testid=category-tile] [data-access-locked]";

async function openVocabulary(page: import("@playwright/test").Page) {
  await page.goto("/ru/vocabulary");
  await expect(page.locator("[data-testid=category-tile]").first()).toBeVisible();
}

async function toC1(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "C1", exact: false }).click();
  // Числа приезжают ответом сервера; до него на месте числа заглушка, и
  // судить её значило бы судить «данных ещё нет» вместо «данных ноль».
  await expect(page.locator("[data-testid=tile-count-skeleton]")).toHaveCount(0);
}

/** Что видно на экране C1 — одним снимком, чтобы два места сравнивались
 *  числами одного прогона, а не числами из разных дней. */
async function snapshot(page: import("@playwright/test").Page) {
  return {
    tiles: await page.locator("[data-testid=category-tile]").count(),
    plates: await page.locator(PLATE).count(),
    marks: await page.locator(TILE_MARK).count(),
    locks: await page.locator(TILE_LOCK).count(),
    withBank: await page
      .locator("[data-testid=category-tile]")
      .evaluateAll((els) => els.filter((el) => Number(el.getAttribute("data-bank-total")) > 0).length),
    shown: await page
      .locator("[data-testid=category-tile]")
      .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-total")))),
    banks: await page
      .locator("[data-testid=category-tile]")
      .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-bank-total")))),
  };
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
  await toC1(page);

  const shot = await snapshot(page);
  expect(shot.tiles, "плитки есть — иначе проверять нечего").toBeGreaterThan(0);
  for (let i = 0; i < shot.tiles; i += 1) {
    if (shot.banks[i] > 0) {
      expect(shot.shown[i], `плитка ${i}: в банке ${shot.banks[i]}, а напечатано ${shot.shown[i]}`).toBeGreaterThan(0);
    }
  }
  // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: если банк пуст на всех плитках, цикл выше
  // ничего не проверил. Такой прогон обязан падать, а не считаться зелёным.
  expect(shot.withBank, "ни одной плитки с непустым банком — проверка пустая").toBeGreaterThan(0);
  /**
   * ЗНАК СТОИТ НА ВСЕХ ПЛИТКАХ, А НЕ ТОЛЬКО НА НЕПУСТЫХ — 7.196, часть 1.
   * 👑 — метка СОРТА материала, и весь уровень C1 премиальный независимо
   * от того, сколько строк лежит в конкретной теме и какая у смотрящего
   * роль. Замок рядом — СОСТОЯНИЕ: гостю C1 закрыт весь (долг 251).
   */
  expect(shot.marks).toBe(shot.tiles);
  /**
   * ЗАМОК — НА ПЛИТКАХ С НЕПУСТЫМ БАНКОМ, А НЕ НА ВСЕХ (правило захода
   * 7.208 про форму фикстуры CI).
   *
   * Корона — метка СОРТА и стоит на всех 23 плитках: весь уровень C1
   * премиальный независимо от того, лежит ли в конкретной теме хоть одна
   * строка. Замок — СОСТОЯНИЕ («вам не открыто»), и тема, в которой под
   * этим разрезом нет НИ ОДНОЙ строки, закрытой не является: закрывать
   * нечего.
   *
   * Первая редакция этой пробы требовала `locks === tiles`, и это было
   * утверждением про ДАННЫЕ прода (там C1 есть у всех 23 тем), а не про
   * правило. В базе CI карточки C1 лежат ровно в двух темах из 23, и
   * проба честно покраснела: 2 против 23. Поймано CI, не рассуждением.
   */
  expect(shot.locks).toBe(shot.withBank);
});

/**
 * ТО ЖЕ САМОЕ В БРАУЗЕРЕ — долг 257. Наследник прежнего «веб не тронут»:
 * тот же экран, та же роль, те же три селектора, и все три обязаны найти
 * РОВНО СТОЛЬКО ЖЕ, сколько нашли внутри оболочки в этом же прогоне.
 */
test("веб говорит то же, что приложение: плашка, короны, замки и числа совпадают", async ({ page, context }) => {
  await context.addCookies([SHELL_COOKIE]);
  await openVocabulary(page);
  await toC1(page);
  const inShell = await snapshot(page);
  expect(inShell.withBank, "внутри оболочки банк пуст — сравнивать нечего").toBeGreaterThan(0);
  expect(inShell.marks, "внутри оболочки знаков нет — сравнивать нечего").toBeGreaterThan(0);

  await context.clearCookies({ name: "rf_native_shell" });
  await openVocabulary(page);
  await toC1(page);
  const inWeb = await snapshot(page);

  expect(inWeb.tiles).toBe(inShell.tiles);
  expect(inWeb.plates).toBe(inShell.plates);
  expect(inWeb.marks).toBe(inShell.marks);
  expect(inWeb.locks).toBe(inShell.locks);
  expect(inWeb.shown).toEqual(inShell.shown);
});

/**
 * ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ СОРТА — он же доказывает, что «одинаково» не
 * означает «всегда со знаком». У плана Premium уровень C1 открыт: корона
 * остаётся (это сорт), а замка нет ни одного — и в браузере тоже.
 */
test("Premium: корона на C1 есть, замка нет — и в приложении, и в браузере", async ({ page, context }) => {
  await loginWithSubscription(page, { tier: "premium" });
  await context.addCookies([SHELL_COOKIE]);
  await openVocabulary(page);
  await toC1(page);
  const inShell = await snapshot(page);
  expect(inShell.marks).toBe(inShell.tiles);
  expect(inShell.locks).toBe(0);
  expect(inShell.plates).toBe(0);

  await context.clearCookies({ name: "rf_native_shell" });
  await openVocabulary(page);
  await toC1(page);
  const inWeb = await snapshot(page);
  expect(inWeb.marks).toBe(inShell.marks);
  expect(inWeb.locks).toBe(0);
  expect(inWeb.plates).toBe(0);
});
