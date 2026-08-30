// Fixture: a spec with nothing wrong with it, so a "0 problems" from the
// check means "looked and found nothing" rather than "did not look".
// The word test.skip appears here only inside this comment, which must not
// count. See README.md in this directory.
import { test, expect } from "@playwright/test";

test("runs", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});
