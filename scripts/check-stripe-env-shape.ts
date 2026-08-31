/**
 * Refuses a build whose Stripe environment variables are the wrong SHAPE.
 *
 * Where this runs and why here. The values are marked Sensitive on Vercel:
 * they are unreadable from the repository, unreadable from the dashboard, and
 * `vercel env pull` returns `[SENSITIVE]`. The only process that can see them
 * is one they are injected into — and the earliest such process in the life of
 * a deployment is the build. So this is the first line of
 * `vercel.json`'s buildCommand and of `npm run build`, ahead of
 * ensure-schema-sync and `next build`.
 *
 * That placement is the whole point. A malformed value fails the build, the
 * deployment never reaches Ready, and the broken configuration never becomes
 * the site anybody can click "buy" on. The alternative — checking at request
 * time — reports the problem to a person who is already trying to pay.
 *
 * The check itself lives in src/lib/stripe-env.ts, so the same rules are also
 * enforced by `npm run test`, by the server at boot (src/instrumentation.ts)
 * and by src/lib/plans.ts at request time. This file is the build-time mouth.
 *
 *   npx tsx scripts/check-stripe-env-shape.ts             # check this process's env
 *   npx tsx scripts/check-stripe-env-shape.ts --self-test # positive control
 *
 * `--self-test` is the control PROGRESS.md 4.1 requires: a green run proves
 * nothing unless the same code has been seen going red. It feeds the checker
 * eight malformed environments and fails loudly if any is called clean.
 *
 * What it does NOT cover, and no shape check can: a correctly formed Price id
 * pointing at an archived or wrongly priced Price — which is what actually
 * broke Premium checkout for six days (PROGRESS.md 7.66). That is
 * `npm run check:stripe-prices:self-test` and the live endpoints behind it.
 */
import { pathToFileURL } from "node:url";
import {
  checkStripeEnvShapes,
  formatStripeEnvProblems,
  STRIPE_ENV_RULES,
  type StripeEnvProblem,
} from "../src/lib/stripe-env";

function fail(message: string): never {
  console.error("");
  console.error("✗ " + message);
  console.error("");
  process.exit(1);
}

/**
 * The positive control. Everything here is invented; the shapes are what
 * matter. Case 1 is a secret key in a price slot — the defect this guard was
 * originally, and mistakenly, believed to have been built for; it remains a
 * real way to break checkout, just not the one that happened.
 */
