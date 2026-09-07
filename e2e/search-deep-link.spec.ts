import { test, expect } from "./helpers/test";
import type { Page } from "@playwright/test";
import { loginWithSubscription } from "./helpers/auth";
import cardFixture from "./fixtures/flashcards.json";
import idiomFixture from "./fixtures/idioms.json";

/**
 * Строка выдачи обязана доводить до САМОГО объекта, а не до раздела.
 *
 * Что чинилось. Жалоба владельца 06.09.2026: человек вводит слово,
 * получает список конкретных совпадений, нажимает — и попадает в общий
 * словарь, то есть ровно туда же, куда ведёт пункт меню. Перепись 7.133
 * назвала цену числом: на себя вели 901 строка из 10 720, а у 5771
 * карточки и 771 идиомы своего адреса не было ни одного.
 *
 * Чем это починено и чем НЕ починено. Новых адресов не заведено ни одного
 * (решение владельца): строка ведёт на существующую страницу плюс якорь —
 * `#card-<id>` на тематической странице словаря, `#idiom-<id>` во вкладке
 * идиом. Хеш браузер на сервер не отправляет, поэтому ни sitemap, ни
 * canonical, ни краулимое множество от него не меняются.
 *
 * Почему проверок именно двадцать. Столько объектов держит база в форме
 * CI: 8 карточек `greetings` и 12 идиом трёх категорий
 * (e2e/fixtures/*.json). Каждая проверка — отдельный запрос, и от каждой
 * требуется не «страница открылась», а «объект в поле зрения»: адрес
 * несёт якорь, элемент с этим `id` помечен `data-deep-link-focus` и
 * действительно попал во вьюпорт. Именно это отличает починку от
 * прежнего поведения — прежде страница тоже открывалась.
 *
 * Названия берутся из тех же фикстур, что кладёт в базу
 * scripts/seed-e2e-fixture.mjs, а не вписаны сюда: это настоящие
 * продовые строки, поэтому те же слова и фразы есть и в полной локальной
 * `dev.db`. Ни одного `id` тест не знает — он спрашивает фразу и требует
 * фразу; иначе прогон на полной базе (где у тех же строк другие `id`)
 * проверял бы совпадение идентификаторов, а не доводку.
 */

const RESULTS = '[data-testid="global-search-results"]';
const FOCUSED = "[data-deep-link-focus]";

async function openSearch(page: Page, lang: "es" | "ru") {
  await page.goto(`/${lang}`);
  await page.getByRole("button", { name: lang === "es" ? "Buscar" : "Поиск" }).click();
  await expect(page.locator(RESULTS)).toBeVisible();
}

/** Первая строка нужного раздела выдачи. */
function firstHit(page: Page, section: "flashcard" | "idiom") {
  return page.locator(`[data-testid="search-section-${section}"] [data-testid="search-result"]`).first();
}

/**
 * Один контрольный запрос: ввести точную строку, уйти по первой строке
 * раздела и потребовать объект в поле зрения.
 *
 * Утверждений три, и ни одно не лишнее: адрес с якорем доказывает, что
 * ссылка несёт объект; `data-deep-link-focus` — что страница этот якорь
 * прочитала; `toBeInViewport` — что объект действительно виден, а не
 * лежит на семьсот пикселей ниже сгиба. Без третьего «доведено» значило
 * бы ровно то же, что значило до правки.
 */
async function expectLeadsToObject(
  page: Page,
  section: "flashcard" | "idiom",
  query: string,
  anchorPrefix: string,
) {
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill(query);
  const hit = firstHit(page, section);
  await expect(hit).toBeVisible();
  await hit.click();
  await page.waitForURL(new RegExp(`#${anchorPrefix}`));

  const focused = page.locator(FOCUSED);
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeVisible();
  await expect(focused).toContainText(query);
  await expect(focused).toBeInViewport();
}

test.describe("карточка словаря доводится до себя", () => {
  for (const card of cardFixture) {
    test(`«${card.russian}» открывает страницу темы с этой карточкой в поле зрения`, async ({ page }) => {
      // Аноним намеренно: тематические страницы словаря A1–B2 открыты
      // всем, и доводка обязана работать без подписки.
      await expectLeadsToObject(page, "flashcard", card.russian, "card-");
    });
  }
});

