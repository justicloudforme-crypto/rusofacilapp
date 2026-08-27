import * as Sentry from "@sentry/nextjs";

// Runs in the browser. NEXT_PUBLIC_SENTRY_DSN (not SENTRY_DSN) because this
// file ships to the client bundle — a server-only env var would be
// undefined here. Leaving it unset disables the SDK entirely (Sentry.init
// with dsn: undefined is a documented no-op), so this is safe to deploy
// before a Sentry project/DSN exists.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Low sample rate: this is a content-heavy app (lessons/flashcards/media),
  // not a few critical checkout flows — full tracing on every page view
  // would mostly capture noise. Revisit upward once real traffic volume is
  // known from Speed Insights.
  tracesSampleRate: 0.1,
  // Session Replay off by default — the app records student voice
  // pronunciation audio and handles auth/payment flows; replay capture of
  // arbitrary DOM/network content is a privacy surface not worth opening
  // without a deliberate decision to mask specific fields first.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
  beforeSend(event) {
    // Playwright's default `serviceWorkers: 'block'` context option stubs
    // navigator.serviceWorker.register with a no-op that resolves
    // `undefined` (playwright-core/lib/coreBundle.js) instead of a real
    // registration or a rejection — @serwist/window then throws reading
    // `.waiting` off that `undefined` (see SerwistRegister.tsx). Confirmed
    // via a real prod event (Sentry 8de70b2c) whose breadcrumbs carry
    // Playwright's own "blocked by Playwright" console warning —
    // automation hitting the live site, not a real user, and already
    // handled gracefully client-side. Only drop THIS specific failure
    // (TypeError reading 'waiting') from a session that shows Playwright's
    // fingerprint — any other error in the same session (a real bug the
    // automation happened to also trip) still reports normally.
    const blockedByPlaywright = event.breadcrumbs?.some(
      (b) => b.category === "console" && typeof b.message === "string" && b.message.includes("blocked by Playwright")
    );
    const isWaitingOnUndefined = event.exception?.values?.some(
      (v) => v.type === "TypeError" && typeof v.value === "string" && v.value.includes("reading 'waiting'")
    );
    if (blockedByPlaywright && isWaitingOnUndefined) return null;
    return event;
  },
});
