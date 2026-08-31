/**
 * Positive control for the Stripe price-AUTHENTICITY check
 * (src/lib/stripe-price-health.ts).
 *
 * PROGRESS.md 4.1: a green run proves nothing unless the same code has been
 * seen going red. So this feeds the checker a set of planted environments —
 * including the real 2026-08-24 defect, an archived Price id — and fails
 * loudly if any of them is called clean. It also feeds it a correct set and
 * fails if THAT is called broken, because a check that reddens on good
 * configuration gets switched off within a day.
 *
 *   npx tsx scripts/check-stripe-price-health.ts --self-test
 *
 * No network, no Stripe key: the single Stripe call the checker makes is
 * injected, so the control runs identically on a laptop and in CI.
 *
 * The live check runs against the real Stripe account, where the credentials
 * are — GET /api/admin/stripe-health (by hand, with ADMIN_HEALTH_TOKEN) and
 * the hourly /api/cron/stripe-price-health. This file cannot do that and
 * does not pretend to.
 */
import { pathToFileURL } from "node:url";
import {
  checkStripePrices,
  formatPriceHealth,
  type PriceVerdict,
  type StripePriceFacts,
} from "../src/lib/stripe-price-health";

function fail(message: string): never {
  console.error("");
  console.error("✗ " + message);
  console.error("");
  process.exit(1);
}

const CLEAN_ENV = {
  STRIPE_PRICE_MONTHLY: "price_selftest_monthly",
  STRIPE_PRICE_ANNUAL: "price_selftest_annual",
  STRIPE_PRICE_LIFETIME: "price_selftest_lifetime",
};

/** What Stripe would answer for the healthy account. Amounts match
 * src/lib/plans.ts, which is where they are defined. */
const CLEAN_CATALOGUE: Record<string, StripePriceFacts> = {
  price_selftest_monthly: {
    active: true,
    unitAmount: 799,
    currency: "usd",
    recurringInterval: "month",
    product: "prod_selftest",
  },
  price_selftest_annual: {
    active: true,
    unitAmount: 4_799,
    currency: "usd",
    recurringInterval: "year",
    product: "prod_selftest",
  },
  price_selftest_lifetime: {
    active: true,
    unitAmount: 12_299,
    currency: "usd",
    recurringInterval: null,
    product: "prod_selftest",
  },
};

/**
 * The real defect, as it stood on production from 2026-08-24 to 2026-08-31:
 * STRIPE_PRICE_LIFETIME held the id of the 169,99 Price, which was archived
 * on 26.08. Correct prefix, real Stripe object, dead. Every "buy Premium"
 * got 400 "The price specified is inactive".
 */
const ARCHIVED_LIFETIME: StripePriceFacts = {
  active: false,
  unitAmount: 16_999,
  currency: "usd",
  recurringInterval: null,
  product: "prod_selftest",
};

interface PlantedCase {
  label: string;
  env: Record<string, string | undefined>;
  catalogue: Record<string, StripePriceFacts>;
  expectVar: string;
  expectVerdict: PriceVerdict;
}

