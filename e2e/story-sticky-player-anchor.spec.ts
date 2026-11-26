import { devices } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";

/**
 * ПРИЛИПШИЙ ПЛЕЕР НЕ ДЁРГАЕТ СТРАНИЦУ И НЕ ЗАКРЫВАЕТ КАРТОЧКУ СЛОВА —
 * ДОЛГ 427, ЗАХОД 7.313.
 *
 * Петля (замер 7.313 на проде, профиль Pixel 7, «Снегурочка»): плеер,
 * прилипая, сжимается на ≈15 px → Chrome якорит прокрутку и сдвигает
 * страницу на те же ≈15 px → метка над плеером снова в экране → плеер
 * отлипает, растёт → сдвиг обратно → … `scrollY` 515↔528, а обработчик
 * прокрутки `StoryText.tsx` закрывает карточку перевода через ≈30 мс.
 * Починка — `overflow-anchor: none` на странице рассказа (`globals.css`).
 *
 * Проба ставит страницу ровно на границу петли: метка над плеером на 1 px
 * за верхом экрана. До правки — `scrollY` скачет и карточка закрыта через
 * 1,5 с; после — стоит, карточка открыта.
 *
 * ТОЛЬКО CHROMIUM (из `mobile-iphone` снят в `playwright.config.ts`):
 * петля — от якорения прокрутки Chromium (Android — сайт и приложение);
 * в WebKit проба до и после правки одинакова, петли там не было.
 */

// Без `defaultBrowserType`: движок задаёт проект `chromium`; из
// `mobile-iphone` файл снят в `playwright.config.ts` (`testIgnore`).
const { defaultBrowserType: _engine, ...pixel7 } = devices["Pixel 7"];
void _engine;
test.use(pixel7);

const STORY_TITLE = "Снегурочка";

test("плеер, прилипший на границе, стоит, и карточка слова не закрывается", async ({ page }) => {

  await page.goto("/es/stories");
  const link = page.locator('a[href^="/es/stories/"]').filter({ hasText: STORY_TITLE }).first();
  const path = new URL((await link.getAttribute("href"))!, "http://localhost").pathname;
  await page.goto(path);
  await expectPageIsItself(page, path, `рассказ «${STORY_TITLE}»`);
  const play = page.locator('[data-rf-player="play"]').first();
  await expect(play).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => {});

  // Граница петли: верх метки (элемент прямо перед плеером) — на 1 px выше
  // экрана. Положение меряется на неприлипшем плеере, в начале страницы.
  const target = await page.evaluate(() => {
    const player = document.querySelector('[data-rf-player="play"]')!.closest("div.sticky")!;
    const sentinel = player.previousElementSibling!;
    return Math.round(sentinel.getBoundingClientRect().top + window.scrollY) + 1;
  });
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), target);
  await page.waitForTimeout(600); // переход плеера (`transition-all`) и якорение

  const samples: number[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push(await page.evaluate(() => Math.round(window.scrollY)));
    await page.waitForTimeout(100);
  }
  const spread = Math.max(...samples) - Math.min(...samples);
  expect(spread, `scrollY без касаний: ${samples.join(", ")}`).toBeLessThanOrEqual(1);

  // Слово в видимой части текста рассказа; click() самого элемента —
  // без докрутки Playwright, как палец по уже видимому слову.
  const word = await page.evaluate(() => {
    const box = document.querySelector('[data-rf-player="play"]')!.closest("div.sticky")!.getBoundingClientRect();
    const words = [...document.querySelectorAll<HTMLElement>("button[data-word]")];
    const el = words.find((w) => {
      const r = w.getBoundingClientRect();
      return r.top > box.bottom + 20 && r.bottom < window.innerHeight - 40 && r.height > 0;
    });
    if (!el) return null;
    el.setAttribute("data-rf-probe-427", "1");
    return el.getAttribute("data-word");
  });
  expect(word, "видимое слово под прилипшим плеером").not.toBeNull();
  await page.locator('[data-rf-probe-427="1"]').evaluate((el) => (el as HTMLElement).click());
  await expect(page.getByTestId("translation-popover")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("translation-popover"), `карточка «${word}» через 1,5 с`).toBeVisible();
});
