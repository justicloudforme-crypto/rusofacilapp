// Raise a Subscription row that a Premium payment failed to raise.
//
// Prepared, NOT run. Production held zero affected rows when this was
// written (PROGRESS.md 7.58) — the script exists because the answer to
// "who was affected" needs a Stripe cross-check the owner has to do by
// hand, and if that check turns up a row, the repair must already be
// written down rather than improvised against a live database.
//
// The defect it repairs (PROGRESS.md 7.55): between 24.08.2026 and
// 30.08.2026 a Premium purchase on top of an already-active subscription
// extended the period and left `plan` alone, so the buyer's row still
// said "monthly"/"annual"/"referral"/"manual" and getEntitlementTier kept
// answering "standard". The code is fixed; already-written rows are not.
//
// The safety rules are the same ones the glossary seed run (PROGRESS.md
// 7.27) and the blob delete script use, because they worked:
//
//   1. **--dry-run is the default.** Without --apply nothing is written,
//      and the run prints the exact before/after for every row in scope.
//   2. **--only=<subscriptionId>[,...] is mandatory.** There is no "all",
//      no "--all-affected", and no user-id form: the id of the exact row
//      to change has to be typed out, so a mistyped flag writes nothing
//      instead of everything.
//   3. **There is no --force.** Every guard passes on its own or the run
//      stops. A guard that can be waived is a guard that will be waived.
//   4. **The tier only ever goes up.** The new plan is a constant in this
//      file (PREMIUM_PLAN_ID), there is no --plan flag, and a row that is
//      already Premium is refused rather than rewritten — this script
//      cannot express a demotion.
//   5. **It refuses a row that is not the row it expected.** --expect-plan
//      must match what is actually stored, the row must still be active,
//      and it must be the newest row of that user (the only one
//      getLatestSubscription reads). Any mismatch stops the whole run
//      before a single write, because an unexpected shape means the
//      assumption is wrong, not that the row needs guessing at.
//
//   node scripts/raise-subscription-tier.mjs --list
//   node scripts/raise-subscription-tier.mjs --only=<id> --expect-plan=monthly
//   node scripts/raise-subscription-tier.mjs --only=<id> --expect-plan=monthly --apply
//
// Connection: PROD_TURSO_DATABASE_URL + PROD_TURSO_AUTH_TOKEN, or the
// TURSO_* pair, or DATABASE_URL for a local file. Nothing is read from a
// checked-in file and no token is ever written to one.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

// Same constant as src/lib/subscription.ts. Not imported: that module is
// `server-only` and pulls in Prisma, Redis and the Next runtime.
const PREMIUM_PLAN_ID = "lifetime";
const INACTIVE_STATUSES = new Set(["canceled", "past_due", "incomplete_expired"]);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};

const APPLY = flag("apply");
const LIST = flag("list");
const EXPECT_PLAN = arg("expect-plan").trim();
const ONLY = arg("only").split(",").map((s) => s.trim()).filter(Boolean);

function connection() {
  const url = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  return authToken ? { url, authToken } : { url };
}

const isActive = (row) =>
  !INACTIVE_STATUSES.has(row.status) &&
  Date.parse(row.currentPeriodEnd) > Date.now() &&
  (row.status === "active" || row.status === "trialing");

function describe(row, newest) {
  return (
    `  ${row.id}\n` +
    `    user=${row.userId} plan=${row.plan} status=${row.status}\n` +
    `    periodEnd=${row.currentPeriodEnd} created=${row.createdAt} updated=${row.updatedAt}\n` +
    `    active=${isActive(row)} newestRowOfThisUser=${newest}`
  );
}

