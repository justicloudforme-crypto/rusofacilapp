/**
 * One-off/repeatable script: grants (or creates) the 'owner' role for a
 * given email. Run it after a fresh `npx prisma db push` (new database) or
 * whenever ownership needs to be reassigned — e.g.:
 *
 *   npm run db:set-owner -- owner@example.com
 *
 * Safe to re-run: it's an upsert, and won't touch any other user's role.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { isEntryPoint } from "../src/lib/entry-point";
const email = process.argv[2]?.trim().toLowerCase() ?? "";

// Argument validation exits the process, so it must not run on import
// either — see src/lib/entry-point.ts.
if (isEntryPoint(import.meta.url) && (!email || !email.includes("@"))) {
  console.error("Usage: npm run db:set-owner -- <email>");
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const user = await db.user.upsert({
    where: { email },
    update: { role: "owner" },
    create: { email, role: "owner" },
  });
  console.log(`✔ ${user.email} is now 'owner' (id: ${user.id})`);
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
