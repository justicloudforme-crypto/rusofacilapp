import { describe, expect, it } from "vitest";
import { currentPlatform, getDeployEnvironment, isDeployedEnvironment, mayReportServerSentry } from "./deploy-environment";

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

describe("server Sentry gate (debt 416)", () => {
  const vercel = (env: string) => ({ VERCEL: "1", VERCEL_ENV: env }) as unknown as NodeJS.ProcessEnv;

  it("keeps sending from real Vercel servers — production and preview", () => {
    // Vercel runs functions on Linux and sets VERCEL=1 next to VERCEL_ENV.
    for (const env of ["production", "preview", "development"]) {
      expect(mayReportServerSentry(vercel(env), "linux")).toBe(true);
    }
  });

  it("never sends from a Mac, whatever variables are set by hand", () => {
    // The 7.286 incident: VERCEL_ENV=preview on the command line of a Mac.
    expect(mayReportServerSentry({ VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv, "darwin")).toBe(false);
    // Even with BOTH Vercel variables forged, darwin stays darwin.
    expect(mayReportServerSentry(vercel("production"), "darwin")).toBe(false);
    expect(mayReportServerSentry(vercel("preview"), "win32")).toBe(false);
  });

  it("needs VERCEL=1 too: one forged variable is not enough even on Linux", () => {
    expect(mayReportServerSentry({ VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv, "linux")).toBe(false);
    expect(mayReportServerSentry({ VERCEL: "1" } as unknown as NodeJS.ProcessEnv, "linux")).toBe(false);
    expect(mayReportServerSentry({ VERCEL: "true", VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv, "linux")).toBe(false);
  });

  it("is closed where the platform is unknown (Edge runtime)", () => {
    expect(mayReportServerSentry(vercel("production"), undefined)).toBe(false);
  });

  it("reads the real platform of this process by default", () => {
    expect(currentPlatform()).toBe(process.platform);
    expect(mayReportServerSentry(vercel("production"))).toBe(process.platform === "linux");
  });
});