async function main() {
  const conn = connection();
  if (!conn) {
    console.error("No database URL in the environment (PROD_TURSO_DATABASE_URL / TURSO_DATABASE_URL / DATABASE_URL).");
    return 1;
  }
  const db = createClient(conn);

  const all = (
    await db.execute(
      `SELECT id, userId, plan, status, currentPeriodEnd, createdAt, updatedAt
       FROM Subscription ORDER BY userId, createdAt DESC`
    )
  ).rows.map((r) => ({ ...r }));

  const newestOf = new Map();
  for (const row of all) if (!newestOf.has(row.userId)) newestOf.set(row.userId, row.id);

  console.log(`Subscription rows: ${all.length}`);
  for (const row of all) console.log(describe(row, newestOf.get(row.userId) === row.id));

  if (LIST) return 0;

  if (ONLY.length === 0) {
    console.error(
      "\n--only=<subscriptionId>[,<subscriptionId>] is required. There is no 'fix everyone' here" +
        " on purpose — run with --list to get the ids above."
    );
    return 1;
  }
  if (!EXPECT_PLAN) {
    console.error(
      "\n--expect-plan=<plan> is required: name the plan the row is supposed to be holding right now." +
        " If the stored plan is anything else, this run stops without writing."
    );
    return 1;
  }
  if (EXPECT_PLAN === PREMIUM_PLAN_ID) {
    console.error(`\n--expect-plan=${PREMIUM_PLAN_ID} makes no sense: that row is already Premium, there is nothing to raise.`);
    return 1;
  }

  const byId = new Map(all.map((r) => [r.id, r]));
  const targets = [];
  const refusals = [];
  for (const id of ONLY) {
    const row = byId.get(id);
    if (!row) {
      refusals.push(`${id}: no such Subscription row`);
      continue;
    }
    if (row.plan !== EXPECT_PLAN) {
      refusals.push(`${id}: stored plan is "${row.plan}", --expect-plan says "${EXPECT_PLAN}"`);
      continue;
    }
    if (row.plan === PREMIUM_PLAN_ID) {
      refusals.push(`${id}: already Premium — nothing to raise`);
      continue;
    }
    if (!isActive(row)) {
      // An expired or canceled row grants nothing whatever its plan says,
      // so raising it would look like a repair and change no access at all.
      refusals.push(`${id}: not active (status=${row.status}, periodEnd=${row.currentPeriodEnd}) — raising it would change no access`);
      continue;
    }
    if (newestOf.get(row.userId) !== row.id) {
      // getLatestSubscription reads the newest row by createdAt and nothing
      // else, so raising an older one is a write that nobody ever reads.
      refusals.push(`${id}: not this user's newest row (${newestOf.get(row.userId)} is) — nothing reads it`);
      continue;
    }
    targets.push(row);
  }

  if (refusals.length) {
    console.error(`\nrefused, nothing written:`);
    refusals.forEach((r) => console.error(`  ${r}`));
    // All or nothing: a partial run leaves half a decision applied and no
    // record of which half.
    return 1;
  }

  console.log(`\nin scope: ${targets.length} row(s)`);
  for (const row of targets) {
    console.log(
      `  ${row.id}  user=${row.userId}\n` +
        `    plan: "${row.plan}" -> "${PREMIUM_PLAN_ID}"   (status, period end and every other column untouched)`
    );
  }

  if (!APPLY) {
    console.log("\n--dry-run (default): nothing was written. Add --apply to do it for real.");
    return 0;
  }

  for (const row of targets) {
    // Guarded in the statement itself, not only in the checks above: if the
    // row changed between the read and this write, it updates nothing.
    const res = await db.execute({
      sql: `UPDATE Subscription SET plan = ?, updatedAt = ? WHERE id = ? AND plan = ?`,
      args: [PREMIUM_PLAN_ID, new Date().toISOString(), row.id, EXPECT_PLAN],
    });
    console.log(`  ${row.id}: ${res.rowsAffected} row(s) updated`);
    if (res.rowsAffected !== 1) {
      console.error(`  stopped: expected exactly 1 row, got ${res.rowsAffected} — the row changed under the run`);
      return 1;
    }
  }
  console.log(
    "\nDone. The 30s subscription cache means access can lag by up to half a minute;" +
      " the row itself is already correct."
  );
  return 0;
}

// Only when this file is the process entry point — see src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
