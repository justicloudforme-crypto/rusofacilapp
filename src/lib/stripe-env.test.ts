import { describe, expect, it } from "vitest";
import {
  checkStripeEnvShapes,
  formatStripeEnvProblems,
  hasStripeShape,
  STRIPE_ENV_RULES,
} from "./stripe-env";

// A value that has the right SHAPE and belongs to nothing. Every literal in
// this file is invented; none of it is a credential, and the point of the
// module under test is that a shape check needs nothing real to work on.
const OK = {
  STRIPE_PRICE_MONTHLY: "price_1TestMonthlyAAAAAAAAAAAA",
  STRIPE_PRICE_ANNUAL: "price_1TestAnnualBBBBBBBBBBBB",
  STRIPE_PRICE_LIFETIME: "price_1U8dXcDP0jFvlr1mqhzGYUwW",
  STRIPE_SECRET_KEY: "sk_live_notarealkeyCCCCCCCCCCCC",
  STRIPE_PUBLISHABLE_KEY: "pk_live_notarealkeyDDDDDDDDDDDD",
  STRIPE_WEBHOOK_SECRET: "whsec_notarealsecretEEEEEEEEEEEE",
};

describe("checkStripeEnvShapes", () => {
  it("passes a correctly shaped environment", () => {
    expect(checkStripeEnvShapes(OK)).toEqual([]);
  });

  it("ignores variables that are absent — this project runs without Stripe locally", () => {
    expect(checkStripeEnvShapes({})).toEqual([]);
    expect(checkStripeEnvShapes({ STRIPE_PRICE_LIFETIME: undefined })).toEqual([]);
  });

  it("ignores unrelated variables", () => {
    expect(checkStripeEnvShapes({ ...OK, DATABASE_URL: "file:./dev.db", SENTRY_DSN: "https://x" })).toEqual([]);
  });

  // THE DEFECT ITSELF, reproduced. 2026-08-24 → 2026-08-31: STRIPE_PRICE_LIFETIME
  // on Vercel Production held a copy of the live secret key. Everything else
  // was correct, the deployment was Ready, and no purchase could complete.
  // If this test ever goes green with the guard removed, the guard is a decoration.
  it("catches the 2026-08-24 defect: a secret key sitting in STRIPE_PRICE_LIFETIME", () => {
    const problems = checkStripeEnvShapes({
      ...OK,
      STRIPE_PRICE_LIFETIME: "sk_live_notarealkeyCCCCCCCCCCCC",
    });

    // Two independent nets fire on it: the prefix rule, and the rule that no
    // two Stripe variables share a value.
    expect(problems.map((p) => p.kind).sort()).toEqual(["duplicate-value", "wrong-prefix"]);

    const prefix = problems.find((p) => p.kind === "wrong-prefix");
    expect(prefix?.name).toBe("STRIPE_PRICE_LIFETIME");
    expect(prefix?.expectedPrefix).toBe("price_");
    expect(prefix?.looksLike).toContain("SECRET API key");
  });

  it("catches the same value copied between two variables even when the prefix is right", () => {
    const problems = checkStripeEnvShapes({
      ...OK,
      STRIPE_PRICE_LIFETIME: OK.STRIPE_PRICE_MONTHLY,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].kind).toBe("duplicate-value");
    // A duplicated value is a fault of the pair, so both variables are named
    // and neither is "the" culprit — the report has to point at both.
    const text = formatStripeEnvProblems(problems);
    expect(text).toContain("STRIPE_PRICE_LIFETIME");
    expect(text).toContain("STRIPE_PRICE_MONTHLY");
  });

  it.each([
    ["STRIPE_PRICE_MONTHLY", "prod_1TestProductZZZZ", "price_"],
    ["STRIPE_PRICE_ANNUAL", "cs_live_notarealsession", "price_"],
    ["STRIPE_SECRET_KEY", "price_1TestOopsAAAA", "sk_"],
    ["STRIPE_PUBLISHABLE_KEY", "sk_live_notarealkeyYYYY", "pk_"],
    ["STRIPE_WEBHOOK_SECRET", "sk_live_notarealkeyXXXX", "whsec_"],
  ])("rejects %s holding the wrong kind of object", (name, wrong, expectedPrefix) => {
    const problems = checkStripeEnvShapes({ ...OK, [name]: wrong });
    const prefix = problems.find((p) => p.kind === "wrong-prefix");
    expect(prefix?.name).toBe(name);
    expect(prefix?.expectedPrefix).toBe(expectedPrefix);
  });

  it("covers a price variable that does not exist yet — the family rule, not a hard-coded list", () => {
    const problems = checkStripeEnvShapes({ ...OK, STRIPE_PRICE_TEAM: "sk_live_notarealkeyWWWW" });
    expect(problems.some((p) => p.kind === "wrong-prefix" && p.name === "STRIPE_PRICE_TEAM")).toBe(true);
  });

  it("reports a variable that is present but empty", () => {
    const problems = checkStripeEnvShapes({ ...OK, STRIPE_PRICE_ANNUAL: "   " });
    expect(problems).toEqual([
      expect.objectContaining({ kind: "empty", name: "STRIPE_PRICE_ANNUAL" }),
    ]);
  });

  it("tolerates whitespace around an otherwise correct value", () => {
    expect(checkStripeEnvShapes({ ...OK, STRIPE_PRICE_ANNUAL: `  ${OK.STRIPE_PRICE_ANNUAL}\n` })).toEqual([]);
  });

  it("has a rule for every Stripe variable this project reads", () => {
    // Guards against a rule being deleted rather than a variable being added:
    // the four families below are the ones src/lib/plans.ts, src/lib/stripe.ts
    // and the webhook route actually consume.
    expect(STRIPE_ENV_RULES.map((r) => r.name).sort()).toEqual([
      "STRIPE_PRICE_",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);
  });
});

describe("formatStripeEnvProblems", () => {
  // The check runs in the one place the secret is legible, and writes to two
  // places a secret must never reach: the Vercel build log and Sentry. So the
  // no-leak property is load-bearing, and is asserted rather than assumed.
  it("never prints a value, not even a fragment past the prefix", () => {
    const bad = {
      ...OK,
      STRIPE_PRICE_LIFETIME: "sk_live_SUPERSECRETTAIL9999",
      STRIPE_WEBHOOK_SECRET: "pk_live_ANOTHERSECRETTAIL8888",
      STRIPE_PRICE_ANNUAL: "",
    };
    const text = formatStripeEnvProblems(checkStripeEnvShapes(bad));

    for (const value of Object.values(bad)) {
      if (value === "") continue;
      expect(text).not.toContain(value);
    }
    expect(text).not.toContain("SUPERSECRETTAIL");
    expect(text).not.toContain("ANOTHERSECRETTAIL");
    expect(text).not.toContain("9999");
  });

  it("names the variable, the expected shape, and what was found instead", () => {
    const text = formatStripeEnvProblems(
      checkStripeEnvShapes({ STRIPE_PRICE_LIFETIME: "sk_live_notarealkey" })
    );
    expect(text).toContain("STRIPE_PRICE_LIFETIME");
    expect(text).toContain('does not start with "price_"');
    expect(text).toContain("SECRET API key");
  });
});

describe("hasStripeShape", () => {
  it("is what plans.ts uses to refuse a malformed price id before Stripe sees it", () => {
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "price_1U8dXcDP0jFvlr1mqhzGYUwW")).toBe(true);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "sk_live_notarealkey")).toBe(false);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", undefined)).toBe(false);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "")).toBe(false);
  });
});
