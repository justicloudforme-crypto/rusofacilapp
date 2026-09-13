import * as Sentry from "@sentry/nextjs";
import { isDeployedEnvironment } from "./src/lib/deploy-environment";
import { tagShellOnEvent, userAgentFromSentryEvent } from "./src/lib/shell-tag";

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
  // ДОЛГ 174. Третья половина той же метки. Краевой runtime исполняет
  // `src/proxy.ts`, то есть стоит ПЕРЕД каждым запросом оболочки — и его
  // события без метки были бы единственными неразмеченными.
  beforeSend: (event) => tagShellOnEvent(event, userAgentFromSentryEvent(event)),
});
