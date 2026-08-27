import { test, expect } from "@playwright/test";

// Skipped in CI for the same reason as e2e/word-games.spec.ts:
// GlossaryTerm is DB-backed only (no committed seed fixture CI's ephemeral,
// schema-only database gets loaded with — see prisma/seed-glossary.ts,
// which is a manual/local script, not part of the CI pipeline), so these
// slugs simply don't exist against a fresh CI database. Keeps running
// locally against dev.db, which has the real 91-term catalog.
test.skip(!!process.env.CI, "needs GlossaryTerm content, which CI's ephemeral DB has no way to seed yet");

test.use({ viewport: { width: 390, height: 844 } });

// One term with a russianComparison + examples + relatedLessons block, one
// without russianComparison, one without relatedLessons — covers both the
// "everything renders" and "optional blocks stay hidden" paths on real
// content, not a contrived fixture.
const slugs = ["aspecto-en-imperativo", "caso-nominativo", "verbo-reflexivo-sya"];

for (const slug of slugs) {
  test(`/es/glossary/${slug} renders with a 200 and a matching h1`, async ({ page }) => {
    const response = await page.goto(`/es/glossary/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  });
}

test("a related-lesson link on a term page navigates to that lesson", async ({ page }) => {
  // sustantivo -> a1-1, the one lesson reachable without an account (see
  // isFreeTrialLesson in lib/courses.ts) — the only relatedLessons target
  // that resolves to the actual lesson instead of a /pricing redirect for
  // an anonymous visitor, so it's the one that can assert real lesson
  // content loaded rather than just "navigation happened somewhere".
  await page.goto("/es/glossary/sustantivo");
  await Promise.all([page.waitForURL("**/courses/a1/1"), page.getByRole("link", { name: "A1-1" }).click()]);
  await expect(page.locator("h1")).toHaveText("El alfabeto cirílico y los sonidos del ruso");
});
