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
        // The mic permission the voice spec's fake microphone is asked
        // for, plus Chromium's own fake capture device as a second layer:
        // the spec replaces getUserMedia, so nothing should ever reach a
        // real device, and these flags mean a change that stopped
        // replacing it would still not open the machine's microphone.
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
     * viewport, and MediaRecorder.isTypeSupported answering false for
     * every WebM type — which is what real iOS Safari does and what
     * Playwright's WebKit, on its own, does NOT (it claims WebM support
     * iOS has never had; measured in PROGRESS.md 7.47). With webm off the
     * table the recorder falls through to audio/mp4, the format iOS
     * actually produces, and the run measures whether the clip stores and
     * plays back locally in that format.
     *
     * It is a shape, not a device. Debt 22 stays open until the owner
     * opens a lesson on a real iPhone — see PROGRESS.md.
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
