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
  // The /pricing redesign (4 independent columns: Free, Monthly, Yearly,
  // Premium — no more Month/Year toggle) defaults every paid card's
  // payment-method tabs to "cash" (OXXO), not "card" — so there's no tab
  // to switch first. In this always-Stripe-unconfigured test environment
  // (see file header) the checkout route's mock-grant fallback activates
  // the subscription immediately regardless of method, so clicking the
  // Monthly card's own cash CTA works exactly like the old card CTA did.
  // Matched by its cash-amount text (unique per plan: 150/899/2299 MXN)
  // rather than scoping to the card by heading, since the button text
  // itself already disambiguates which of the 3 paid cards this is.
  await page.getByRole("button", { name: "Pagar en efectivo — ≈150 MXN" }).click();

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
  // See the test above for why this is the Monthly card's cash CTA, not a
  // "Mes" tab + card CTA.
  await page.getByRole("button", { name: "Pagar en efectivo — ≈150 MXN" }).click();
  await expect(page).toHaveURL(/\/es\/profile\?checkout=mock/);

  // The /profile redesign collapsed the old "personal"/"security" tabs
  // into "settings" (profile-tabs.tsx) — ?checkout=mock just landed us on
  // the "subscription" tab instead, so switch first.
  await page.goto("/es/profile?tab=settings");

  // Log out — this is the moment a purely client-side "I just paid" flag
  // would be lost; only a real server-side subscription row survives it.
  // Logout now lives in the header's "Mi perfil" dropdown (role="menuitem",
  // see e2e/registration.spec.ts), not a plain page button.
  await page.getByRole("button", { name: "Mi perfil" }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
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
