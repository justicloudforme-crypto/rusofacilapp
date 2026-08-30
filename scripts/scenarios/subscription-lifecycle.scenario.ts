/**
 * SCENARIO: what a person can open after a whole sequence of real events.
 *
 * Not a unit test of a function. Each case below replays an ordered
 * sequence of genuine Stripe webhook deliveries — signed with a real
 * signature and posted to the real route handler — against a real (local,
 * throwaway) database, and after every single step asks the product's own
 * access gate what the person may open now.
 *
 * That shape is the point. The defect this exists for (PROGRESS.md debt 28)
 * was not a wrong function: every function did what it said. It was that
 * two correct writes to the same row meant the second one erased the first,
 * and nothing that looked at one step at a time could see it. Only the
 * sequence shows it.
 *
 * WHAT IS REAL HERE AND WHAT IS NOT
 *   real — the webhook route (src/app/api/webhooks/stripe/route.ts), the
 *          Stripe signature check, the grant helper, the Prisma client,
 *          the database rows, and getEntitlementTier(), which is the same
 *          function the lesson pages and the proxy gate call.
 *   fake — the session (getCurrentUser is stubbed to the scenario's user;
 *          there is no browser here), and Stripe itself (no network: the
 *          events are constructed and signed locally with a test secret).
 *
 * The database is a fresh file in a temp directory, built from
 * prisma/schema.prisma at run time and deleted afterwards. The five
 * variables that can point this code at a remote database are overwritten
 * before anything from src/ is imported — see the top of beforeAll.
 *
 * Run: npm run test:scenarios
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Stripe from "stripe";
import { createClient, type Client } from "@libsql/client";

const WEBHOOK_SECRET = "whsec_scenario_only_not_a_real_secret";
const DAY = 24 * 60 * 60 * 1000;

let dbDir: string;
let dbFile: string;
let raw: Client;
// The route is typed for NextRequest; the handler only ever reads
// `.headers` and `.text()` off it, both of which a plain Request has, and a
// plain Request is what makes the delivery below a real HTTP-shaped one
// rather than a hand-built object.
let POST: (request: Request) => Promise<{ status: number }>;
let getEntitlementTier: () => Promise<"free" | "standard" | "premium">;
let invalidateSubscriptionCache: (userId: string) => Promise<void>;

/** Whose session getEntitlementTier() is answering for. Set per scenario. */
let currentUserId = "";

const stripe = new Stripe("sk_test_scenario_only_not_a_real_key");

