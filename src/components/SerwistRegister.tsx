"use client";

import { useEffect } from "react";
import { useSerwist } from "@serwist/next/react";
import * as Sentry from "@sentry/nextjs";
import { isExpectedServiceWorkerFailure } from "@/lib/sw-registration-failure";

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

// Search-engine renderers run a sandboxed Chrome whose
// `navigator.serviceWorker.register` is stubbed out. Two shapes of stub
// have been seen in production, and NEITHER can be caught from here:
//
//  - Google-InspectionTool (URL Inspection / Rich Results Test) hands back
//    a rejection that reaches Sentry as a genuine `onunhandledrejection`
//    even though the `.catch()` below already existed at the time.
//  - GoogleOther — 1000 events in three days, issue JAVASCRIPT-NEXTJS-9,
//    93% of them from one crawler on a Nexus 5X / Android 6.0.1 profile.
//    Same story: the stack's top frame is an `<anonymous>` script that is
//    not ours, called from @serwist/window's `_registerScript`.
//
// The reason a `.catch()` cannot help is in the stack: the rejected promise
// belongs to the stub, which creates it and keeps it. Our chain never
// receives that object, so nothing we attach to what `register()` returns
// can mark it handled. The only move available on this side is not to make
// the call — which is also what a crawler wants, since a service worker
// gives an indexer nothing at all.
//
// Listed by name rather than by a general "is this a bot" test, so a real
// browser is never quietly denied offline support because its user agent
// happened to contain a word.
const NON_INTERACTIVE_CRAWLERS =
  /Google-InspectionTool|GoogleOther|Googlebot|AdsBot-Google|Mediapartners-Google|Google-Site-Verification|Chrome-Lighthouse|Bingbot|YandexBot|DuckDuckBot|Applebot/i;

function isKnownNonInteractiveCrawler(): boolean {
  return NON_INTERACTIVE_CRAWLERS.test(navigator.userAgent);
}

/**
 * Один обработчик на оба пути отказа. Ожидаемый класс (приватное окно,
 * выключенные worker'ы, блокировщик, сеть) остаётся в консоли и в Sentry
 * НЕ уходит — квота 5000 событий в месяц, а это событие ничего не значит.
 * Неожиданный — уходит явным вызовом, с тегом и как handled=true: это
 * уже дефект, а не обстоятельство. Правило и его тест —
 * src/lib/sw-registration-failure.ts.
 */
function report(error: unknown): void {
  if (isExpectedServiceWorkerFailure(error)) {
    console.warn("[serwist] Service worker registration failed — continuing without offline caching.", error);
    return;
  }
  console.warn("[serwist] Service worker registration failed unexpectedly.", error);
  Sentry.captureException(error, {
    level: "warning",
    tags: { area: "service-worker-registration" },
  });
}

export default function SerwistRegister() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist || hasRegistered || isKnownNonInteractiveCrawler()) return;
    // Firefox and Chrome in private browsing, and any profile with service
    // workers switched off, do not expose `navigator.serviceWorker` at all.
    // Reading `.controller` off it — the first thing @serwist/window's
    // register() does — would throw synchronously, before there is a
    // promise for the `.catch()` below to be attached to. Not crawler-only:
    // this is the ordinary private-window case for a real reader.
    if (!("serviceWorker" in navigator)) {
      console.warn("[serwist] Service workers are unavailable here — continuing without offline caching.");
      return;
    }
    hasRegistered = true;
    // try/catch AND .catch(): register() is an async function, so a throw
    // before its first await surfaces as a rejection — but the surrounding
    // try also covers a synchronous throw from the library's own setup,
    // which is one fewer way for this to reach the page as a crash.
    try {
      serwist.register().catch(report);
    } catch (error) {
      report(error);
    }
  }, [serwist]);

  return null;
}
