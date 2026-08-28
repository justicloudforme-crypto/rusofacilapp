"use client";

import { useEffect } from "react";
import { useSerwist } from "@serwist/next/react";

/**
 * `SerwistProvider` (see [lang]/layout.tsx) is mounted with `register={false}`
 * so this component owns the actual `register()` call — the library's own
 * `register: true` path fires it as `void window.serwist.register()` with
 * no `.catch()` (see node_modules/@serwist/next/src/index.react.tsx), so any
 * rejection reaches the browser as a genuine unhandled promise rejection.
 *
 * A real, confirmed case: `navigator.serviceWorker.register()` rejecting on
 * some Android/Chrome Mobile combinations (seen in production Sentry —
 * Chrome Mobile 150, Android 10), for reasons outside this app's control
 * and with no user-visible effect (the page works identically either way —
 * SW registration only adds offline caching/precaching, nothing the app
 * depends on to function). Catching it here converts that from an
 * "unhandled rejection" crash report into an expected, logged no-op, so
 * Sentry's crash stream reflects real bugs instead of this device-specific
 * noise.
 *
 * `window.serwist` is a global singleton (SerwistProvider only creates it
 * once and reuses it on every mount — see @serwist/next/react's
 * index.react.mjs). @serwist/window's own guard against re-registering an
 * already-registered instance is dev-only (node_modules/@serwist/window:
 * `if (process.env.NODE_ENV !== "production") { if (this._registrationTime)
 * return }`) — stripped out of production builds. A real production event
 * (Sentry 8de70b2c) showed this component being invoked a second time on
 * the same page load (breadcrumbs: a same-URL client navigation
 * immediately followed by `navigator.serviceWorker.register` firing
 * twice), and the second `register()` call raced the first's write to the
 * shared instance's `_registration` field and threw. A module-level flag
 * survives remounts (unlike component state) and keeps this to one
 * `register()` call per page load, matching the library's intended
 * (dev-only-enforced) behavior.
 */
let hasRegistered = false;

// Google's own crawling tools (confirmed via Sentry: "Google-InspectionTool"
// UA, used by URL Inspection / Rich Results Test) run a sandboxed Chrome
// that deliberately makes `navigator.serviceWorker.register()` reject —
// same intent as Playwright's `serviceWorkers: 'block'` (see
// sentry.client.config.ts's beforeSend), but rejecting instead of
// resolving `undefined`, a different failure shape that still reached
// Sentry as a genuine `onunhandledrejection` event despite the `.catch()`
// below already existing (confirmed: that catch predates this bot report,
// see git history). Rather than chase why this specific harness's
// rejection evades a promise chain that looks complete, skip the register
// call entirely for it — "should quietly not happen" rather than "happen
// and get caught," which is also strictly safer (one less place a new,
// not-yet-seen crawler quirk could slip past the `.catch()` again).
function isKnownNonInteractiveCrawler(): boolean {
  return /Google-InspectionTool/i.test(navigator.userAgent);
}

export default function SerwistRegister() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist || hasRegistered || isKnownNonInteractiveCrawler()) return;
    hasRegistered = true;
    serwist.register().catch((error: unknown) => {
      console.warn("[serwist] Service worker registration failed — continuing without offline caching.", error);
    });
  }, [serwist]);

  return null;
}
