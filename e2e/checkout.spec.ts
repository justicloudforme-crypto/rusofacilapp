import { test, expect } from "./helpers/test";
import { openLogoutControl } from "./helpers/nav";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

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

test("a logged-in user can subscribe and sees the active plan immediately", async ({ page }) => {
  // Both tests here used to skip WebKit: the session cookie was
  // Secure-flagged on this always-production (`next start`) test server and
  // WebKit drops a Secure cookie over plain-HTTP localhost. Fixed at the
  // source — the e2e server alone issues the cookie without Secure now, see
  // shouldUseSecureSessionCookie in src/lib/session-token.ts — so the paid
  // funnel is finally exercised on both engines.

  const email = uniqueEmail();
  const password = "TestPass123!";

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  // A brand-new account's first /profile landing always raises the daily
  // greeting overlay. This test never clicks on /profile, so the backdrop
  // could not hurt it — but leaving it up means the flag it writes is
  // never written, and the overlay resurfaces on the /profile?checkout=mock
  // landing below, over the text this test asserts on. Dismiss it here for
  // the same reason the sibling test does. See e2e/helpers/welcome-overlay.ts.
  await dismissWelcomeOverlay(page);

  await page.goto("/es/pricing");
  // The /pricing redesign (4 independent columns: Free, Monthly, Yearly,
  // Premium — no more Month/Year toggle) defaults every paid card's
  // payment-method tabs to "cash" (OXXO), not "card" — so there's no tab
  // to switch first. In this always-Stripe-unconfigured test environment
  // (see file header) the checkout route's mock-grant fallback activates
  // the subscription immediately regardless of method, so clicking the
  // Monthly card's own cash CTA works exactly like the old card CTA did.
  // Matched by its cash-amount text (unique per plan: 150/899/2299 MXN —
  // an exact price since 2026-09-06, no longer an "≈" conversion of a USD
  // one, see PROGRESS.md 7.116)
  // rather than scoping to the card by heading, since the button text
  // itself already disambiguates which of the 3 paid cards this is.
  await page.getByRole("button", { name: "Pagar en efectivo — $150 MXN" }).click();

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

test("subscription status survives logging out and back in (restore-equivalent)", async ({ page }) => {
  const email = uniqueEmail();
  const password = "TestPass123!";

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  // THE fix for this test's flake, and the whole of it. Nothing about the
  // /api/auth/register rate limit was ever involved (that limiter has been
  // bypassed under E2E_TEST_SEED since 12da466, well before this test
  // started flaking) — the timeout was the greeting overlay's full-screen
  // backdrop eating the "Mi perfil" click 40 lines below. PROGRESS.md 7.52.
  await dismissWelcomeOverlay(page);

  await page.goto("/es/pricing");
  // See the test above for why this is the Monthly card's cash CTA, not a
  // "Mes" tab + card CTA.
  await page.getByRole("button", { name: "Pagar en efectivo — $150 MXN" }).click();
  await expect(page).toHaveURL(/\/es\/profile\?checkout=mock/);

  // The /profile redesign collapsed the old "personal"/"security" tabs
  // into "settings" (profile-tabs.tsx) — ?checkout=mock just landed us on
  // the "subscription" tab instead, so switch first.
  await page.goto("/es/profile?tab=settings");

  // Log out — this is the moment a purely client-side "I just paid" flag
  // would be lost; only a real server-side subscription row survives it.
  // Logout is behind the profile menu on a wide viewport and behind the
  // hamburger on a narrow one — see e2e/helpers/nav.ts.
  await (await openLogoutControl(page)).click();
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
