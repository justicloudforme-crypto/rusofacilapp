import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";

/**
 * ПРИ ЖИВОЙ СЕТИ ОФЛАЙН-ЗАГЛУШКИ НЕ БЫВАЕТ — ЗАХОД 7.218.
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 20.09.2026 на проде, при работающем интернете:
 * страница рассказа на несколько секунд подменилась экраном «Estás sin
 * conexión — Вы не в сети», а на `/ru/profile` в консоли осталась одна
 * красная строка `no-response … at ee._handle (sw.js)`. Обе — это одно и
 * то же место воркера: `NetworkFirst` не дождался сети И не нашёл копии в
 * кеше; заглушка — то, что подставляется дальше.
 *
 * ЧЕГО ЭТА ПРОБА НЕ ДЕЛАЕТ И ПОЧЕМУ. Она не гоняет навигацию при
 * ВЫКЛЮЧЕННОЙ сети: `context.setOffline(true)` вместе с навигацией,
 * перехваченной воркером, под Playwright регулярно даёт «Navigation
 * interrupted by another navigation» при верном поведении браузера — это
 * записано в `e2e/offline.spec.ts` с августа и перемерено в 7.217.
 * Поэтому здесь меряется ровно то, что меряется надёжно: при ЖИВОЙ сети
 * заглушки не показывается ни разу, и при этом прибор, которым это
 * измерено, в том же прогоне доказывает, что заглушку он видеть умеет.
 */

const WALK = ["/ru", "/ru/courses", "/ru/stories", "/ru/glossary", "/es", "/es/courses", "/es/stories", "/es/word-games"];

/**
 * Признак каркаса без сети — его СОБСТВЕННАЯ метка, а не текст.
 *
 * До 23.09.2026 здесь стояла регулярка по словам «sin conexión» и «не в
 * сети». Заход 7.227 сделал надпись переменной: при живой сети тот же
 * экран говорит «страница не открылась», не утверждая о сети ничего
 * (долг 278). Проба по тексту с этого дня переставала бы видеть каркас
 * ровно тогда, когда он честен, — поэтому судим по `data-offline-shell`,
 * который экран ставит на `<body>` в любом состоянии.
 */
async function looksLikeOfflineScreen(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => document.body?.dataset.offlineShell === "1");
}

test("при живой сети офлайн-заглушка не показывается ни разу, и прибор это умеет видеть", async ({ page }) => {
  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  let walked = 0;
  let screens = 0;
  for (const path of WALK) {
    await page.goto(path);
    await expectPageIsItself(page, path, `живая сеть, ${path}`);
    if (await looksLikeOfflineScreen(page)) screens += 1;
    walked += 1;
  }
  expect(walked, "обойдено не столько адресов, сколько заявлено").toBe(WALK.length);
  expect(screens, `при живой сети показана офлайн-заглушка на ${screens} адресах из ${WALK.length}`).toBe(0);

  // ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ПРОГОНЕ: сам экран заглушки. Без него
  // «ни разу не показана» и «прибор слеп» читались бы одинаково.
  await page.goto("/offline.html");
  expect(await looksLikeOfflineScreen(page), "ПРИБОР СЛЕП: на самой заглушке он её не узнал").toBe(true);

  // И она говорит на ОДНОМ языке, а не на двух сразу. Адрес `/offline.html`
  // локали не называет — значит испанский, язык по умолчанию.
  const text = await page.evaluate(() => document.body.innerText);
  expect(text, "заглушка не на испанском там, где локаль неизвестна").toMatch(/[áéíóúñ]|pudimos|conexión/i);
  expect(text, "заглушка снова печатает две локали разом").not.toMatch(/[а-яё]/i);
});
