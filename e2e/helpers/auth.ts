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
/**
 * Registers a fresh throwaway account and stops there — signed in, no
 * subscription of any kind. The other half of the entitlement matrix that
 * loginWithSubscription covers.
 *
 * It exists so that "signed in, but not a subscriber" never again has to be
 * checked by hand against the LIVE database. It was, twice: production
 * still carries the `e2e-manual-check-*@example.test` rows those checks
 * left behind, because the only way anyone had to produce that state was to
 * create a real account on the real site. A throwaway account here produces
 * exactly the same state against the suite's own database, and Playwright
 * throws it away with the browser context.
 *
 * No retry loop and no grant, deliberately. The retry in
 * loginWithSubscription is there for the subscription write's visibility
 * lag, and there is no write here to wait for; /api/auth/register's 10/min
 * cap is bypassed under E2E_TEST_SEED (playwright.config.ts), which is the
 * only environment this runs in.
 */
export async function loginWithoutSubscription(page: Page): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const response = await page.context().request.post("/api/auth/register", {
    form: { email, password: "TestPass123!", lang: "es", redirectTo: "/es" },
  });
  // Same trap as above: a refused registration answers 303 to
  // /register?error=…, which the request context follows and reports as a
  // plain 200 — only the final URL tells the truth.
  const error = new URL(response.url()).searchParams.get("error");
  if (!response.ok() || error) {
    throw new Error(`e2e register (no subscription) failed: ${response.status()} ${error ?? response.url()}`);
  }
}

/**
 * Обрыв соединения на подготовке — это НЕ результат теста.
 *
 * Замер 05.09.2026 (заход 7.124): один полный прогон из пяти покраснел
 * так —
 *
 *   Error: apiRequestContext.post: read ECONNRESET
 *     → POST http://localhost:3100/api/auth/register
 *
 * и вместе с упавшим тестом с ним ушли **12 тестов, которые не
 * запустились вовсе** (файл идёт в одном воркере). Ту же подпись 7.104
 * уже видела и назвала «не тем, что чинилось этим заходом».
 *
 * Что здесь происходит и почему это не дефект продукта. `next start` на
 * перегруженной машине сбрасывает соединение до ответа; на боевом
 * развёртывании перед приложением стоит Vercel, и такого клиента там нет.
 * Утверждение при этом не проваливается — запрос вообще не получил
 * ответа, проверять нечего.
 *
 * Почему это не «замазать ретраем». Повторяется ПОДГОТОВКА, а не замер:
 * ни одно утверждение теста сюда не попадает, и цикл ниже уже повторял
 * регистрацию — но только по ОТВЕТУ сервера (303 на `?error=`), а
 * брошенная сетевая ошибка мимо него пролетала и убивала тест. Обрывы
 * при этом не проглатываются: их считают, и если попытки кончились,
 * текст ошибки называет каждую поимённо.
 */
type Attempt<T> = { ok: true; value: T } | { ok: false; error: string };

async function tryRequest<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Только сетевой класс. Всё остальное — настоящая ошибка, и она
    // обязана лететь дальше, а не тонуть в повторе.
    if (!/ECONNRESET|ECONNREFUSED|ECONNABORTED|EPIPE|socket hang up/i.test(message)) throw error;
    return { ok: false, error: message };
  }
}

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

  const networkFailures: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const registered = await tryRequest(() =>
      page.context().request.post("/api/auth/register", {
        form: { email, password, lang: "es", redirectTo: "/es" },
      }),
    );
    if (!registered.ok) {
      networkFailures.push(`попытка ${attempt}: register — ${registered.error}`);
      if (attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      continue;
    }
    const registerResponse = registered.value;
    const landedOnError = new URL(registerResponse.url()).searchParams.has("error");
    if (registerResponse.ok() && !landedOnError) {
      const granted = await tryRequest(() =>
        page.context().request.post("/api/test/grant-subscription", {
          data: plan ? { plan } : {},
        }),
      );
      if (!granted.ok) {
        networkFailures.push(`попытка ${attempt}: grant — ${granted.error}`);
        if (attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      const grantResponse = granted.value;
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
      const checked = await tryRequest(() => page.context().request.get("/es/media"));
      if (!checked.ok) {
        networkFailures.push(`попытка ${attempt}: probe — ${checked.error}`);
        if (attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      if (!new URL(checked.value.url()).pathname.includes("/pricing")) return;
    }
    if (attempt === maxAttempts) {
      throw new Error(
        `e2e register failed after ${maxAttempts} attempts: ${registerResponse.status()} ${registerResponse.url()}` +
          (networkFailures.length ? `; обрывов соединения: ${networkFailures.length} — ${networkFailures.join("; ")}` : "")
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }

  // Досюда доходят только те попытки, что кончились обрывом соединения:
  // ветка с ответом сервера бросает внутри цикла.
  throw new Error(
    `e2e register: все ${maxAttempts} попыток кончились обрывом соединения — ${networkFailures.join("; ")}`
  );
}
