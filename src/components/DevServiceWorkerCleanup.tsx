"use client";

import { useEffect } from "react";

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
 */
export default function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }
  }, []);

  return null;
}
