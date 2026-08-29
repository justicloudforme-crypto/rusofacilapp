/**
 * One-time backfill of WordGamePuzzle.updatedAt for the rows that the
 * 02.09.2026 themed regeneration changed.
 *
 * Why it is needed. `updatedAt` is stamped automatically by Prisma on
 * every write from now on, so every FUTURE regeneration feeds sitemap.xml
 * a true lastmod with no help. But the 69 themed rows were written before
 * the column existed, so they carry no date, and re-running the generator
 * will not give them one: it compares content and skips rows that already
 * match, which those do.
 *
 * What it stamps, and what it refuses to. Only rows with `topic IS NOT
 * NULL` and `updatedAt IS NULL` — that is exactly the set the regeneration
 * rewrote and nothing else. It will not touch a row that already has a
 * date, and it will not touch a paid or mixed row, because those genuinely
 * did not change and a lastmod claiming otherwise would be a lie told to a
 * crawler.
 *
 * The date written is the date of the regeneration, passed explicitly
 * rather than defaulted to "now", so running this a week late still
 * records when the content actually changed.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *     npx tsx prisma/stamp-word-game-lastmod.ts 2026-09-02 --dry-run
 *   ... npx tsx prisma/stamp-word-game-lastmod.ts 2026-09-02
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const dateArg = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Usage: tsx prisma/stamp-word-game-lastmod.ts <YYYY-MM-DD> [--dry-run]");
  process.exit(1);
}
const stampedAt = new Date(`${dateArg}T12:00:00.000Z`);
if (Number.isNaN(stampedAt.getTime())) {
  console.error(`Not a valid date: ${dateArg}`);
  process.exit(1);
}

async function main() {
  const candidates = await db.wordGamePuzzle.findMany({
    where: { topic: { not: null }, updatedAt: null },
    select: { id: true, type: true, level: true, sequence: true, topic: true },
    orderBy: [{ type: "asc" }, { level: "asc" }, { sequence: "asc" }],
  });
  const alreadyStamped = await db.wordGamePuzzle.count({ where: { topic: { not: null }, updatedAt: { not: null } } });
  const untouched = await db.wordGamePuzzle.count({ where: { topic: null } });
  const untouchedWithDate = await db.wordGamePuzzle.count({ where: { topic: null, updatedAt: { not: null } } });

  console.log(`themed rows needing a date : ${candidates.length}`);
  console.log(`themed rows already dated  : ${alreadyStamped}`);
  console.log(`rows with no topic         : ${untouched} (of which dated: ${untouchedWithDate})`);
  console.log(`stamp date                 : ${stampedAt.toISOString()}`);
  if (DRY_RUN) console.log("\n--dry-run: nothing will be written.");

  for (const row of candidates.slice(0, 5)) {
    console.log(`  ${row.type}/${row.level}/${row.sequence} (${row.topic})`);
  }
  if (candidates.length > 5) console.log(`  … ${candidates.length - 5} more`);

  if (DRY_RUN || candidates.length === 0) return;

  // updateMany, not update-in-a-loop: `@updatedAt` would override an
  // explicit value on a normal update, and a single statement also cannot
  // half-finish.
  const result = await db.wordGamePuzzle.updateMany({
    where: { id: { in: candidates.map((r) => r.id) } },
    data: { updatedAt: stampedAt },
  });
  console.log(`\nstamped ${result.count} row(s)`);

  const check = await db.wordGamePuzzle.count({ where: { topic: { not: null }, updatedAt: null } });
  const collateral = await db.wordGamePuzzle.count({ where: { topic: null, updatedAt: { not: null } } });
  console.log(`themed rows still undated: ${check} (expected 0)`);
  console.log(`untopiced rows that gained a date: ${collateral - untouchedWithDate} (expected 0)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
