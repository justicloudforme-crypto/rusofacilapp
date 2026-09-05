import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "./helpers/test";

/**
 * Каталоги рассказов и медиа обязаны давать ссылку на КАЖДЫЙ элемент, и
 * без JavaScript.
 *
 * Замер прода 05.09.2026 (PROGRESS.md 7.112): сплошной обход от корней
 * локалей нашёл 516 URL карты сайта без единого входящего ребра — 236
 * рассказов и 280 медиа. Механизм не пагинация: её у этих списков нет
 * вовсе. Оба каталога — клиентские компоненты с PAGE_SIZE = 24 и
 * состоянием `visibleCount`, «показать ещё» — это `onClick`, поэтому
 * сервер печатал ровно 24 якоря на каждой из четырёх страниц, при том что
 * данные всех карточек в HTML уже лежали.
 *
 * Анонимно и без JavaScript — ровно та поверхность, которую видит краулер.
 */
test.use({ javaScriptEnabled: false });

/** Единственный статический источник правды о медиатеке: каталог лежит в
 * коде, а не в базе, поэтому это число верно и на пустой базе CI. */
const MEDIA_IDS = Object.keys(
  JSON.parse(readFileSync(join(process.cwd(), "src/lib/media/mediaData.json"), "utf8")) as Record<string, unknown>,
);

async function hrefsUnder(page: import("@playwright/test").Page, testId: string, prefix: string) {
  const links = await page
    .locator(`[data-testid="${testId}"] a`)
    .evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname));
  return links.filter((h) => h.startsWith(prefix));
}

for (const lang of ["es", "ru"] as const) {
  test(`${lang}: медиатека даёт ссылку на каждый элемент без JavaScript`, async ({ page }) => {
    await page.goto(`/${lang}/media`);
    const links = await hrefsUnder(page, "media-link-index", `/${lang}/media/`);

    // Ровно все, по одному разу. Ни «больше 24», ни «примерно столько»:
    // выпавший элемент — это и есть тот дефект, который список чинит.
    expect(new Set(links).size).toBe(links.length);
    expect(links.sort()).toEqual(MEDIA_IDS.map((id) => `/${lang}/media/${id}`).sort());

    // И это заведомо больше, чем печатает сам каталог.
    expect(links.length).toBeGreaterThan(24);
  });

  test(`${lang}: каталог рассказов даёт ссылку на каждый рассказ без JavaScript`, async ({ page }) => {
    await page.goto(`/${lang}/stories`);
    const indexed = await hrefsUnder(page, "story-link-index", `/${lang}/stories/`);
    const all = (
      await page.locator("a").evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).pathname))
    ).filter((h) => new RegExp(`^/${lang}/stories/[^/]+$`).test(h));

    // Рассказы живут в базе, а база CI пуста — поэтому число здесь не
    // литерал, а инвариант: список покрывает ВСЁ, что страница вообще
    // упоминает ссылкой, включая карточки каталога. Пусто и там и там —
    // тоже согласие, а не тихий пропуск.
    expect(new Set(indexed).size).toBe(indexed.length);
    expect([...new Set(all)].sort()).toEqual([...new Set(indexed)].sort());
  });
}
