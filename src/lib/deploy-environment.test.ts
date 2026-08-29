import { describe, expect, it } from "vitest";
import { getDeployEnvironment, isDeployedEnvironment } from "./deploy-environment";

describe("deploy environment gate", () => {
  it("reports no deployment on a developer machine", () => {
    // The exact shape of the incident: a production BUILD (NODE_ENV=production,
    // which `next start` forces) running on a laptop, with the real
    // credentials present in .env. Before this gate the Sentry SDK read
    // NODE_ENV, concluded "production", and filed 20 envelopes into the
    // live project.
    const laptop = {
      NODE_ENV: "production",
      SENTRY_DSN: "https://key@o1.ingest.us.sentry.io/1",
      UPSTASH_REDIS_REST_URL: "https://real.upstash.io",
    } as unknown as NodeJS.ProcessEnv;
    expect(getDeployEnvironment(laptop)).toBeNull();
    expect(isDeployedEnvironment(laptop)).toBe(false);
  });

  it("reports no deployment in CI", () => {
    const ci = { NODE_ENV: "production", CI: "true" } as unknown as NodeJS.ProcessEnv;
    expect(isDeployedEnvironment(ci)).toBe(false);
  });

  it("passes Vercel's own environment through unchanged", () => {
    for (const env of ["production", "preview", "development"]) {
      const vercel = { VERCEL: "1", VERCEL_ENV: env } as unknown as NodeJS.ProcessEnv;
      expect(getDeployEnvironment(vercel)).toBe(env);
      expect(isDeployedEnvironment(vercel)).toBe(true);
    }
  });

  it("treats an empty VERCEL_ENV as not deployed", () => {
    // next.config.ts bakes `VERCEL_ENV ?? ""` into the client bundle, so
    // the empty string is the real off-Vercel value, not just a theory.
    const blank = { VERCEL_ENV: "" } as unknown as NodeJS.ProcessEnv;
    expect(getDeployEnvironment(blank)).toBeNull();
    expect(isDeployedEnvironment(blank)).toBe(false);
  });

  it("does not accept NODE_ENV as evidence of a deployment", () => {
    // Guards the specific mistake this module exists to prevent: someone
    // "simplifying" the check back to NODE_ENV, which is production for
    // `next build`, `next start` and the e2e suite alike.
    expect(isDeployedEnvironment({ NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
