import { test, expect } from "@playwright/test";

test("shows the offline banner while offline and hides it again once back online", async ({ page, context }) => {
  await page.goto("/es");
  await expect(page.getByRole("status")).not.toBeVisible();

  await context.setOffline(true);
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/sin conexión/i);

  await context.setOffline(false);
  await expect(page.getByRole("status")).not.toBeVisible();
});

// There is deliberately no E2E test here for the Service Worker's
// precached navigation fallback (public/offline.html, wired up via sw.ts's
// `fallbacks` config and next.config.ts's `additionalPrecacheEntries`).
// It was manually/scripted-verified to work correctly — a fresh navigation
// to an uncached page while offline does render offline.html's content at
// the right URL — but automating it under Playwright is unreliable enough
// to not be worth keeping as a real test: `context.setOffline(true)`
// combined with a Service-Worker-intercepted navigation regularly produces
// spurious "page.goto: Navigation ... interrupted by another navigation"
// errors and occasional hangs on `navigator.serviceWorker.ready`, even
// though the underlying browser behavior is correct (confirmed by
// inspecting a failed test's page snapshot, which showed the correct
// offline.html content despite Playwright reporting an error). This looks
// like a Playwright/CDP navigation-tracking limitation around
// SW-synthesized responses, not a product bug — see
// rusofasil_mobile_architecture.md's "Offline-UX phase" section for the
// full investigation if this needs revisiting.
