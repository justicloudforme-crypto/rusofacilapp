import { test, expect } from "@playwright/test";

// The paid funnel end-to-end: subscribe, then prove the subscription
// actually survives a real session boundary (log out, log back in) rather
// than only looking active because of a one-off checkout-redirect flash.
//
// This runs against an environment with no STRIPE_SECRET_KEY (see
// playwright.config.ts — CI never sets Stripe test keys), so
// /api/checkout always takes its documented "Stripe isn't configured"
// fallback branch (src/app/api/checkout/route.ts) and grants the
// subscription directly instead of redirecting to Stripe's hosted
// checkout. That's a real, intentionally-supported code path (the same
// one local dev without Stripe credentials exercises), not a stub written
// just for this test — but it does mean this suite cannot exercise the
// actual Stripe/OXXO network calls or the webhook that finalizes a real
// card/OXXO payment. Those are covered separately by
// src/app/api/webhooks/stripe/route.test.ts (unit-level, signed fixture
// events).

function uniqueEmail(): string {
  return `e2e-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

test("a logged-in user can subscribe and sees the active plan immediately", async ({ page, browserName }) => {
  // See e2e/registration.spec.ts for the full explanation: the session
  // cookie is Secure-flagged in this always-production (`next start`)
  // test server, which WebKit drops over plain HTTP localhost. Both tests
  // here register via the real browser form (not the API-level
  // loginWithSubscription helper), so they hit the same issue.
  test.skip(browserName === "webkit", "Secure cookie dropped over plain-HTTP localhost in WebKit");

  const email = uniqueEmail();
  const password = "TestPass123!";

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  await page.goto("/es/pricing");
  // The monthly card's own "card" checkout button — scoped to the nearest
  // rounded-2xl card ancestor of the "Mensual" heading so this doesn't
  // accidentally hit the annual/lifetime card's own submit button.
  const monthlyCard = page
    .getByRole("heading", { name: "Mensual" })
    .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await monthlyCard.getByRole("button", { name: "Suscribirme" }).click();

  // No real Stripe configured in this environment -> mock-grant branch ->
  // redirect straight back to /profile with ?checkout=mock (see the
  // route's own comment on this behavior).
  await expect(page).toHaveURL(/\/es\/profile\?checkout=mock/);
  await expect(page.getByText("Suscripción activada (modo demo, sin Stripe real).")).toBeVisible();
  // exact: true avoids an incidental substring match against the banner
  // above ("activAdA" contains "Activa"); .first() because the same
  // status also legitimately appears a second time in the plan history
  // list further down the page — either instance proves the point.
  await expect(page.getByText("Activa", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Mensual", { exact: true }).first()).toBeVisible();
});

test("subscription status survives logging out and back in (restore-equivalent)", async ({
  page,
  browserName,
}) => {
  // See the test above / e2e/registration.spec.ts for why WebKit is skipped.
  test.skip(browserName === "webkit", "Secure cookie dropped over plain-HTTP localhost in WebKit");

  const email = uniqueEmail();
  const password = "TestPass123!";

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  await page.goto("/es/pricing");
  const monthlyCard = page
    .getByRole("heading", { name: "Mensual" })
    .locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await monthlyCard.getByRole("button", { name: "Suscribirme" }).click();
  await expect(page).toHaveURL(/\/es\/profile\?checkout=mock/);

  // The logout button only renders on the profile page's "personal" tab
  // (see src/app/[lang]/profile/page.tsx) — ?checkout=mock just landed us
  // on the "subscription" tab instead, so switch first.
  await page.goto("/es/profile?tab=personal");

  // Log out — this is the moment a purely client-side "I just paid" flag
  // would be lost; only a real server-side subscription row survives it.
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/es\/?$/);

  // Log back in as the same user and go straight to the subscription tab
  // (server-driven via ?tab=, no checkout param this time so it wouldn't
  // default there on its own) to confirm entitlement was actually
  // persisted against the account, not just flashed on the redirect.
  await page.goto("/es/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  await page.goto("/es/profile?tab=subscription");
  await expect(page.getByText("Activa", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Mensual", { exact: true }).first()).toBeVisible();
});
