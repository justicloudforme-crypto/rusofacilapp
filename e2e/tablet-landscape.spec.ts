import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { expectPageIsItself } from "./helpers/page-identity";

// iPad landscape — above Tailwind's `sm` (640px) breakpoint, where the
// desktop nav should be showing and MobileMenu's hamburger should stay
// hidden. Regression check for layout shifts/overlaps at this size,
// requested after Phase 6: any horizontal scrollbar here means something
// is overflowing its container instead of scaling down.
test.use({ viewport: { width: 1024, height: 768 } });

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test("home page uses the desktop nav, not the hamburger, and has no horizontal overflow", async ({ page }) => {
  const response = await page.goto("/es");
  // ДОЛГ 96: ширина пустого документа укладывается в окно ровно так же,
  // как ширина настоящей главной.
  expect(response?.status(), "/es не ответила 200").toBe(200);
  await expectPageIsItself(page, "/es");

  await expect(page.locator("nav.hidden.sm\\:flex")).toBeVisible();
  await expect(page.getByRole("button", { name: /abrir menú|open menu/i })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

/**
 * СНАЧАЛА — ТА ЛИ ЭТО СТРАНИЦА, и только потом её ширина.
 *
 * `scrollWidth <= clientWidth` истинно на ПУСТОЙ странице, на экране
 * отказа и на любом 404 — то есть само по себе оно не отличает «вёрстка в
 * порядке» от «мерить было нечего». Замерено подсадкой 08.09.2026:
 * `/es/courses` заменена на `<main />` при том же HTTP 200, и случай
 * «courses catalog scales cleanly» прошёл зелёным в обоих проектах
 * (PROGRESS.md 7.149, долг 94). Поэтому у каждого замера ширины теперь
 * есть признак САМОЙ страницы — элемент, который бывает только на ней.
 */
async function expectPageIsReallyThere(
  page: import("@playwright/test").Page,
  status: number | undefined,
  marker: import("@playwright/test").Locator,
  what: string,
) {
  expect(status, `${what} не ответила 200`).toBe(200);
  await expect(marker, `${what} отдала 200, но своего содержимого на ней нет`).toBeVisible();
}

test("vocabulary (flashcards) page scales cleanly at tablet landscape width", async ({ page }) => {
  // Vocabulary now requires an active subscription (see proxy.ts's
  // protectContentRoute) — without this the page would just redirect to
  // /pricing and the assertions below would be checking the wrong page.
  await loginWithSubscription(page);
  const response = await page.goto("/es/vocabulary");
  // ДОЛГ 96: раньше признаком тут был ЛЮБОЙ `h1` — а `h1` есть у каждой
  // страницы сайта, включая экран отказа при 200. Теперь спрашивается
  // собственный canonical страницы, то есть именно этот адрес.
  await expectPageIsReallyThere(page, response?.status(), page.locator('[data-testid="level-filter"]'), "/es/vocabulary");
  await expectPageIsItself(page, "/es/vocabulary");

  await expect(page.locator("nav.hidden.sm\\:flex")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("courses catalog scales cleanly at tablet landscape width", async ({ page }) => {
  const response = await page.goto("/es/courses");
  // Вводная дека — то, из чего каталог курсов состоит; её `data-testid`
  // ставит src/components/intro/IntroPresentation.tsx.
  await expectPageIsReallyThere(
    page,
    response?.status(),
    page.locator('[data-testid="intro-presentation"]'),
    "/es/courses",
  );
  await expectPageIsItself(page, "/es/courses");

  await expectNoHorizontalOverflow(page);
});
