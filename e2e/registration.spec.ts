import { test, expect } from "./helpers/test";
import { openLogoutControl } from "./helpers/nav";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

// Registration is the top of the whole revenue funnel — nobody can ever
// subscribe without it working first. These tests drive the real
// /register form through the browser (not the API-level helper in
// e2e/helpers/auth.ts, which every *other* spec uses to skip past this
// exact step) precisely because this is the one place that shortcut isn't
// appropriate.

function uniqueEmail(): string {
  return `e2e-register-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

test("a visitor can register and lands authenticated on their profile", async ({ page }) => {
  // This is the "deliberate change" the skip that used to stand here asked
  // for. The session cookie was Secure-flagged on the e2e server (which is
  // `next start`, so NODE_ENV=production even over plain-HTTP localhost),
  // WebKit silently dropped it, and every WebKit page load looked logged
  // out. Skipping the four tests that noticed left the rest of the WebKit
  // projects running logged out and passing anyway wherever a page had a
  // free-tier fallback — green for the wrong reason. Fixed in
  // shouldUseSecureSessionCookie (src/lib/session-token.ts), which is
  // exercised by both engines from here on.

  await page.goto("/es/register");

  await page.getByLabel("Correo electrónico").fill(uniqueEmail());
  await page.getByLabel("Contraseña").fill("TestPass123!");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // /api/auth/register redirects to redirectTo (defaults to /profile) on
  // success, or back to /register?error=... on failure — landing on
  // /profile with no error param is the only true signal registration
  // actually created an account and started a session.
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  // WelcomeOverlay shows a full-screen dialog on every brand-new account's
  // first-ever /profile landing — its backdrop sits above the header and
  // swallows the "Mi perfil" click below if still open. This used to be a
  // waitFor-in-a-try/catch, which passed whether or not it ever saw the
  // overlay; the helper asserts instead. See e2e/helpers/welcome-overlay.ts.
  await dismissWelcomeOverlay(page);

  // Logout is not on the page: it is behind the header's profile menu on a
  // wide viewport and behind the hamburger sheet on a narrow one. The
  // helper opens whichever this viewport has — see e2e/helpers/nav.ts.
  await expect(await openLogoutControl(page)).toBeVisible();
});

test("registering with an email already in use shows an error, not a silent failure", async ({ page }) => {
  const email = uniqueEmail();
  const password = "TestPass123!";

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/es\/profile(?:\?.*)?$/);

  // Same greeting overlay as the sibling test above — guaranteed on a
  // brand-new account's first /profile landing, so the helper waits for it
  // and fails if it never comes.
  await dismissWelcomeOverlay(page);

  // Log out, then try to register the same email again — this is the
  // realistic failure mode (a returning user landing on /register instead
  // of /login), and it must fail loudly with a message telling them to log
  // in instead, never silently overwrite/duplicate the account.
  await (await openLogoutControl(page)).click();
  await expect(page).toHaveURL(/\/es\/?$/);

  await page.goto("/es/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/es\/register\?error=email_taken/);
  await expect(
    page.getByText("Este correo ya está registrado. Intenta iniciar sesión.")
  ).toBeVisible();
});
