// Next.js instrumentation hook — runs once per server/edge runtime boot,
// before any route handler. This is what actually wires up Sentry for
// server and edge code; sentry.client.config.ts is loaded separately by
// the Sentry webpack plugin for the browser bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    await reportMisshapenStripeEnv();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};

/**
 * Third and last net under the Stripe environment, after the build-time gate
 * (scripts/check-stripe-env-shape.ts) and the request-time one
 * (src/lib/plans.ts). Runs once per server boot, before any route handler.
 *
 * Why a third one, and why it does NOT throw. The build gate is the one that
 * matters — it stops the deployment before it exists. This one covers the
 * cases the build gate structurally cannot: a `next start` on a laptop, and
 * any future path where a value reaches the runtime without passing through
 * a build of this repository. It reports rather than crashes, because a
 * misshapen Price id is a broken checkout, and taking the whole site down over
 * it would be a far larger outage than the one being guarded against.
 *
 * The report goes to Sentry at level "error" and carries no values — see
 * src/lib/stripe-env.ts for why that is load-bearing rather than tidy.
 */
async function reportMisshapenStripeEnv() {
  try {
    const { checkStripeEnvShapes, formatStripeEnvProblems } = await import("./lib/stripe-env");
    const problems = checkStripeEnvShapes(process.env as Record<string, string | undefined>);
    if (problems.length === 0) return;

    const report = formatStripeEnvProblems(problems);
    console.error(report);

    const { isDeployedEnvironment } = await import("./lib/deploy-environment");
    if (!isDeployedEnvironment()) return;

    const error = new Error(report.split("\n").slice(0, problems.length + 2).join("\n"));
    error.name = "StripeEnvWrongShape";
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "error",
      tags: { defect: "stripe-env-wrong-shape" },
      extra: {
        // Names and kinds only. Never a value.
        problems: problems.map((p) => `${p.name}: ${p.kind}`),
      },
    });
  } catch {
    // Reporting the problem must never become a second problem.
  }
}
