import { test as base, expect } from "@playwright/test";

export { expect };

/**
 * The project's `test`, with one thing added: every test gets its own
 * client IP.
 *
 * Why. Every rate limiter in the app keys on `requestIp(request)`
 * (src/lib/rate-limit.ts), which is `x-forwarded-for` first and the string
 * `"unknown"` when no proxy set one. Playwright talks to `next start` over
 * plain localhost with no proxy in front, so before this every parallel
 * worker, every project and every test in the run shared the single bucket
 * `"unknown"` — four browsers pretending to be one client. That is not a
 * faithful simulation of anything: a real deployment sits behind Vercel,
 * which sets `x-forwarded-for` per client, so the limiter there sees four
 * clients. The budgets were sized for a client, and the suite was spending
 * them as a fleet.
 *
 * What this does NOT do: weaken, disable or raise a limiter. Every limit
 * still applies in full, per test — a test that genuinely hammers a route
 * still gets a 429, which is what the limiter is for. Nothing in
 * `src/` changes; this only stops several independent clients from being
 * counted as one.
 *
 * The address is derived from the worker index and a per-test counter, so
 * it is stable within a test (the login limiter has to see the same client
 * across a whole flow) and distinct between tests.
 */
let testCounter = 0;

export const test = base.extend({
  // Playwright's docs call the second argument `use`; it is named `provide`
  // here only because eslint's react-hooks/rules-of-hooks reads any call to
  // a function named `use` as a React hook and errors on it.
  page: async ({ page }, provide, testInfo) => {
    testCounter += 1;
    // 10.0.0.0/8 — private space, never a real client here, and three
    // varying octets are far more addresses than a run has tests.
    const ip = `10.${testInfo.workerIndex % 256}.${Math.floor(testCounter / 256) % 256}.${testCounter % 256}`;
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
    await provide(page);
  },
});