const PLANTED: PlantedCase[] = [
  {
    label:
      "the 2026-08-24 defect — STRIPE_PRICE_LIFETIME holds the ARCHIVED 169,99 price id",
    env: { ...CLEAN_ENV, STRIPE_PRICE_LIFETIME: "price_selftest_archived" },
    catalogue: { ...CLEAN_CATALOGUE, price_selftest_archived: ARCHIVED_LIFETIME },
    expectVar: "STRIPE_PRICE_LIFETIME",
    expectVerdict: "INACTIVE",
  },
  {
    label: "a Price id that no longer exists in the Stripe account",
    env: { ...CLEAN_ENV, STRIPE_PRICE_LIFETIME: "price_selftest_deleted" },
    catalogue: CLEAN_CATALOGUE, // lookup returns null for this id
    expectVar: "STRIPE_PRICE_LIFETIME",
    expectVerdict: "NOT_FOUND",
  },
  {
    label: "a live price at the OLD amount (169,99 instead of 122,99)",
    env: CLEAN_ENV,
    catalogue: {
      ...CLEAN_CATALOGUE,
      price_selftest_lifetime: { ...ARCHIVED_LIFETIME, active: true },
    },
    expectVar: "STRIPE_PRICE_LIFETIME",
    expectVerdict: "AMOUNT_MISMATCH",
  },
  {
    label: "a live price billed in the wrong currency",
    env: CLEAN_ENV,
    catalogue: {
      ...CLEAN_CATALOGUE,
      price_selftest_annual: {
        ...CLEAN_CATALOGUE.price_selftest_annual,
        currency: "mxn",
        unitAmount: 89_900,
      },
    },
    expectVar: "STRIPE_PRICE_ANNUAL",
    expectVerdict: "CURRENCY_MISMATCH",
  },
  {
    label: "a plan whose variable is not set at all",
    env: { ...CLEAN_ENV, STRIPE_PRICE_MONTHLY: undefined },
    catalogue: CLEAN_CATALOGUE,
    expectVar: "STRIPE_PRICE_MONTHLY",
    expectVerdict: "MISSING_ENV",
  },
  {
    label: "a variable holding something that is not a Price id at all",
    env: { ...CLEAN_ENV, STRIPE_PRICE_MONTHLY: "sk_live_selftestnotarealkey" },
    catalogue: CLEAN_CATALOGUE,
    expectVar: "STRIPE_PRICE_MONTHLY",
    expectVerdict: "MISSING_ENV",
  },
];

function lookupFrom(catalogue: Record<string, StripePriceFacts>) {
  return async (priceId: string) => catalogue[priceId] ?? null;
}

async function selfTest(): Promise<void> {
  console.log("check:stripe-prices --self-test — the checker must go red on each planted case.");
  console.log("");

  const cleanReport = await checkStripePrices(CLEAN_ENV, lookupFrom(CLEAN_CATALOGUE));
  if (!cleanReport.ok) {
    console.error(formatPriceHealth(cleanReport));
    fail(
      "CONTROL BROKEN: a correct set of live, correctly priced Prices was reported as broken. " +
        "A check that rejects good configuration is turned off within a day, and then nothing is guarded."
    );
  }
  console.log("  ✓ a clean set of live prices passes (3 plans, 0 problems)");

  for (const plantedCase of PLANTED) {
    const report = await checkStripePrices(plantedCase.env, lookupFrom(plantedCase.catalogue));
    const hit = report.results.find((r) => r.envVar === plantedCase.expectVar);

    if (report.ok) {
      fail(
        `CONTROL FAILED: the checker called "${plantedCase.label}" clean. ` +
          "The guard cannot fail, so a green run of it means nothing."
      );
    }
    if (!hit || hit.verdict !== plantedCase.expectVerdict) {
      fail(
        `CONTROL FAILED: for "${plantedCase.label}" the checker returned ` +
          `${plantedCase.expectVar}=${hit?.verdict ?? "nothing"}, expected ${plantedCase.expectVerdict}.`
      );
    }

    // The report must never carry a value — it goes to an HTTP response, a
    // build/server log and a Sentry event.
    const text = JSON.stringify(report) + formatPriceHealth(report);
    for (const value of Object.values(plantedCase.env)) {
      if (value && text.includes(value)) {
        fail(`LEAK: the report for "${plantedCase.label}" contained the value of a Stripe variable.`);
      }
    }

    console.log(`  ✓ ${hit.verdict.padEnd(17)} on: ${plantedCase.label}`);
  }

  console.log("");
  console.log(
    `Control passed: ${PLANTED.length} planted defects, ${PLANTED.length} caught, ` +
      "clean set passed, 0 values printed."
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--self-test")) {
    await selfTest();
    return;
  }
  fail(
    "Nothing to do without --self-test: the live check needs Stripe credentials and runs " +
      "inside the deployment (GET /api/admin/stripe-health, or the hourly cron)."
  );
}

// Importing this file must do nothing — same entry-point rule as every other
// script here (src/lib/entry-point.test.ts).
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
