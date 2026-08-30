import { test, expect } from "./helpers/test";

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

  // Scoped by class rather than role+text: BottomNav.tsx (added later)
  // also renders a <nav> landmark containing "Cursos" (one of its 5 fixed
  // items), which made a role+hasText locator ambiguous between the two.
  const panel = page.locator("nav.sheet-slide-up");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Cursos" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Cuentos" })).toBeVisible();

  // Tapping a link both navigates and closes the panel (state reset on
  // pathname change) — verify both in one interaction.
  await panel.getByRole("link", { name: "Cursos" }).click();
  await expect(page).toHaveURL(/\/es\/courses/);
  await expect(page.locator("nav.sheet-slide-up")).toBeHidden();

  // Re-open, then confirm the backdrop also closes it without navigating.
  //
  // The backdrop covers the whole viewport, but only the strip between the
  // sticky header (z-50, above it) and the sheet itself is actually
  // tappable — exactly as for a real user. Two things make picking a point
  // in that strip reliable:
  //
  //  1. WAIT FOR THE SHEET TO STOP MOVING. `.sheet-slide-up` animates
  //     translateY(100%) -> 0 over 0.28s, and toBeVisible() resolves as
  //     soon as it is painted, i.e. while it is still sliding. Measuring
  //     then returns a transient position — observed here between y=339
  //     and y=590 for a sheet that settles at y=246 — and a point derived
  //     from it lands *inside* the settled sheet. On a fast machine the
  //     click also happens early enough to hit the moving sheet's gap and
  //     passes; on a slower one (CI) the click lands after the sheet has
  //     settled and is intercepted by <nav class="sheet-slide-up">. That
  //     was a real, reproducible flake, not a product bug.
  //
  //  2. DERIVE THE POINT FROM THE LAYOUT INVARIANT, NOT FROM TODAY'S
  //     HEIGHT. The sheet is docked to the bottom and capped at
  //     max-h-[85dvh], so its top can never be higher than 15% of the
  //     viewport, whatever ends up inside it. Tapping between the header
  //     and that 15% line therefore stays correct if the menu grows.
  //
  // The assertions below keep the test able to fail for a real reason: if
  // the sheet ever does cover that strip, they fail rather than quietly
  // picking some other point.
  await toggle.click();
  await expect(panel).toBeVisible();
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

  const headerBox = await page.locator("header").boundingBox();
  const sheetBox = await panel.boundingBox();
  if (!headerBox || !sheetBox) throw new Error("could not measure header/sheet bounds");

  const viewport = page.viewportSize()!;
  const headerBottom = headerBox.y + headerBox.height;
  const highestPossibleSheetTop = viewport.height * 0.15; // the max-h-[85dvh] cap
  expect(
    headerBottom,
    "no tappable strip left between the header and an 85dvh sheet",
  ).toBeLessThan(highestPossibleSheetTop);

  const tapY = (headerBottom + highestPossibleSheetTop) / 2;
  expect(tapY, "tap point is not outside the open sheet").toBeLessThan(sheetBox.y);

  await page.getByTestId("mobile-menu-backdrop").click({ position: { x: 20, y: tapY } });
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
