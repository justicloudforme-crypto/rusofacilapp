import { describe, expect, it } from "vitest";
import {
  checkStripeEnvShapes,
  formatStripeEnvProblems,
  hasStripeShape,
  PROJECT_SECRETS_FOR_BOOT_CONTEXT,
  STRIPE_ENV_RULES,
  stripeEnvBootContext,
} from "./stripe-env";

// A value that has the right SHAPE and belongs to nothing. Every literal in
// this file is invented; none of it is a credential, and the point of the
// module under test is that a shape check needs nothing real to work on.
//
// ЗАХОД 7.221, СТРОКА ДОЛГА 294. До 21.09.2026 в `STRIPE_PRICE_LIFETIME`
// здесь лежал НАСТОЯЩИЙ id цены боевого аккаунта — единственное место во
// всём репозитории, где боевой `price_1…` стоял значением. Сторожу формы
// всё равно, какой это id (он смотрит на префикс и длину), а настоящий —
// это адрес боевого объекта, лежащий в открытом репозитории без нужды.
// Заменён на выдуманный той же формы. Рабочие цены кассы — В ПЕСО, их три,
// и они названы в PROGRESS.md; сюда их переносить НЕ НАДО никогда.
const OK = {
  STRIPE_PRICE_MONTHLY: "price_1TestMonthlyAAAAAAAAAAAA",
  STRIPE_PRICE_ANNUAL: "price_1TestAnnualBBBBBBBBBBBB",
  STRIPE_PRICE_LIFETIME: "price_1TestLifetimeFFFFFFFFFFFF",
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

  // A secret key copied into a price slot: the case this guard was built for,
  // on a reading of the 2026-08-24 incident that turned out to be wrong (the
  // variable actually held an ARCHIVED Price id — PROGRESS.md 7.66, and
  // src/lib/stripe-price-health.test.ts for the check that catches THAT).
  // Still a real way to break a checkout, and still worth a test: if this goes
  // green with the guard removed, the guard is a decoration.
  it("catches a secret key sitting in STRIPE_PRICE_LIFETIME", () => {
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
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "price_1TestLifetimeFFFFFFFFFFFF")).toBe(true);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "sk_live_notarealkey")).toBe(false);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", undefined)).toBe(false);
    expect(hasStripeShape("STRIPE_PRICE_LIFETIME", "")).toBe(false);
  });
});

// Заход 7.298: событие `StripeEnvWrongShape` должно само говорить, ГДЕ оно
// родилось, и не уносить ни одного значения.
function without(env: Record<string, string>, drop: string): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([key]) => key !== drop));
}

describe("stripeEnvBootContext", () => {
  const SECRETS = {
    SESSION_SECRET: "sess_notarealsecretGGGGGGGG",
    TURSO_DATABASE_URL: "libsql://notreal-HHHHHHHH.turso.io",
    TURSO_AUTH_TOKEN: "eyNotARealTokenIIIIIIII",
    CRON_SECRET: "cron_notarealJJJJJJJJ",
    SENTRY_DSN: "https://notreal@KKKKKKKK.ingest.sentry.io/1",
  };
  const DEPLOY = {
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "ca6a83017e8fdfaa3a7a4cfa5e0fc49c3ed47739",
    VERCEL_REGION: "pdx1",
  };

  it("names environment, commit, region and phase of a real deployment", () => {
    const env = { ...without(OK, "STRIPE_WEBHOOK_SECRET"), ...SECRETS, ...DEPLOY };
    const { tags, fingerprint } = stripeEnvBootContext(checkStripeEnvShapes(env), env);
    expect(tags).toMatchObject({
      vercel_env: "production",
      commit: "ca6a830",
      region: "pdx1",
      boot_phase: "runtime",
      problem_kinds: "missing",
      stripe_vars_seen: "5",
      project_secrets_seen: `${PROJECT_SECRETS_FOR_BOOT_CONTEXT.length}/${PROJECT_SECRETS_FOR_BOOT_CONTEXT.length}`,
      env_less_boot: "no",
    });
    expect(fingerprint).toEqual(["stripe-env-wrong-shape", "STRIPE_WEBHOOK_SECRET:missing"]);
  });

  it("tells a process that received no project variables at all from a broken Stripe setting", () => {
    const env = { ...DEPLOY, NEXT_PHASE: "phase-production-build" };
    const problems = checkStripeEnvShapes(env);
    expect(problems.length).toBe(5);
    const { tags, fingerprint } = stripeEnvBootContext(problems, env);
    expect(tags.env_less_boot).toBe("yes");
    expect(tags.project_secrets_seen).toBe(`0/${PROJECT_SECRETS_FOR_BOOT_CONTEXT.length}`);
    expect(tags.stripe_vars_seen).toBe("0");
    expect(tags.boot_phase).toBe("phase-production-build");
    expect(fingerprint).toHaveLength(6);
  });

  it("falls back to plain words instead of copying odd values into tags", () => {
    const env = { ...OK, STRIPE_PRICE_MONTHLY: "prod_1Wrong", VERCEL_GIT_COMMIT_SHA: "not a sha" };
    const { tags } = stripeEnvBootContext(checkStripeEnvShapes(env), env);
    expect(tags).toMatchObject({ vercel_env: "none", commit: "unknown", region: "unknown", problem_kinds: "wrong-prefix" });
  });

  it("never carries a value — not a Stripe one and not a project secret", () => {
    const env = { ...OK, STRIPE_PRICE_ANNUAL: OK.STRIPE_PRICE_MONTHLY, ...SECRETS, ...DEPLOY };
    const text = JSON.stringify(stripeEnvBootContext(checkStripeEnvShapes(env), env));
    for (const [name, value] of Object.entries({ ...OK, ...SECRETS })) {
      expect(text, name).not.toContain(value);
      expect(text, name).not.toContain(value.slice(-8));
    }
  });
});
