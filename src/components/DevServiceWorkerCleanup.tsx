"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "rf_sw_cleanup_reloaded";

/**
 * Dev-only safety net. `SerwistProvider`'s `disable` prop (see
 * [lang]/layout.tsx) only skips *registering* a new Service Worker in
 * development — it does nothing about one that's already installed and
 * controlling this origin from an earlier `next build && next start`
 * visit (e.g. testing the production build on a phone over the LAN, per
 * MOBILE.md). A stale SW like that keeps intercepting requests and can
 * serve an old, cached JS bundle indefinitely — which looks exactly like
 * broken client-side interactivity (a hamburger menu that renders but
 * doesn't respond to taps) even though the current dev server's code is
 * completely fine. Actively unregistering here, on every dev load, means
 * switching between `next start` and `next dev` on the same origin can
 * never leave a stray controller behind.
 *
 * `unregister()` alone isn't enough: per spec, a worker that's already
 * controlling this page keeps doing so for the rest of the page's life —
 * unregistering only stops it from controlling *future* navigations. So
 * every fetch this page makes (JS chunks, Turbopack HMR, RSC streaming)
 * still gets routed through the old Workbox strategy code in the stale
 * worker, which doesn't know how to handle dev-mode streaming responses
 * and throws exactly the errors this fix targets ("Cannot close a
 * writable stream that is closed or errored", "stream is closing or
 * closed" from workbox-strategies' cache.put()/response teeing). The fix
 * is a single forced reload right after unregistering, so the reloaded
 * page starts with zero controller and every request goes straight to
 * the network. Guarded by sessionStorage so it only ever fires once per
 * tab, never loops.
 */
export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }

    if (hadController && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      window.location.reload();
    }
  }, []);

  return null;
}