/** A signed delivery to the real route, exactly as Stripe sends one. */
async function deliver(type: string, object: Record<string, unknown>): Promise<number> {
  const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const response = await POST(
    new Request("https://rusofacilapp.com/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    })
  );
  return response.status;
}

// --- the events, in the shapes Stripe actually sends them ----------------

const monthlySubscription = (userId: string, endsInDays: number, status = "active") => ({
  id: `sub_${userId}`,
  status,
  customer: `cus_${userId}`,
  metadata: { userId, plan: "monthly" },
  items: { data: [{ current_period_end: Math.floor((Date.now() + endsInDays * DAY) / 1000) }] },
});

const premiumCardSession = (userId: string) => ({
  id: `cs_card_${userId}`,
  mode: "payment",
  payment_status: "paid",
  client_reference_id: userId,
  metadata: { userId, plan: "lifetime" },
});

/** The SAME session object OXXO produces at voucher time: mode "payment",
 * plan "lifetime" — and payment_status "unpaid", because nothing has been
 * paid yet. Stripe fires checkout.session.completed for it immediately. */
const premiumOxxoVoucherCreated = (userId: string) => ({
  id: `cs_oxxo_${userId}`,
  mode: "payment",
  payment_status: "unpaid",
  client_reference_id: userId,
  metadata: { userId, plan: "lifetime" },
});

const premiumOxxoPaid = (userId: string) => ({
  id: `cs_oxxo_${userId}`,
  mode: "payment",
  payment_status: "paid",
  client_reference_id: userId,
  metadata: { userId, plan: "lifetime" },
});

// --- helpers -------------------------------------------------------------

async function newUser(id: string): Promise<string> {
  await raw.execute({
    sql: `INSERT INTO "User" (id, email, name, role, createdAt) VALUES (?, ?, ?, 'student', ?)`,
    args: [id, `${id}@scenario.invalid`, id, Date.now()],
  });
  currentUserId = id;
  return id;
}

async function tier(): Promise<"free" | "standard" | "premium"> {
  return getEntitlementTier();
}

async function rows(userId: string) {
  const result = await raw.execute({
    sql: `SELECT plan, status, currentPeriodEnd, stripeSubscriptionId FROM "Subscription" WHERE userId = ? ORDER BY createdAt`,
    args: [userId],
  });
  return result.rows.map((row) => ({
    plan: String(row.plan),
    status: String(row.status),
    // Prisma stores DateTime in SQLite as epoch millis, but a row written
    // by the raw client in this file carries whatever it was given — read
    // both shapes rather than assuming one.
    endsAt: String(row.currentPeriodEnd).slice(0, 24),
    stripe: row.stripeSubscriptionId === null ? "—" : "stripe",
  }));
}

/** Simulating the passage of time, not a code path: access expires on the
 * clock (isSubscriptionActive compares currentPeriodEnd to now), so a
 * period that has run out is indistinguishable from one backdated here. */
async function backdateMonthlyRow(userId: string) {
  await raw.execute({
    sql: `UPDATE "Subscription" SET currentPeriodEnd = ? WHERE userId = ? AND stripeSubscriptionId IS NOT NULL`,
    args: [Date.now() - DAY, userId],
  });
  await invalidateSubscriptionCache(userId);
}

/** Prints the access level after every step, which is the actual output of
 * this file: an assertion says "premium", a printed sequence says which
 * step it survived. */
async function step(label: string) {
  console.log(`    ${label.padEnd(46)} -> ${await tier()}`);
}

function scenario(title: string) {
  console.log(`\n  ${title}`);
}

beforeAll(async () => {
  dbDir = mkdtempSync(path.join(tmpdir(), "rusofacil-scenario-"));
  dbFile = path.join(dbDir, "scenario.db");

  // Before ANY import from src/. src/lib/db.ts builds its client from these
  // at module load, and PROGRESS.md 7.32 is about the four other variables
  // that can also reach a remote database from this tree.
  process.env.DATABASE_URL = `file:${dbFile}`;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.PROD_TURSO_DATABASE_URL;
  delete process.env.PROD_TURSO_AUTH_TOKEN;
  // No VERCEL_ENV here, so src/lib/redis.ts stays null and the cache is
  // in-process — nothing this run does can reach the shared production one.
  delete process.env.VERCEL_ENV;
  process.env.STRIPE_SECRET_KEY = "sk_test_scenario_only_not_a_real_key";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_LIFETIME;
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;

  // The real schema, not a hand-written approximation of it.
  const schemaSql = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  writeFileSync(path.join(dbDir, "schema.sql"), schemaSql);
  raw = createClient({ url: `file:${dbFile}` });
  const statements = schemaSql
    // Every statement prisma emits is preceded by a `-- CreateTable` /
    // `-- CreateIndex` comment line; strip those, keep the SQL.
    .split(";\n")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
  // A schema that produced no statements would make every case below fail
  // for the wrong reason ("no such table"), so it is an error here, not a
  // silent empty run.
  if (statements.length < 20) throw new Error(`schema build produced ${statements.length} statements`);
  for (const statement of statements) await raw.execute(statement);

  // The gate under test is getEntitlementTier(), which needs a session.
  // There is no browser here, so the session — and only the session — is
  // stubbed. Everything downstream of it is the real thing.
  vi.doMock("@/lib/auth", () => ({
    getCurrentUser: async () => ({ id: currentUserId, role: "student", email: "x@scenario.invalid" }),
  }));

  const route = await import("@/app/api/webhooks/stripe/route");
  POST = route.POST as unknown as typeof POST;
  ({ getEntitlementTier } = await import("@/lib/entitlement"));
  ({ invalidateSubscriptionCache } = await import("@/lib/subscription"));
});

afterAll(() => {
  raw?.close();
  rmSync(dbDir, { recursive: true, force: true });
});

describe("a Premium purchase made on top of an active monthly subscription", () => {
  it("survives the monthly subscription renewing", async () => {
    const user = await newUser("u-renewal");
    scenario("[1] monthly -> buys Premium -> monthly renews");

    expect(await deliver("customer.subscription.created", monthlySubscription(user, 30))).toBe(200);
    await step("active monthly subscription");
    expect(await tier()).toBe("standard");

    expect(await deliver("checkout.session.completed", premiumCardSession(user))).toBe(200);
    await step("bought Premium (card)");
    expect(await tier()).toBe("premium");

    // The renewal Stripe sends every billing period: the same subscription,
    // a new period end. This is the event that used to collapse a hundred
    // years of paid-for access back down to one month.
    expect(await deliver("customer.subscription.updated", monthlySubscription(user, 30))).toBe(200);
    await step("monthly renewed by Stripe");
    expect(await tier()).toBe("premium");

    // The step that makes the collapse visible as a LOSS OF ACCESS rather
    // than as a number in a column. Right after a renewal, a Premium
    // horizon that has been overwritten with Stripe's month still looks
    // fine — it only stops working a month later. So let the renewed month
    // run out: forever must outlive it.
    await backdateMonthlyRow(user);
    await step("...and that renewed month then ran out");
    expect(await tier()).toBe("premium");

    const stored = await rows(user);
    expect(stored).toHaveLength(2);
    expect(stored.find((r) => r.plan === "lifetime")?.stripe).toBe("—");
  });

  it("survives the monthly subscription being canceled", async () => {
    const user = await newUser("u-cancel");
    scenario("[2] monthly -> buys Premium -> monthly canceled");

    await deliver("customer.subscription.created", monthlySubscription(user, 30));
    await step("active monthly subscription");
    await deliver("checkout.session.completed", premiumCardSession(user));
    await step("bought Premium (card)");
    expect(await tier()).toBe("premium");

    // The cancellation. This is the one that used to take the purchase
    // away outright: the row went to status "canceled" while its plan
    // still honestly said "lifetime".
    expect(await deliver("customer.subscription.deleted", monthlySubscription(user, 30, "canceled"))).toBe(200);
    await step("monthly canceled by the customer");
    expect(await tier()).toBe("premium");
  });

  it("survives the monthly subscription simply running out", async () => {
    const user = await newUser("u-expiry");
    scenario("[3] monthly -> buys Premium -> monthly lapses on the clock");

    await deliver("customer.subscription.created", monthlySubscription(user, 30));
    await step("active monthly subscription");
    await deliver("checkout.session.completed", premiumCardSession(user));
    await step("bought Premium (card)");
    expect(await tier()).toBe("premium");

    // No webhook at all — the period simply passes. Access is decided on
    // the clock, so this needs no event to take effect, which is exactly
    // why it is worth a scenario of its own.
    await backdateMonthlyRow(user);
    await step("monthly period ran out (no webhook)");
    expect(await tier()).toBe("premium");
  });
});

describe("the same purchase made through OXXO, which is paid in cash days later", () => {
  it("grants nothing while the voucher is unpaid, and Premium once it is paid", async () => {
    const user = await newUser("u-oxxo");
    scenario("[4] monthly -> OXXO voucher for Premium -> paid at the store -> monthly canceled");

    await deliver("customer.subscription.created", monthlySubscription(user, 30));
    await step("active monthly subscription");

    // Stripe fires checkout.session.completed the moment the barcode is
    // generated, before any money has moved. THE VOUCHER MUST BUY NOTHING.
    expect(await deliver("checkout.session.completed", premiumOxxoVoucherCreated(user))).toBe(200);
    await step("OXXO voucher printed, not yet paid");
    expect(await tier()).toBe("standard");
    expect((await rows(user)).some((r) => r.plan === "lifetime")).toBe(false);

    expect(await deliver("checkout.session.async_payment_succeeded", premiumOxxoPaid(user))).toBe(200);
    await step("voucher paid in cash at the store");
    expect(await tier()).toBe("premium");

    await deliver("customer.subscription.deleted", monthlySubscription(user, 30, "canceled"));
    await step("monthly canceled afterwards");
    expect(await tier()).toBe("premium");
  });

  it("treats a monthly voucher the same way — nothing until the cash arrives", async () => {
    const user = await newUser("u-oxxo-monthly");
    scenario("[6] no subscription -> OXXO voucher for monthly -> paid at the store");

    const voucher = { ...premiumOxxoVoucherCreated(user), metadata: { userId: user, plan: "monthly" } };
    await deliver("checkout.session.completed", voucher);
    await step("OXXO voucher printed, not yet paid");
    expect(await tier()).toBe("free");

    await deliver("checkout.session.async_payment_succeeded", { ...voucher, payment_status: "paid" });
    await step("voucher paid in cash at the store");
    expect(await tier()).toBe("standard");
  });

  it("grants nothing at all when the voucher expires unpaid", async () => {
    const user = await newUser("u-oxxo-expired");
    scenario("[5] no subscription -> OXXO voucher for Premium -> never paid");

    await deliver("checkout.session.completed", premiumOxxoVoucherCreated(user));
    await step("OXXO voucher printed, not yet paid");
    expect(await tier()).toBe("free");

    await deliver("checkout.session.async_payment_failed", premiumOxxoVoucherCreated(user));
    await step("voucher expired unpaid");
    expect(await tier()).toBe("free");

    // Stripe sends checkout.session.expired for a voucher nobody paid;
    // both events must leave the account exactly as it was.
    await deliver("checkout.session.expired", premiumOxxoVoucherCreated(user));
    await step("session expired");
    expect(await tier()).toBe("free");
    expect(await rows(user)).toHaveLength(0);
  });
});
