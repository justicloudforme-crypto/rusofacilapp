import { expect, type Page } from "@playwright/test";

/**
 * Dismisses the once-a-day greeting that WelcomeOverlay shows on /profile.
 *
 * Why this exists at all. `src/components/profile/WelcomeOverlay.tsx` is a
 * full-screen `role="dialog"` with `fixed inset-0 z-[60]`, rendered on the
 * profile page once per (userId, calendar day) and gated by a localStorage
 * key written inside a `useEffect`. The effect fires after hydration, not
 * synchronously with the navigation — so a spec that lands on /profile and
 * immediately clicks anything (the header's "Mi perfil" button, say) is
 * racing a backdrop that swallows the click. Playwright's actionability
 * retry then burns the entire test timeout against it, which is exactly
 * what `checkout.spec.ts:67` was doing: it fails with a 30s timeout on a
 * click whose target is visible, enabled and stable, and whose call log
 * names the interceptor — `<div role="dialog" aria-label="¡Feliz nuevo día
 * de ruso!">`. PROGRESS.md 7.51 attributed that failure to the
 * /api/auth/register rate limit; that was wrong — see 7.52.
 *
 * Why it asserts instead of sampling. The older, copy-pasted form of this
 * (`waitFor({ timeout: 3000 })` inside a try/catch) is itself a race: it
 * passes both when the overlay was dismissed and when it simply had not
 * appeared yet, so a slow machine turns "handled" into "missed it". A
 * brand-new account's FIRST landing on /profile always has an empty
 * localStorage, so the overlay is not merely possible there, it is
 * guaranteed — which makes waiting for it an assertion rather than a
 * guess, and makes its absence a real product regression worth failing on.
 *
 * Call it on that first landing. Every later /profile visit in the same
 * browser context is then safe by construction, because this call is what
 * proves the flag got written.
 */
export async function dismissWelcomeOverlay(page: Page): Promise<void> {
  const overlay = page.getByRole("dialog", { name: "¡Feliz nuevo día de ruso!" });
  await expect(overlay).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(overlay).toBeHidden();
}
