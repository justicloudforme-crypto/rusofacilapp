import * as Sentry from "@sentry/nextjs";

// Runs in Node.js server contexts (route handlers, server components,
// server actions). Plain SENTRY_DSN here, not the NEXT_PUBLIC_ variant —
// server code never ships to the client bundle, so no need to expose it.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
});