test.describe("идиома доводится до себя", () => {
  for (const idiom of idiomFixture) {
    test(`«${idiom.phrase}» раскрывается во вкладке идиом`, async ({ page }) => {
      // Подписка обязательна и это не удобство теста: неоплатившему
      // `/api/idioms` отдаёт пять фраз из всего банка, а `literary` режет
      // ещё и у подписчика `standard`. Премиум — единственный уровень, на
      // котором доводке есть до чего доводить в каждом из двенадцати
      // случаев.
      await loginWithSubscription(page, { tier: "premium" });
      await expectLeadsToObject(page, "idiom", idiom.phrase, "idiom-");
    });
  }
});

test("контроль: без якоря на странице не подсвечено ничего", async ({ page }) => {
  // Отрицательная половина. Без неё «нашли подсвеченный элемент» не
  // доказывало бы, что подсветку поставил якорь: страница могла бы
  // помечать что-нибудь всегда.
  await page.goto("/es/vocabulary/saludos");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(FOCUSED)).toHaveCount(0);
});

test("контроль: чужой якорь не подсвечивает ничего и не ломает страницу", async ({ page }) => {
  await page.goto("/es/vocabulary/saludos#card-нет-такой-карточки");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(FOCUSED)).toHaveCount(0);
});

test("платное остаётся платным: закрытая идиома помечена в выдаче и без подписки не открывается", async ({
  page,
}) => {
  const literary = idiomFixture.find((idiom) => idiom.category === "literary")!;
  await openSearch(page, "es");
  await page.getByRole("searchbox").fill(literary.phrase);

  const hit = firstHit(page, "idiom");
  await expect(hit).toBeVisible();
  // Пометка обязана стоять В ВЫДАЧЕ: человек должен знать про подписку до
  // нажатия, а не после.
  await expect(hit.locator('[data-testid="search-result-locked"]')).toBeVisible();

  await hit.click();
  await page.waitForURL(/#idiom-/);
  // Адрес тот же, что у подписчика, — поиск не прячет от неоплатившего
  // сам факт существования фразы. А вот фразы на странице нет, и вместо
  // молчания страница говорит почему.
  await expect(page.getByText(/se abre con la suscripción/i)).toBeVisible();
  await expect(page.locator(FOCUSED)).toHaveCount(0);
});

test("та же закрытая идиома с подпиской открывается по тому же адресу", async ({ page }) => {
  // Вторая половина пары. Порознь ни одна из них ничего не доказывает:
  // «не открылось» без «открывается» — это и сломанная доводка тоже.
  const literary = idiomFixture.find((idiom) => idiom.category === "literary")!;
  await loginWithSubscription(page, { tier: "premium" });
  await expectLeadsToObject(page, "idiom", literary.phrase, "idiom-");
});

test("на /ru идиома доводится до себя, а карточка словаря — нет, и это видно по адресу", async ({
  page,
}) => {
  // Положение русской локали, замеренное, а не объявленное:
  // тематических страниц словаря на `/ru` нет вовсе
  // (`if (lang !== "es") notFound()` в [categoria]/page.tsx, старое
  // осознанное решение), поэтому карточке не за что зацепиться и её
  // строка ведёт на словарь без якоря. Вкладка идиом на `/ru` есть — и
  // доводка там работает.
  await loginWithSubscription(page, { tier: "premium" });
  const idiom = idiomFixture[0];
  await openSearch(page, "ru");
  await page.getByRole("searchbox").fill(idiom.phrase);
  const idiomHit = firstHit(page, "idiom");
  await expect(idiomHit).toBeVisible();
  await idiomHit.click();
  await page.waitForURL(/\/ru\/vocabulary\?mode=idioms#idiom-/);
  await expect(page.locator(FOCUSED)).toHaveCount(1);
  await expect(page.locator(FOCUSED)).toBeInViewport();

  await openSearch(page, "ru");
  await page.getByRole("searchbox").fill(cardFixture[0].russian);
  const cardHit = firstHit(page, "flashcard");
  await expect(cardHit).toBeVisible();
  const href = await cardHit.getAttribute("href");
  expect(href).toBe("/ru/vocabulary");
});
