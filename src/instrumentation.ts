// Next.js instrumentation hook — runs once per server/edge runtime boot,
// before any route handler. This is what actually wires up Sentry for
// server and edge code; sentry.client.config.ts is loaded separately by
// the Sentry webpack plugin for the browser bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
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
