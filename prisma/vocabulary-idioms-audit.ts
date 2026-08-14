/**
 * Duplicate/coverage audit for the two content banks — flashcard
 * vocabulary (FlashcardCard) and idioms/proverbs (Idiom). Same spirit as
 * prisma/glossary-coverage-report.ts. Run BEFORE and AFTER adding any batch
 * to guarantee no duplicate id and no duplicate Russian word/phrase slipped
 * in, and to see the current per-level/per-category distribution before
 * deciding what a new batch should focus on.
 *
 * Previously read straight from the static TS banks in src/lib/flashcards/
 * and src/lib/idioms/ (pure imports, no DB needed) — both content types
 * moved to the DB (see FlashcardCard/Idiom models in schema.prisma) so this
 * now reads via Prisma instead. Exits non-zero if any duplicate is found,
 * so it can gate a batch-adding session:
 *   npm run db:vocabulary-audit
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

function reportDuplicates<T>(
  items: T[],
  keyFn: (item: T) => string,
  label: string,
): boolean {
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length === 0) {
    console.log(`  OK — no duplicate ${label} (${items.length} total).`);
    return false;
  }
  console.log(`  ⚠ ${duplicates.length} duplicate ${label} found:`);
  for (const [key, count] of duplicates) console.log(`    - "${key}" ×${count}`);
  return true;
}

function tally<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  let hadDuplicates = false;

  const flashcards = await db.flashcardCard.findMany();
  const idioms = await db.idiom.findMany();

  console.log("=== Flashcards (FlashcardCard) ===");
  const flashcardIdDupes = reportDuplicates(flashcards, (c) => c.id, "flashcard ids");
  const flashcardWordDupes = reportDuplicates(flashcards, (c) => c.russian, "flashcard Russian words");
  hadDuplicates = hadDuplicates || flashcardIdDupes || flashcardWordDupes;
  console.log("  By level:", tally(flashcards, (c) => c.level));
  console.log("  By category:", tally(flashcards, (c) => c.category));

  console.log("\n=== Idioms (Idiom) ===");
  const idiomIdDupes = reportDuplicates(idioms, (i) => i.id, "idiom ids");
  const idiomPhraseDupes = reportDuplicates(idioms, (i) => i.phrase, "idiom phrases");
  // Reuse of a Spanish equivalent by two DIFFERENT Russian phrases is not always
  // wrong (two idioms can legitimately share a real equivalent), but it has
  // repeatedly flagged genuine near-duplicate Russian concepts in practice
  // (see rusofasil pipeline runs 28/31) — report as a warning to investigate,
  // not a hard failure like id/phrase collisions.
  const equivalentCounts = new Map<string, string[]>();
  for (const i of idioms) {
    const key = i.spanishEquivalent.trim().toLowerCase();
    const list = equivalentCounts.get(key) ?? [];
    list.push(i.phrase);
    equivalentCounts.set(key, list);
  }
  const reusedEquivalents = [...equivalentCounts.entries()].filter(([, phrases]) => phrases.length > 1);
  if (reusedEquivalents.length === 0) {
    console.log(`  OK — no reused Spanish equivalents (${idioms.length} total).`);
  } else {
    console.log(`  ⚠ ${reusedEquivalents.length} Spanish equivalent(s) reused by multiple phrases (investigate, not auto-fail):`);
    for (const [eq, phrases] of reusedEquivalents) {
      console.log(`    - "${eq}" used by: ${phrases.join(" / ")}`);
    }
  }
  hadDuplicates = hadDuplicates || idiomIdDupes || idiomPhraseDupes;
  console.log("  By category:", tally(idioms, (i) => i.category));

  console.log("");
  if (hadDuplicates) {
    console.log("Duplicates found — fix before merging a new batch.");
    process.exitCode = 1;
  } else {
    console.log("All clear — safe to add a new batch on top of this baseline.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
