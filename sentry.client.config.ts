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
});
