import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { CACHE_BUDGET_BY_KEY } from "../src/lib/sw-cache-policy";

/**
 * ТОЛЬКО CHROMIUM, И ЭТО ЗАМЕР, А НЕ УДОБСТВО.
 *
 * Прогон 19.09.2026 на проекте `mobile-iphone` (WebKit, форма iPhone 13):
 * из 12 обойдённых адресов в кеше документов оказалось **2**, ещё один
 * лёг во всеохватный `others`, и расширение условия до
 * `request.destination === "document"` не поменяло ни одного числа. То
 * есть WebKit под Playwright навигации воркеру отдаёт не так — ровно та
 * же ненадёжность, что описана в `e2e/offline.spec.ts` с августа.
 * Мерить квоты кешей на движке, который до воркера навигацию не доводит,
 * значит мерить Playwright, а не продукт. Ограничение стоит в
 * `playwright.config.ts` (`testIgnore` у проекта `mobile-iphone`), а не
 * пропуском внутри теста: пропуск в отчёте — это красный прогон по
 * правилу `check:e2e-coverage`, и правильно.
 */
/**
 * СКОЛЬКО ВОРКЕР И ПРАВДА ДЕРЖИТ НА УСТРОЙСТВЕ — ДОЛГИ 75 И 76.
 *
 * ДОЛГ 75 дословно: «`rf-pages-rsc-prefetch` держит **139** записей против
 * объявленных 32 и не сжимается: перемерено через 20 секунд и после ещё
 * одной навигации — 139 каждый раз».
 *
 * ДОЛГ 76 дословно: «страничный кэш `others` держит 32 записи, и это ОБЩИЙ
 * счёт документов и статики: в замере среди 32 записей документов было 8,
 * а 24 — `.js`, `.css`, `.woff2` и `/_next/image` → … из 12 обойдённых
 * подряд адресов офлайн открылись **8**».
 *
 * ПОЧЕМУ ЗДЕСЬ СЧИТАЮТСЯ ЗАПИСИ, А НЕ ОТКРЫВАЕТСЯ ОФЛАЙН. Офлайн-навигация
 * под Playwright ненадёжна не по вине продукта, и это записано в
 * `e2e/offline.spec.ts` ещё в августе: `context.setOffline(true)` вместе с
 * навигацией, перехваченной воркером, регулярно даёт «Navigation
 * interrupted by another navigation» при верном поведении браузера. А
 * вопрос долга 76 — «остался ли документ на устройстве», и на него прямо
 * отвечает содержимое кеша. Замер выходит точнее исходного: он называет
 * не «открылось 8 из 12», а поимённо, какой адрес не сохранён.
 */

/** Те же двенадцать адресов, на которых замерен долг 76. Все открыты
 *  анониму: проба про кеш, а не про доступ.
 *
 * Страница цен входит в обход, но в кеше её быть НЕ ДОЛЖНО, и это не
 * исключение ради зелёного, а долг 179: платёжные поверхности воркер не
 * кеширует вовсе (`NetworkOnly` первой строкой в `src/app/sw.ts`), иначе
 * внутри нативной оболочки человеку достанется из кеша веб-касса,
 * которой магазины не прощают. Проба нашла это сама на первом же прогоне
 * 19.09.2026 — 11 документов из 12, не сохранена ровно `/es/pricing`. */
const WALK = [
  "/es",
  "/es/courses",
  "/es/courses/a1/1",
  "/es/stories",
  "/es/vocabulary",
  "/es/glossary",
  "/es/glossary/caso-nominativo",
  "/es/word-games",
  "/es/pricing",
  "/ru",
  "/ru/courses",
  "/ru/glossary",
];

interface CacheCensus {
  name: string;
  entries: string[];
}

/** Документы, лежащие в кеше документов прямо сейчас. */
async function documentsInCache(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(async () => {
    const name = (await caches.keys()).find((n) => /^rf-pages-(?!rsc-|others-)[a-z0-9]+$/.test(n));
    if (!name) return [];
    const cache = await caches.open(name);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
}

async function census(page: import("@playwright/test").Page): Promise<CacheCensus[]> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const out: { name: string; entries: string[] }[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      out.push({ name, entries: (await cache.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search) });
    }
    return out;
  });
}

