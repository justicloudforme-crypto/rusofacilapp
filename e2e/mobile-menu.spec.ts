import { test, expect } from "@playwright/test";

// Narrow, iPhone-sized viewport — below Tailwind's `sm` (640px) breakpoint,
// where Navbar's own `hidden ... sm:flex` desktop nav disappears with no
// replacement and MobileMenu's hamburger button becomes the only way to
// reach the nav links.
test.use({ viewport: { width: 390, height: 844 } });

test("hamburger menu opens, shows links, and closes on link/backdrop tap", async ({ page }) => {
  await page.goto("/es");

  const desktopNav = page.locator("nav.hidden.sm\\:flex");
  await expect(desktopNav).toBeHidden();

  const toggle = page.getByRole("button", { name: /abrir menú|open menu/i });
  await expect(toggle).toBeVisible();

  await toggle.click();

  const panel = page.getByRole("navigation").filter({ hasText: "Cursos" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Cursos" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Cuentos" })).toBeVisible();

  // Tapping a link both navigates and closes the panel (state reset on
  // pathname change) — verify both in one interaction.
  await panel.getByRole("link", { name: "Cursos" }).click();
  await expect(page).toHaveURL(/\/es\/courses/);
  await expect(page.getByRole("navigation").filter({ hasText: "Cursos" })).toBeHidden();

  // Re-open, then confirm the backdrop also closes it without navigating.
  // Once open, both the toggle button and the dedicated backdrop button
  // share the "close" aria-label — target the backdrop specifically via
  // its fixed-overlay class rather than by accessible name.
  await toggle.click();
  await expect(panel).toBeVisible();
  await page.locator("button.fixed.inset-0").click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/es\/courses/);
});

test("desktop nav is visible instead of the hamburger above the sm breakpoint", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto("/es");

  await expect(page.locator("nav.hidden.sm\\:flex")).toBeVisible();
  await expect(page.getByRole("button", { name: /abrir menú|open menu/i })).toBeHidden();

  await context.close();
});
