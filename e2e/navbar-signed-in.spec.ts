import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { SETTLE_MAX_MS, settleGeometry } from "./helpers/geometry";

/**
 * The navbar a SIGNED-IN learner sees, at the widths where it broke.
 *
 * This is debt 37 (PROGRESS.md 7.69, 7.12 №37) turned into a measurement.
 * The debt existed because nothing measured this surface: `check:layout`
 * browses anonymously and cannot log in, and an anonymous navbar does not
 * contain the right-hand cluster at all — no streak badge, no "Mi perfil".
 * `e2e/page-width.spec.ts` DOES log in and DOES include /profile, but only
 * at 360 and 320, and the overflow lived at 640–767. Measured 31.08.2026
 * on a real signed-in account: /es/profile was 27px wider than a 640px
 * viewport and /ru/profile 45px.
 *
 * Two things are asserted, and the second is what stops the first from
 * passing for the wrong reason. A width check on /profile would report
 * "fine" for an account that simply has no streak, because the badge that
 * caused the overflow would not be rendered at all. So the badge's own
 * visibility is asserted on both sides of the breakpoint: absent at 660,
 * present at 768. If the badge ever stopped rendering entirely, the 768
 * case fails and the 640 case stops meaning anything — loudly, rather than
 * quietly.
 */

const NARROW = [640, 660] as const;
const WIDE = 768;

/** The badge is the only element in the header that carries this class
 * combination, and it is what `md:flex` now gates. */
const STREAK_BADGE = "header span.text-folk-red";

/** Gives the account a streak by doing the thing that now counts as study:
 * opening a lesson. Nothing is submitted — that is the point of the rule
 * changed on 31.08.2026, and it is why this helper is two lines. */
async function studySomething(page: import("@playwright/test").Page, lang: string) {
  // `domcontentloaded` + отсутствие `networkidle`: отметка дня ставится на
  // СЕРВЕРЕ, при рендере страницы урока (markStudyDayVisit), то есть она
  // уже случилась к моменту, когда пришёл ответ 200. Ждать после этого
  // тишины в сети — ждать не того; на загруженной машине эта тишина не
  // наступала за 30 с и красила тест таймаутом (замер 05.09.2026, заход
  // 7.124: 4 исполнения из 4 при тройной нагрузке, все —
  // `Test timeout of 30000ms exceeded`, ни одного провала утверждения).
  const response = await page.goto(`/${lang}/courses/a1/1`, { waitUntil: "domcontentloaded" });
  expect(response?.status(), "the lesson page must answer 200 for the mark to happen").toBe(200);
}

async function overflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return { vw: de.clientWidth, scrollWidth: de.scrollWidth };
  });
}

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}/profile: шапка вошедшего не шире вьюпорта на 640–660`, async ({ page }) => {
    // Бюджет выведен из работы теста: логин плюс шесть загрузок страниц
    // (по две на каждую из трёх ширин) с ожиданием устоявшейся геометрии
    // после каждой. Тот же счёт, что в e2e/page-width.spec.ts, и по той же
    // причине — см. комментарий к бюджету там.
    test.setTimeout(30_000 + 6 * (SETTLE_MAX_MS + 5_000));

    await loginWithSubscription(page);

    const tooWide: string[] = [];
    for (const width of NARROW) {
      await page.setViewportSize({ width, height: 780 });
      await studySomething(page, lang);

      const response = await page.goto(`/${lang}/profile`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `/${lang}/profile did not answer 200`).toBe(200);

      // The badge must be hidden here — that is the fix, and its absence is
      // the reason the row now fits.
      await expect(page.locator(STREAK_BADGE)).toBeHidden();

      // Ширину меряем по УСТОЯВШЕЙСЯ геометрии, а не по «сеть замолчала»:
      // ширину двигают шрифты и картинки, а не сеть вообще.
      await settleGeometry(page);
      const m = await overflow(page);
      if (m.scrollWidth > m.vw + 1) {
        tooWide.push(`${width}px: document ${m.scrollWidth}px in a ${m.vw}px viewport`);
      }
    }
    expect(tooWide, `signed-in navbar overflows:\n${tooWide.join("\n")}`).toEqual([]);

    // POSITIVE CONTROL for the two assertions above. Wide enough, the badge
    // IS rendered — so "hidden at 640" is the breakpoint doing its job and
    // not the badge having quietly disappeared from the product, and the
    // account really did earn a streak by opening a lesson (which is the
    // Part 1 rule, checked here end to end through a real browser).
    await page.setViewportSize({ width: WIDE, height: 780 });
    await studySomething(page, lang);
    await page.goto(`/${lang}/profile`, { waitUntil: "domcontentloaded" });
    // Ожидание здесь и так по состоянию: `toBeVisible` сам ждёт появления
    // элемента, а `networkidle` перед ним ждал не его.
    await expect(page.locator(STREAK_BADGE)).toBeVisible();
    await expect(page.locator(STREAK_BADGE)).toContainText("1");
  });
}
