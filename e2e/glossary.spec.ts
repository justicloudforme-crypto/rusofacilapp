import { test, expect } from "./helpers/test";
import fixture from "./fixtures/glossary.json";

// Runs everywhere, CI included. It used to self-skip under CI because
// GlossaryTerm is DB-backed only and CI's database is created empty by
// `prisma db push`, so these four slugs did not exist there. They do now:
// e2e/fixtures/glossary.json holds the same four production rows, loaded by
// scripts/seed-e2e-fixture.mjs. The rows are the real ones, so the three
// shapes the comment below names are the real shapes, not invented ones.
// See PROGRESS.md 7.52.

test.use({ viewport: { width: 390, height: 844 } });

// One term with a russianComparison + examples + relatedLessons block, one
// without russianComparison, one without relatedLessons — covers both the
// "everything renders" and "optional blocks stay hidden" paths on real
// content, not a contrived fixture.
const slugs = ["aspecto-en-imperativo", "caso-nominativo", "verbo-reflexivo-sya"];

/**
 * Заголовок сверяется с ТЕКСТОМ термина, а не с фактом своего
 * существования.
 *
 * До 08.09.2026 здесь стояло `expect(page.locator("h1")).toBeVisible()`,
 * при том что название случая обещало «a matching h1». `<h1>` есть у
 * каждой страницы сайта, включая экран отказа при HTTP 200 (инцидент №1),
 * поэтому утверждение было истинно всегда. Замерено подсадкой
 * (`{term.term}` заменён литералом) 08.09.2026: все шесть исполнений
 * остались зелёными — PROGRESS.md 7.149, долг 94.
 *
 * Ожидаемая строка берётся из той же фикстуры, которую кладёт в базу
 * `scripts/seed-e2e-fixture.mjs`, — то есть это настоящая продовая
 * запись, и она же есть в полной локальной `dev.db`.
 */
const TERM_BY_SLUG = new Map(
  (fixture as { slug: string; term: string }[]).map((row) => [row.slug, row.term]),
);

for (const slug of slugs) {
  test(`/es/glossary/${slug} renders with a 200 and a matching h1`, async ({ page }) => {
    const response = await page.goto(`/es/glossary/${slug}`);
    expect(response?.status()).toBe(200);
    const term = TERM_BY_SLUG.get(slug)!;
    expect(term, `фикстура обязана знать термин ${slug}`).toBeTruthy();
    await expect(page.locator("h1")).toHaveText(term);
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
