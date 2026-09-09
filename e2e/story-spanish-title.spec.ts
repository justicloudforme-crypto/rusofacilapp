import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./helpers/test";

/**
 * Испанское название рассказа — первой строкой, русский оригинал под ним
 * мельче. Проверяется в браузере, потому что вопрос про ВИД страницы.
 *
 * Три состояния, и каждое утверждается отдельно (правило долга 94: проба
 * обязана уметь покраснеть, а «испанского названия не видно» и «страницы
 * нет вовсе» — это разные ответы, которые обязаны отличаться):
 *
 *   1. `titleEs` есть, рассказ не заморожен → на `/es` ДВЕ строки, в
 *      правильном порядке, вторая измеримо мельче первой;
 *   2. `titleEs` пуст → второй строки НЕТ ВОВСЕ, и `<h1>` знак в знак тот
 *      же, что был до появления колонки;
 *   3. рассказ в заморозке эксперимента → новой подачи он не получает,
 *      хотя `titleEs` у него записан. Именно «хотя»: если бы фикстура
 *      держала здесь пустое поле, утверждение проходило бы само собой и
 *      про заморозку не говорило бы ничего. Поэтому наличие данных
 *      читается ИЗ ФАЙЛА ФИКСТУРЫ и проверяется до всякого перехода.
 *
 * `/ru` не меняется вовсе — там русское название и есть название.
 */

interface FixtureStory {
  id: string;
  title: string;
  titleEs: string | null;
  level: string;
}

const STORIES: FixtureStory[] = JSON.parse(
  readFileSync(join(process.cwd(), "e2e/fixtures/stories.json"), "utf8"),
);

const byId = (id: string): FixtureStory => {
  const row = STORIES.find((s) => s.id === id);
  if (!row) throw new Error(`фикстура рассказов потеряла строку ${id} — проверять было бы нечего`);
  return row;
};

const WITH_ES = byId("e2e-fixture-story-camaleon");
const WITHOUT_ES = byId("e2e-fixture-story-primera-nieve");
const FROZEN = byId("e2e-fixture-story-dia-de-colada");

/** Размер шрифта и порядок в DOM — числами, а не по имени класса. Класс
 * может существовать и ничего не значить (долг 94, находка №1: селектор
 * `bg-foreground/15` не совпадал ни с чем НИКОГДА). */
async function titleShape(page: import("@playwright/test").Page, scope: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    const primary = root.querySelector('[data-testid="story-title-primary"]');
    const original = root.querySelector('[data-testid="story-title-original"]');
    const px = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
    return {
      primaryText: primary?.textContent ?? null,
      originalText: original?.textContent ?? null,
      primaryPx: px(primary),
      originalPx: px(original),
      // Порядок в документе: оригинал обязан идти ПОСЛЕ, иначе «первой
      // строкой» неправда даже при верных строках.
      originalIsAfterPrimary:
        primary && original
          ? !!(primary.compareDocumentPosition(original) & Node.DOCUMENT_POSITION_FOLLOWING)
          : null,
      wholeText: (root.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  }, scope);
}

