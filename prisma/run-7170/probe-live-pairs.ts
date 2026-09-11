/**
 * Заход 7.170, часть 4: живая проба пар на БОЕВОМ сайте, анонимом.
 *
 * Поверхностей у пары две, и они разные по природе:
 *   * `/es/vocabulary/sinonimos-y-antonimos` — СЕРВЕРНЫЙ HTML, только
 *     испанская локаль (маршрут зовёт `notFound()` для любой другой);
 *   * `/es/vocabulary` и `/ru/vocabulary` — обе локали, но пара рисуется
 *     ПОСЛЕ гидрации: `VocabularyApp` берёт карточки из `/api/flashcards`.
 *
 * Поэтому «в обеих локалях» проверяется на второй поверхности, а не на
 * первой: категорийной страницы под `/ru` в этом приложении нет вовсе.
 *
 * ВАЖНО ПРО КЕШ. Банк карточек лежит за общим кешем (`src/lib/flashcards/cache.ts`):
 * Redis на 5 минут плюс местный слой на 30 секунд. Проба сразу после записи
 * честно показывает СТАРЫЕ данные — это не отказ продукта, а возраст кеша;
 * повторять её надо не раньше чем через пять с половиной минут.
 *
 * Контроль слепоты (`--plant`): ищется пара у «безвкусного» — слова,
 * которому пару сознательно НЕ вписали. Проба обязана дать 0 находок.
 *
 *   npx tsx prisma/run-7170/probe-live-pairs.ts [--plant]
 */
const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "https://rusofacilapp.com";
const PLANT = process.argv.includes("--plant");

/** Слова из таблицы 7.169 — по одному на каждый вид записи. */
const WANTED = PLANT
  ? [{ word: "безвкусный", pair: "изысканный" }]
  : [
      { word: "болтливый", pair: "молчаливый" },
      { word: "неверный", pair: "правильный" },
      { word: "миролюбивый", pair: "враждебный" },
      { word: "нудный", pair: "скучный" },
      { word: "снисходительный", pair: "строгий" },
    ];

async function main(): Promise<number> {
  // --- поверхность 1: серверный HTML категории (только /es) ----------
  const html = await (await fetch(`${BASE}/es/vocabulary/sinonimos-y-antonimos`)).text();
  const serverFound = WANTED.filter((w) => html.includes(w.word) && html.includes(w.pair));
  console.log(`серверный HTML /es/vocabulary/sinonimos-y-antonimos: пара видна у ${serverFound.length} из ${WANTED.length}`);
  for (const w of WANTED) console.log(`  «${w.word}» → «${w.pair}»: ${html.includes(w.word) && html.includes(w.pair) ? "видна" : "НЕТ"}`);

  // --- поверхность 2: /es/vocabulary и /ru/vocabulary после гидрации --
  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await browser.newContext(devices["Pixel 5"]);
  const perLocale: Record<string, number> = {};
  for (const lang of ["es", "ru"]) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${lang}/vocabulary`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(4000);
    // Карточки живут в клиентском списке, поэтому ищем по видимому тексту
    // всей страницы уже ПОСЛЕ гидрации, а не в серверной разметке.
    let found = 0;
    for (const w of WANTED) {
      // Поиск ищет по всему банку, поэтому категорию выбирать не нужно —
      // и не нужно знать, как она названа в каждой локали.
      await page.locator("input").first().fill(w.word);
      await page.waitForTimeout(2500);
      const text = await page.evaluate(() => document.body.innerText);
      const ok = text.includes(w.word) && text.includes(w.pair);
      if (ok) found++;
      console.log(`  /${lang}/vocabulary «${w.word}» → «${w.pair}»: ${ok ? "видна" : "НЕТ"}`);
    }
    perLocale[lang] = found;
    await page.close();
  }
  await browser.close();
  console.log(`после гидрации: /es ${perLocale.es} из ${WANTED.length}, /ru ${perLocale.ru} из ${WANTED.length}`);

  if (PLANT) {
    const total = serverFound.length + perLocale.es + perLocale.ru;
    console.log(`[контроль слепоты] «безвкусный» без пары: находок ${total} (ожидание 0)`);
    return total === 0 ? 0 : 1;
  }
  const ok = serverFound.length === WANTED.length && perLocale.es === WANTED.length && perLocale.ru === WANTED.length;
  console.log(ok ? "PASS" : "ОТКАЗ");
  return ok ? 0 : 1;
}

main().then((c) => process.exit(c));
