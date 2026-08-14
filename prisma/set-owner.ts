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

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !email.includes("@")) {
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
