import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
    },
  ],
  // Reuses a server already running on PORT during local dev; CI always
  // starts a fresh production build so tests exercise real prod output
  // (matches how the PWA/service-worker features actually behave).
  webServer: {
    command: `next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Arms /api/test/grant-subscription (see e2e/helpers/auth.ts) — never
    // set on a real deployment, only here, so that route 404s everywhere
    // except a server this config itself started. `next start` always
    // forces NODE_ENV=production regardless of how the build was made, so
    // a NODE_ENV check can't distinguish "real prod" from "e2e run
    // against a prod build" the way it can for `next dev`.
    env: { E2E_TEST_SEED: "1" },
  },
});
