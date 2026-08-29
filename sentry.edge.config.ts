import * as Sentry from "@sentry/nextjs";
import { isDeployedEnvironment } from "./src/lib/deploy-environment";

// Same deployment gate as sentry.server.config.ts.
const isDeployed = isDeployedEnvironment();
// NOTE: `environment` is deliberately NOT set here. On Vercel the SDK
// derives it itself as "vercel-production" / "vercel-preview" — verified
// against the live site, whose HTML carries
// `sentry-environment=vercel-production` in its baggage meta tag. Setting
// it explicitly to VERCEL_ENV would rename the environment to
// "production" and split the project's history in two. Off Vercel the SDK
// would fall back to NODE_ENV, but nothing is sent there at all, so the
// value is moot.


// Runs in the Edge runtime (src/proxy.ts and any route handlers that opt
// into `runtime: "edge"`). Kept separate from sentry.server.config.ts
// because the Edge runtime doesn't support the full Node.js SDK.
Sentry.init({
  dsn: isDeployed ? process.env.SENTRY_DSN : undefined,
  enabled: isDeployed,
  tracesSampleRate: 0.1,
  debug: false,
});
