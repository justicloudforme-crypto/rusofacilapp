/**
 * One rule for "is this process actually a deployment, and which one" —
 * used to decide whether a run may talk to shared production services.
 *
 * Why this exists. On 28.08.2026 a purely local `next start` sent 20 event
 * envelopes to the production Sentry project, tagged
 * `environment: production`, with `server_name: Noutbuk-Vasilii.local` and
 * `url: http://localhost:3100/...`. The same run also made 7 writes to the
 * production Upstash cache. Nothing was misconfigured: `.env` holds the
 * real DSN and Redis credentials (it is pulled from Vercel), `next start`
 * forces `NODE_ENV=production` regardless of how the build was made, and
 * the Sentry SDK defaults its `environment` to "production" whenever
 * NODE_ENV says so. A local laptop therefore looked exactly like the live
 * deployment to every SDK that asks NODE_ENV.
 *
 * The signal used here is `VERCEL_ENV`, which Vercel sets on its own build
 * and runtime and which does not exist on a developer machine. That is the
 * point: the check must key off something the local machine cannot have,
 * not off a flag a person has to remember to set — a forgotten flag is how
 * this happened in the first place.
 *
 * Two consequences worth knowing before changing this:
 *
 *  1. NODE_ENV is NOT usable for this. `next start`, `next build` and the
 *     e2e suite all run under NODE_ENV=production by design, so it cannot
 *     tell "real deployment" from "production build on a laptop".
 *  2. Do NOT add VERCEL_ENV to a local `.env`. `vercel env pull` does not
 *     write it today (checked: the local .env has VERCEL_OIDC_TOKEN but no
 *     VERCEL/VERCEL_ENV), and adding it by hand would re-open exactly the
 *     hole this closes.
 *
 * The browser bundle cannot read VERCEL_ENV at runtime, so next.config.ts
 * bakes it in at build time as NEXT_PUBLIC_DEPLOY_ENV — read that one from
 * client code, this one from server/edge code.
 */

/** "production" | "preview" | "development" on Vercel; null anywhere else
 * (a laptop, CI, a container running the production build by hand). */
export function getDeployEnvironment(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.VERCEL_ENV;
  return value ? value : null;
}

/** True only inside a real Vercel build or deployment. Anything that
 * writes to a shared production service — error reporting, the shared
 * cache — should be gated on this rather than on NODE_ENV. */
export function isDeployedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return getDeployEnvironment(env) !== null;
}