test.describe("испанское название рассказа", () => {
  test("es: испанское название первой строкой, русский оригинал под ним мельче", async ({ page }) => {
    expect(WITH_ES.titleEs, "фикстура обязана держать рассказ С испанским названием").toBeTruthy();
    const response = await page.goto(`/es/stories/${WITH_ES.id}`);
    expect(response?.status(), `страница ${WITH_ES.id} обязана отвечать 200, а не «просто не показывать название»`).toBe(200);

    const shape = await titleShape(page, "h1");
    expect(shape, "на странице нет <h1> вовсе").not.toBeNull();
    expect(shape!.primaryText).toBe(WITH_ES.titleEs);
    expect(shape!.originalText).toBe(WITH_ES.title);
    expect(shape!.originalIsAfterPrimary).toBe(true);
    // «Мельче» — это измеренные пиксели, а не обещание класса.
    expect(shape!.originalPx).toBeGreaterThan(0);
    expect(shape!.originalPx!).toBeLessThan(shape!.primaryPx!);
    // И обе строки на месте целиком: заголовок читается как одно целое.
    expect(shape!.wholeText).toBe(`${WITH_ES.titleEs}${WITH_ES.title}`);

    // Вкладка браузера и выдача поиска говорят то же самое.
    await expect(page).toHaveTitle(new RegExp(`^${WITH_ES.titleEs!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} —`));
  });

  test("es: у рассказа без испанского названия второй строки нет вовсе", async ({ page }) => {
    expect(WITHOUT_ES.titleEs, "фикстура обязана держать рассказ БЕЗ испанского названия").toBeFalsy();
    const response = await page.goto(`/es/stories/${WITHOUT_ES.id}`);
    expect(response?.status()).toBe(200);

    const shape = await titleShape(page, "h1");
    expect(shape).not.toBeNull();
    // Знак в знак то, что печаталось до появления колонки.
    expect(shape!.wholeText).toBe(WITHOUT_ES.title);
    expect(shape!.primaryText).toBe(WITHOUT_ES.title);
    expect(shape!.originalText).toBeNull();
    expect(await page.locator('[data-testid="story-title-original"]').count()).toBe(0);
  });

  test("es: замороженный рассказ новой подачи не получил, хотя испанское название у него записано", async ({ page }) => {
    // Утверждение о заморозке имеет смысл ровно тогда, когда данные для
    // новой подачи есть. Без этой строки проба зеленела бы на пустом поле.
    expect(FROZEN.titleEs, "фикстура обязана держать ЗАМОРОЖЕННЫЙ рассказ С испанским названием").toBeTruthy();
    const response = await page.goto(`/es/stories/${FROZEN.id}`);
    expect(response?.status()).toBe(200);

    const shape = await titleShape(page, "h1");
    expect(shape).not.toBeNull();
    expect(shape!.wholeText).toBe(FROZEN.title);
    expect(shape!.originalText).toBeNull();
    // И заодно: испанская строка не просочилась ни в один угол страницы.
    expect(await page.getByText(FROZEN.titleEs!, { exact: false }).count()).toBe(0);
    await expect(page).toHaveTitle(new RegExp(`^${FROZEN.title} —`));
  });

  test("ru: на русской локали ничего не изменилось ни у одного из трёх", async ({ page }) => {
    for (const story of [WITH_ES, WITHOUT_ES, FROZEN]) {
      const response = await page.goto(`/ru/stories/${story.id}`);
      expect(response?.status(), `/ru/stories/${story.id}`).toBe(200);
      const shape = await titleShape(page, "h1");
      expect(shape, `/ru/stories/${story.id}: нет <h1>`).not.toBeNull();
      expect(shape!.wholeText, `/ru/stories/${story.id}`).toBe(story.title);
      expect(shape!.originalText, `/ru/stories/${story.id}`).toBeNull();
    }
  });

  test("es: каталог печатает обе строки на карточке и в серверном указателе", async ({ page }) => {
    await page.goto("/es/stories");

    // Указатель — серверный, и он обязан назвать все три рассказа
    // фикстуры: иначе «две строки в указателе» проверялось бы на пустом
    // списке (ровно долг 94, находка №9).
    const index = page.locator('[data-testid="story-link-index"]');
    await expect(index).toBeVisible();
    const indexed = await index.locator("a").evaluateAll((els) =>
      els.map((el) => ({
        href: new URL((el as HTMLAnchorElement).href).pathname,
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
        original: el.querySelector('[data-testid="story-title-original"]')?.textContent ?? null,
      })),
    );
    expect(indexed.length).toBe(STORIES.length);
    for (const story of STORIES) {
      const row = indexed.find((r) => r.href === `/es/stories/${story.id}`);
      expect(row, `указатель не назвал ${story.id}`).toBeTruthy();
      const showsEs = !!story.titleEs && story.id !== FROZEN.id;
      expect(row!.text, story.id).toBe(showsEs ? `${story.titleEs}${story.title}` : story.title);
      expect(row!.original, story.id).toBe(showsEs ? story.title : null);
    }

    // Карточка каталога — то же правило. Ищем именно карточку, а не
    // ссылку указателя: у них разные ветки кода.
    const card = page.locator(`a[href="/es/stories/${WITH_ES.id}"]`).first();
    await expect(card).toBeVisible();
    const cardTitle = card.locator('[data-testid="story-title"]');
    await expect(cardTitle.locator('[data-testid="story-title-primary"]')).toHaveText(WITH_ES.titleEs!);
    await expect(cardTitle.locator('[data-testid="story-title-original"]')).toHaveText(WITH_ES.title);
  });

  test("es: поиск находит рассказ и по испанскому названию, и по русскому", async ({ page }) => {
    for (const query of [WITH_ES.titleEs!, WITH_ES.title]) {
      const res = await page.request.get(`/api/search?q=${encodeURIComponent(query)}&lang=es`);
      expect(res.status(), `запрос «${query}»`).toBe(200);
      const body = (await res.json()) as {
        sections?: Array<{ section: string; hits: Array<{ href: string; title: string }> }>;
      };
      const stories = body.sections?.find((s) => s.section === "story")?.hits ?? [];
      const hit = stories.find((h) => h.href.endsWith(`/stories/${WITH_ES.id}`));
      expect(hit, `запрос «${query}» не нашёл рассказ`).toBeTruthy();
      // Печатается испанское — то же, что видно на странице.
      expect(hit!.title).toBe(WITH_ES.titleEs);
    }
  });
});
