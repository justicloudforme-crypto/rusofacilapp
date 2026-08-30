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
      use: {
        ...devices["Desktop Chrome"],
        // The mic permission the bench's fake microphone is asked for,
        // plus Chromium's own fake capture device as a belt-and-braces
        // second layer. Note what these flags are NOT: the bench replaces
        // getUserMedia itself, in every engine, so the fake microphone has
        // never depended on them — which is why the WebKit projects worked
        // locally without them and why they were not the cause of the CI
        // failure of 30.08.2026 either.
        permissions: ["microphone"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-capture",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
    },
    /**
     * The voice-recording cycle "in the shape of iOS": WebKit, an iPhone
     * viewport, and a recorder that refuses every WebM type the way real
     * iOS Safari refuses it — which Playwright's WebKit does NOT do on its
     * own (it claims WebM support iOS has never had; PROGRESS.md 7.47).
     * With WebM off the table the app's own picker has to fall through to
     * audio/mp4, the format an iPhone actually produces.
     *
     * The recorder here is SUBSTITUTED by the bench in
     * e2e/helpers/voice-harness.ts, because Playwright's Linux WebKit has
     * no MediaRecorder at all — that is what turned CI red on 30.08.2026.
     * So this project measures the application's logic, and the run with a
     * real encoder is the chromium one.
     *
     * It is a shape, not a device. Debt 22 stays open until the owner
     * opens a lesson on a real iPhone — see PROGRESS.md 7.49.
     */
    {
      name: "voice-ios-shape",
      testMatch: /voice-recording-local\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        contextOptions: {
          // The lesson page's own recorder asks for the mic; the fake
          // microphone in the spec answers, but WebKit still checks the
          // permission first.
          permissions: ["microphone"],
        },
      },
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
