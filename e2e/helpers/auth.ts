import type { Page } from "@playwright/test";

/**
 * Registers a fresh throwaway account and grants it an active
 * subscription, then leaves the session cookie in `page`'s browser
 * context (Playwright's `context.request` shares its cookie jar with the
 * page, so a later `page.goto()` is already authenticated) — needed
 * since /vocabulary, /stories, /media, and /word-games now require an
 * active subscription (see proxy.ts's protectContentRoute). Each call
 * creates its own account so parallel tests never share or race on state.
 *
 * The subscription grant goes through /api/test/grant-subscription
 * (test-only, see its own doc comment) rather than importing @/lib/db
 * directly into this Node process — that was tried first and failed with
 * "Cannot use 'import.meta' outside a module": the generated Prisma
 * client is ESM-only and Playwright's test transform loads spec files as
 * CommonJS, so pulling in the real app's server module tree here doesn't
 * work the way it does in, say, a Vitest test. A plain HTTP call sidesteps
 * the whole problem.
 *
 * Retries registration on rate_limited: /api/auth/register caps at 10/min
 * per IP (a real anti-abuse control, not something to weaken for tests),
 * and this whole suite's fullyParallel workers all register from the same
 * localhost IP — a real, confirmed failure mode: the rate-limited request
 * redirects (303) to /register?error=rate_limited, which Playwright's
 * request API follows and reports as a plain 200 OK, so response.ok()
 * alone doesn't catch it — only the final URL's error= param does.
 */
export async function loginWithSubscription(
  page: Page,
  options: { tier?: "standard" | "premium" } = {},
): Promise<void> {
  const password = "TestPass123!";
  const maxAttempts = 5;
  // "premium" means the lifetime plan, the only one src/lib/entitlement.ts
  // resolves to the premium tier — needed by anything gated on ★ (curved)
  // puzzles, WordGamePuzzle.premiumOnly or C1 content. Default stays
  // standard so specs that only need "an active subscription" keep
  // testing that, and not a stronger entitlement than the product asks for.
  const plan = options.tier === "premium" ? "lifetime" : undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const registerResponse = await page.context().request.post("/api/auth/register", {
      form: { email, password, lang: "es", redirectTo: "/es" },
    });
    const landedOnError = new URL(registerResponse.url()).searchParams.has("error");
    if (registerResponse.ok() && !landedOnError) {
      const grantResponse = await page.context().request.post("/api/test/grant-subscription", {
        data: plan ? { plan } : {},
      });
      if (!grantResponse.ok()) {
        throw new Error(`e2e subscription grant failed: ${grantResponse.status()} ${await grantResponse.text()}`);
      }

      // A real, reproducible race, confirmed even with the whole suite
      // serialized to one worker (--workers=1): the very first gated
      // navigation right after a fresh account's first-ever subscription
      // write occasionally still lands on /pricing anyway — a fixed pause
      // here didn't fix it either, so this isn't simple write-visibility
      // lag. Rather than guess further at the cause, verify entitlement
      // actually took effect against the real gate (a plain GET through
      // the request context, not a page navigation, so it doesn't count
      // as the test's own first page load) and retry the whole
      // register+grant cycle if it hasn't.
      //
      // Probes /es/media specifically, not /es/vocabulary — since the
      // 2026-08-24 free-trial model shipped, /vocabulary (and /stories,
      // /word-games) no longer hard-redirect an unentitled visitor to
      // /pricing at all (they render a limited free sample instead, see
      // src/lib/entitlement.ts), so they can no longer detect a failed or
      // not-yet-propagated grant this way. /media has no free-trial sample
      // and keeps the original blanket subscription gate, so it's still a
      // reliable "did the grant actually take" probe.
      const check = await page.context().request.get("/es/media");
      if (!new URL(check.url()).pathname.includes("/pricing")) return;
    }
    if (attempt === maxAttempts) {
      throw new Error(
        `e2e register failed after ${maxAttempts} attempts: ${registerResponse.status()} ${registerResponse.url()}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
}