function selfTest(): void {
  const clean = {
    STRIPE_PRICE_MONTHLY: "price_1SelfTestMonthly",
    STRIPE_PRICE_ANNUAL: "price_1SelfTestAnnual",
    STRIPE_PRICE_LIFETIME: "price_1SelfTestLifetime",
    STRIPE_SECRET_KEY: "sk_live_selftestnotarealkey",
    STRIPE_PUBLISHABLE_KEY: "pk_live_selftestnotarealkey",
    STRIPE_WEBHOOK_SECRET: "whsec_selftestnotarealsecret",
  };

  const planted: Array<{ label: string; env: Record<string, string>; expect: string }> = [
    {
      label: "a live secret key sitting in STRIPE_PRICE_LIFETIME",
      env: { ...clean, STRIPE_PRICE_LIFETIME: clean.STRIPE_SECRET_KEY },
      expect: "STRIPE_PRICE_LIFETIME",
    },
    {
      label: "a Product id where a Price id belongs",
      env: { ...clean, STRIPE_PRICE_MONTHLY: "prod_1SelfTestProduct" },
      expect: "STRIPE_PRICE_MONTHLY",
    },
    {
      label: "a publishable key in STRIPE_SECRET_KEY",
      env: { ...clean, STRIPE_SECRET_KEY: "pk_live_selftestnotarealkey" },
      expect: "STRIPE_SECRET_KEY",
    },
    {
      label: "a secret key in STRIPE_PUBLISHABLE_KEY",
      env: { ...clean, STRIPE_PUBLISHABLE_KEY: "sk_live_selftestwrongslot" },
      expect: "STRIPE_PUBLISHABLE_KEY",
    },
    {
      label: "a Price id in STRIPE_WEBHOOK_SECRET",
      env: { ...clean, STRIPE_WEBHOOK_SECRET: "price_1SelfTestOops" },
      expect: "STRIPE_WEBHOOK_SECRET",
    },
    {
      label: "a price variable that does not exist yet (family rule)",
      env: { ...clean, STRIPE_PRICE_TEAM: "sk_live_selftestwrongslot" },
      expect: "STRIPE_PRICE_TEAM",
    },
    {
      label: "a variable that is present but empty",
      env: { ...clean, STRIPE_PRICE_ANNUAL: "" },
      expect: "STRIPE_PRICE_ANNUAL",
    },
    {
      label: "one Price id copied into two plans (right prefix, wrong plan)",
      env: { ...clean, STRIPE_PRICE_LIFETIME: clean.STRIPE_PRICE_MONTHLY },
      expect: "STRIPE_PRICE_LIFETIME",
    },
  ];

  console.log("check:stripe-env --self-test — the checker must go red on each planted case.");
  console.log("");

  const cleanProblems = checkStripeEnvShapes(clean);
  if (cleanProblems.length > 0) {
    console.error(formatStripeEnvProblems(cleanProblems));
    fail("CONTROL BROKEN: a correctly shaped environment was reported as broken. " +
      "A check that rejects good values would be turned off within a day, and then nothing is guarded.");
  }
  console.log("  ✓ a correctly shaped environment passes (0 problems)");

  for (const { label, env, expect } of planted) {
    const problems: StripeEnvProblem[] = checkStripeEnvShapes(env);
    const text = problems.length > 0 ? formatStripeEnvProblems(problems) : "";
    // Asserted against the REPORT, not the problem list: a duplicated value is
    // a fault of the pair, so the checker names both variables and neither is
    // "the" one at fault. What has to hold is that the person reading the
    // build log sees the variable they need to go and fix.
    if (problems.length === 0 || !text.includes(expect)) {
      fail(
        `CONTROL FAILED: the checker did NOT name ${expect} for "${label}". ` +
          `It reported ${problems.length} problem(s). ` +
          "The guard cannot fail, so a green run of it means nothing."
      );
    }

    // The report must never carry the value. Asserted here as well as in the
    // unit tests, because this is the copy that reaches a build log.
    for (const value of Object.values(env)) {
      if (value !== "" && text.includes(value)) {
        fail(`LEAK: the failure message for "${label}" contained the value of a Stripe variable.`);
      }
    }

    console.log(`  ✓ red on: ${label}`);
    console.log(`      → ${text.split("\n")[2].trim()}`);
  }

  console.log("");
  console.log(`Control passed: ${planted.length} planted defects, ${planted.length} caught, 0 values printed.`);
}

function main(): void {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const problems = checkStripeEnvShapes(process.env as Record<string, string | undefined>);

  if (problems.length > 0) {
    console.error(formatStripeEnvProblems(problems));
    fail("Refusing to build. Fix the variables named above and redeploy.");
  }

  const present = Object.keys(process.env).filter((key) =>
    STRIPE_ENV_RULES.some((rule) => (rule.family ? key.startsWith(rule.name) : key === rule.name))
  );

  console.log(
    present.length === 0
      ? "[check:stripe-env] No Stripe variables in this process's environment — nothing to check. " +
          "Expected on a laptop and in CI. NOTE: this reads process.env only and does NOT parse " +
          "`.env`, so a green line here says nothing about the values in your local .env file; " +
          "the run that matters is the one inside the Vercel build, where the Production values " +
          "are injected and are otherwise unreadable."
      : `[check:stripe-env] ${present.length} Stripe variable(s) present, all correctly shaped: ` +
          present.sort().join(", ")
  );
}

// Same entry-point rule every script in this repository follows (see
// src/lib/entry-point.test.ts and prisma/ensure-schema-sync.ts): importing
// this file must do nothing. `process.exit` in a module that something else
// imports is how a test run turns into a mystery.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main();
}
