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
 */
export default function SerwistRegister() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;
    serwist.register().catch((error: unknown) => {
      console.warn("[serwist] Service worker registration failed — continuing without offline caching.", error);
    });
  }, [serwist]);

  return null;
}
