import { test, expect } from "@playwright/test";
import { loginWithSubscription } from "./helpers/auth";

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
  await page.goto("/es");

  await expect(page.locator("nav.hidden.sm\\:flex")).toBeVisible();
  await expect(page.getByRole("button", { name: /abrir menú|open menu/i })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("vocabulary (flashcards) page scales cleanly at tablet landscape width", async ({ page }) => {
  // Vocabulary now requires an active subscription (see proxy.ts's
  // protectContentRoute) — without this the page would just redirect to
  // /pricing and the assertions below would be checking the wrong page.
  await loginWithSubscription(page);
  await page.goto("/es/vocabulary");

  await expect(page.locator("nav.hidden.sm\\:flex")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("courses catalog scales cleanly at tablet landscape width", async ({ page }) => {
  await page.goto("/es/courses");

  await expectNoHorizontalOverflow(page);
});
