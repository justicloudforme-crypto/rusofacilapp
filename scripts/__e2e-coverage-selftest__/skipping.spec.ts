// Fixture: a spec that skips. The coverage check must catch every line
// below. Not a real test — see README.md in this directory.
import { test } from "@playwright/test";

test.skip(!!process.env.CI, "the exact shape that hid two whole spec files");

test("conditionally skipped inside the body", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "the exact shape that hid four more");
  await page.goto("/");
});

test.describe.skip("a skipped group", () => {
  test("never runs", async () => {});
});
