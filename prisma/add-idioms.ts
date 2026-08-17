/**
 * Batch-insert new Idiom rows from prisma/idioms-batch.json. Same rationale
 * and usage pattern as prisma/add-flashcards.ts — idioms are DB-backed only
 * now, no static source files. Reuses validateIdiomInput, the same
 * validation the admin save API applies.
 *
 * Usage: write the batch to prisma/idioms-batch.json (array of IdiomInput-
 * shaped objects), then `npm run db:add-idioms`.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { validateIdiomInput } from "../src/lib/idioms";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const batchPath = join(__dirname, "idioms-batch.json");
  const raw = JSON.parse(readFileSync(batchPath, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("idioms-batch.json must contain a JSON array");

  let inserted = 0;
  let failed = 0;
  for (const [i, entry] of raw.entries()) {
    const result = validateIdiomInput(entry);
    if (!result.valid) {
      console.error(`  ✗ entry ${i} (${(entry as { phrase?: string }).phrase ?? "?"}): ${result.error}`);
      failed++;
      continue;
    }
    const idiom = await db.idiom.create({ data: result.value });
    console.log(`  + [${idiom.id}] ${idiom.category} ${idiom.phrase}`);
    inserted++;
  }

  console.log(`\n${inserted} inserted, ${failed} failed (of ${raw.length}).`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