/** Долг 179: эта страница не кешируется намеренно. */
const PAYMENT_PATH = "/es/pricing";

const isDocument = (path: string) => !path.startsWith("/_next/") && !/\.(js|css|woff2?|png|svg|ico|json|mp3)$/i.test(path);

test("воркер держит документы своим счётом и в пределах объявленного потолка", async ({ page }) => {
  // Бюджет: двенадцать загрузок плюс ожидание воркера.
  test.setTimeout(180_000);

  await page.goto("/es");
  await expectPageIsItself(page, "/es");

  // Ждём, пока воркер ВЛАДЕЕТ страницей: до этого он не видит ни одного
  // запроса, и считать было бы нечего. Ровно то же ожидание, которым
  // `check:silent-listen` не пользуется — оно и есть разница между
  // «разметка» и «что легло на устройство».
  const controlled = await page
    .waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.active) && navigator.serviceWorker.controller !== null;
    }, null, { timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  // Утверждение, а не пропуск: воркер, не взявший страницу под контроль,
  // — это отказ, а не «нечего мерить». Пропуск здесь прятал бы ровно тот
  // случай, ради которого проба написана.
  expect(controlled, "service worker не взял страницу под контроль за 60 с").toBe(true);

  for (const path of WALK) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} не ответила 200`).toBe(200);
    await expectPageIsItself(page, path);
  }
  /**
   * ПОВТОРНЫЕ ЗАХОДЫ — ТОЛЬКО НА ТО, ЧЕГО ЕЩЁ НЕТ В КЕШЕ, И ИХ ЧИСЛО ОГРАНИЧЕНО.
   *
   * `NetworkFirst` кладёт ответ в кеш ПОСЛЕ того, как отдал его человеку,
   * а сам воркер берёт страницу под контроль не мгновенно. Замер
   * 19.09.2026: в одиночном прогоне хватает двух обходов, а когда на той
   * же машине параллельно идут другие проекты Playwright, первые адреса
   * обхода успевают уехать мимо воркера — не сохранялись `/es` и
   * `/es/courses/a1/1`, то есть ровно начало списка.
   *
   * Поэтому обход повторяется адресно и СЧИТАННОЕ число раз. «Повторяй,
   * пока не сойдётся» здесь было бы враньём: непопавший документ стал бы
   * невидим, а именно он и есть предмет долга 76.
   */
  const ROUNDS = 5;
  let rounds = 1;
  let left: string[] = [];
  for (; rounds <= ROUNDS; rounds += 1) {
    const inCache = await documentsInCache(page);
    left = WALK.filter((path) => path !== PAYMENT_PATH && !inCache.some((p) => p === path || p === `${path}/`));
    if (left.length === 0) break;
    for (const path of left) await page.goto(path, { waitUntil: "domcontentloaded" });
    // Запись асинхронна: ответ ушёл, кладётся он следом.
    await page.waitForTimeout(500);
  }
  console.log(`  заходов до полного кеша документов: ${Math.min(rounds, ROUNDS)} из ${ROUNDS}`);

  /**
   * ДОКАЗАТЕЛЬСТВО, ЧТО ПОТОЛОК ДЕРЖИТСЯ, А НЕ ПРОСТО НЕ ДОСТИГНУТ.
   *
   * Двенадцать адресов дают предзагрузок меньше объявленного потолка, и
   * «54 против 64» само по себе ничего не доказывает: ровно так выглядел
   * бы и кеш вовсе без ограничения. Поэтому каталог ПРОКРУЧИВАЕТСЯ: Next
   * префетчит каждую ссылку, попавшую в окно, и на списке рассказов их
   * сотни. Ниже считается, сколько предзагрузок браузер и правда сделал,
   * и если это число больше потолка, а в кеше записей не больше его, —
   * потолок держится.
   */
  const prefetched = new Set<string>();
  page.on("request", (request) => {
    if (request.headers()["next-router-prefetch"] === "1") prefetched.add(new URL(request.url()).pathname);
  });
  for (const path of ["/es/stories", "/es/courses", "/es/word-games"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    for (let y = 0; y < 12; y += 1) {
      await page.evaluate((step) => window.scrollTo(0, step * 900), y);
      await page.waitForTimeout(300);
    }
  }
  console.log(`  предзагрузок браузер сделал: ${prefetched.size} разных адресов`);

  const caches_ = await census(page);
  expect(caches_.length, "кешей на устройстве 0 — воркер ничего не записал").toBeGreaterThan(0);

  // Имена отличаются СУФФИКСОМ отпечатка сборки, а префикс у всех общий
  // (`rf-pages-`), поэтому «начинается с» для кеша документов не годится:
  // под него попадают и `rf-pages-rsc-…`, и `rf-pages-others-…`.
  const byName = (re: RegExp) => caches_.find((c) => re.test(c.name));
  const html = byName(/^rf-pages-(?!rsc-|others-)[a-z0-9]+$/);
  const prefetch = byName(/^rf-pages-rsc-prefetch-/);
  const others = byName(/^rf-pages-others-/);

  for (const c of caches_) console.log(`  кеш ${c.name}: записей ${c.entries.length}`);

  // ── ДОЛГ 76: документы считаются отдельно и не вытесняются статикой ──
  expect(html, "кеша документов нет вовсе — документ снова лёг в общий others").toBeTruthy();
  const documents = html!.entries.filter((p) => isDocument(p));
  const cached = (path: string) => documents.some((p) => p === path || p === `${path}/`);
  const missing = WALK.filter((path) => path !== PAYMENT_PATH && !cached(path));
  console.log(`  документов в кеше ${documents.length} из ${WALK.length} обойдённых; не сохранены: ${missing.join(", ") || "нет"}`);
  expect(missing, `эти адреса воркер не сохранил, хотя они обойдены дважды:\n${missing.join("\n")}`).toEqual([]);

  // ДОЛГ 179 не отменён этой правкой: платёжная поверхность в кеше не
  // лежит, и это утверждается, а не подразумевается.
  expect(cached(PAYMENT_PATH), "страница цен попала в кеш — внутри оболочки из него достанется веб-касса (долг 179)").toBe(false);

  // Статика в кеше документов лежать не должна: весь смысл разделения в
  // том, что `.js` больше не вытесняет главную.
  const staticInHtml = html!.entries.filter((p) => !isDocument(p));
  expect(staticInHtml, `в кеше документов лежит статика:\n${staticInHtml.join("\n")}`).toEqual([]);

  // ── ДОЛГ 75: объявленный потолок и правда держится ──────────────────
  const budgets: [string, CacheCensus | undefined, number][] = [
    ["документы", html, CACHE_BUDGET_BY_KEY.html.maxEntries],
    ["предзагрузка", prefetch, CACHE_BUDGET_BY_KEY.rscPrefetch.maxEntries],
    ["прочее того же источника", others, CACHE_BUDGET_BY_KEY.others.maxEntries],
  ];
  for (const [what, cache, limit] of budgets) {
    if (!cache) continue;
    console.log(`  ${what}: ${cache.entries.length} записей при объявленных ${limit}`);
    expect(
      cache.entries.length,
      `${what} (${cache.name}): ${cache.entries.length} записей против объявленных ${limit} — ровно долг 75`,
    ).toBeLessThanOrEqual(limit);
  }

  // Потолок предзагрузки ДЕРЖИТСЯ, а не просто не достигнут: адресов
  // запрошено больше, чем он позволяет, а в кеше их не больше него.
  const prefetchLimit = CACHE_BUDGET_BY_KEY.rscPrefetch.maxEntries;
  expect(
    prefetched.size,
    `предзагрузок сделано ${prefetched.size} при потолке ${prefetchLimit} — нагрузки не хватило, чтобы проверить сам потолок`,
  ).toBeGreaterThan(prefetchLimit);
  expect(prefetch, "кеша предзагрузки нет вовсе").toBeTruthy();
  expect(
    prefetch!.entries.length,
    `предзагрузка: ${prefetch!.entries.length} записей против объявленных ${prefetchLimit} при ${prefetched.size} запрошенных — ровно долг 75`,
  ).toBeLessThanOrEqual(prefetchLimit);
});
