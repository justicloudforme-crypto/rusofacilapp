import * as Sentry from "@sentry/nextjs";
import { isDeployedEnvironment } from "./src/lib/deploy-environment";

// null on a laptop and in CI, "production"/"preview"/"development" on
// Vercel. Gating on this (not NODE_ENV) is what stops a local
// `next start` from filing events into the live project — see the long
// comment in src/lib/deploy-environment.ts for the incident.
const isDeployed = isDeployedEnvironment();
// NOTE: `environment` is deliberately NOT set here. On Vercel the SDK
// derives it itself as "vercel-production" / "vercel-preview" — verified
// against the live site, whose HTML carries
// `sentry-environment=vercel-production` in its baggage meta tag. Setting
// it explicitly to VERCEL_ENV would rename the environment to
// "production" and split the project's history in two. Off Vercel the SDK
// would fall back to NODE_ENV, but nothing is sent there at all, so the
// value is moot.


// Runs in Node.js server contexts (route handlers, server components,
// server actions). Plain SENTRY_DSN here, not the NEXT_PUBLIC_ variant —
// server code never ships to the client bundle, so no need to expose it.
Sentry.init({
  // DSN withheld entirely off-Vercel, belt and braces with `enabled`.
  dsn: isDeployed ? process.env.SENTRY_DSN : undefined,
  enabled: isDeployed,
  tracesSampleRate: 0.1,
  debug: false,
});
