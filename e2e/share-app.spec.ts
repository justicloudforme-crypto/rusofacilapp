import { test, expect } from "./helpers/test";
import type { BrowserContext } from "@playwright/test";
import { dismissWelcomeOverlay } from "./helpers/welcome-overlay";

/*
 * «COMPARTIR LA APP» В БРАУЗЕРЕ — заход 7.266.
 *
 * В браузере плагина оболочки нет: кнопка зовёт `navigator.share`, а где
 * его нет — копирует текст со ссылкой и говорит «Enlace copiado». Ссылка
 * на компьютере и iPhone — сайт `/es?utm_source=share`. Окно оценки в
 * браузере не зовётся никогда (сторож `check:review-share`, правило R5).
 */
const PASSWORD = "TestPass123!";
const SITE = "https://rusofacilapp.com/es?utm_source=share";

async function register(context: BrowserContext): Promise<void> {
  const email = `e2e-share-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await context.request.post("/api/auth/register", {
    form: { email, password: PASSWORD, lang: "es", redirectTo: "/es" },
  });
  expect(new URL(res.url()).searchParams.get("error"), "регистрация отказала").toBeNull();
}

test("без navigator.share — ссылка копируется, на экране «Enlace copiado»", async ({ page, context }) => {
  await register(context);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const copied: string[] = [];
    (window as unknown as { __copied: string[] }).__copied = copied;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void copied.push(text) },
      configurable: true,
    });
  });
  await page.goto("/es/profile");
  await dismissWelcomeOverlay(page);
  const button = page.getByRole("button", { name: "Compartir la app" });
  await button.click();
  await expect(page.getByRole("button", { name: "Enlace copiado" })).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(copied).toHaveLength(1);
  expect(copied[0]).toContain("La primera lección de cada nivel es gratis.");
  expect(copied[0].endsWith(SITE)).toBe(true);
  expect(copied[0]).not.toMatch(/Google Play|Stripe|OXXO|MXN/);
});

test("есть navigator.share — открывается окно браузера с той же ссылкой", async ({ page, context }) => {
  await register(context);
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __shared: unknown[] }).__shared = calls;
    Object.defineProperty(navigator, "share", {
      value: async (data: unknown) => void calls.push(data),
      configurable: true,
    });
  });
  await page.goto("/es/profile");
  await dismissWelcomeOverlay(page);
  await page.getByRole("button", { name: "Compartir la app" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length))
    .toBe(1);
  const [data] = await page.evaluate(() => (window as unknown as { __shared: Array<{ url: string; text: string }> }).__shared);
  expect(data.url).toBe(SITE);
  expect(data.text).toContain("RusoFácil");
  // Окно браузера говорит само за себя — «скопировано» не показываем.
  await expect(page.getByRole("button", { name: "Compartir la app" })).toBeVisible();
});
