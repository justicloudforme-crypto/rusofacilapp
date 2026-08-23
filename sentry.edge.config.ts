import * as Sentry from "@sentry/nextjs";

// Runs in the Edge runtime (src/proxy.ts and any route handlers that opt
// into `runtime: "edge"`). Kept separate from sentry.server.config.ts
// because the Edge runtime doesn't support the full Node.js SDK.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
});
