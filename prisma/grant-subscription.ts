/**
 * One-off/repeatable script: grants (or extends) an active subscription for
 * a given email, so the account isn't redirected to /pricing. Mirrors the
 * "Grant" action in /admin/subscriptions but runnable straight against the
 * database, e.g.:
 *
 *   npm run db:grant-subscription -- someone@example.com
 *
 * Safe to re-run: it's an upsert-like extend/create, and won't touch any
 * other user's subscription.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Mirrors MANUAL_GRANT_DAYS / isSubscriptionActive from src/lib/subscription.ts.
// Not imported directly: that module is marked "server-only", which only
// resolves inside the Next.js build, not under a plain tsx script.
import { isEntryPoint } from "../src/lib/entry-point";
const MANUAL_GRANT_DAYS = 30;
const INACTIVE_STATUSES = new Set(["canceled", "past_due", "incomplete_expired"]);

function isSubscriptionActive(subscription: { status: string; currentPeriodEnd: Date } | null): boolean {
  if (!subscription) return false;
  if (INACTIVE_STATUSES.has(subscription.status)) return false;
  if (subscription.currentPeriodEnd.getTime() <= Date.now()) return false;
  return subscription.status === "active" || subscription.status === "trialing";
}

const email = process.argv[2]?.trim().toLowerCase() ?? "";

// Argument validation exits the process, so it must not run on import
// either — see src/lib/entry-point.ts.
if (isEntryPoint(import.meta.url) && (!email || !email.includes("@"))) {
  console.error("Usage: npm run db:grant-subscription -- <email>");
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✗ No user found with email ${email}`);
    process.exit(1);
  }

  const extraMs = MANUAL_GRANT_DAYS * 24 * 60 * 60 * 1000;
  const existing = await db.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing && isSubscriptionActive(existing)) {
    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        currentPeriodEnd: new Date(existing.currentPeriodEnd.getTime() + extraMs),
      },
    });
  } else {
    await db.subscription.create({
      data: {
        userId: user.id,
        plan: "manual",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + extraMs),
      },
    });
  }

  console.log(`✔ ${user.email} now has an active subscription (id: ${user.id})`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
