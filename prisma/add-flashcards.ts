/**
 * Batch-insert new FlashcardCard rows from prisma/flashcards-batch.json.
 * Content pipeline replacement for the old "append to src/lib/flashcards/*.ts"
 * step, now that flashcards are DB-backed only (no static source files).
 * Reuses validateFlashcardInput/serializeFlashcardData — the exact same
 * validation the admin save API applies — so a batch inserted here can never
 * drift from what the admin UI would accept.
 *
 * Usage: write the batch to prisma/flashcards-batch.json (array of
 * FlashcardInput-shaped objects, synonyms/antonyms as WordRelation[] or
 * omitted), then `npm run db:add-flashcards`. Exits non-zero on any
 * validation failure without inserting anything from that entry.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { validateFlashcardInput, serializeFlashcardData } from "../src/lib/flashcards";
import { invalidateFlashcardIndex } from "../src/lib/flashcards/cache";

async function main() {
  const batchPath = join(__dirname, "flashcards-batch.json");
  const raw = JSON.parse(readFileSync(batchPath, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("flashcards-batch.json must contain a JSON array");

  let inserted = 0;
  let failed = 0;
  for (const [i, entry] of raw.entries()) {
    const result = validateFlashcardInput(entry);
    if (!result.valid) {
      console.error(`  ✗ entry ${i} (${(entry as { russian?: string }).russian ?? "?"}): ${result.error}`);
      failed++;
      continue;
    }
    const data = serializeFlashcardData(result.value);
    const card = await db.flashcardCard.create({ data });
    console.log(`  + [${card.id}] ${card.category}/${card.level} ${card.russian}`);
    inserted++;
  }

  if (inserted > 0) {
    // Without this, the live site's shared flashcard cache (Redis-backed,
    // see src/lib/flashcards/cache.ts) has no way to know this batch
    // exists — this script runs in a separate process from the deployed
    // server, so it can only invalidate a *shared* cache, never an
    // in-process one. Missing this call was the root cause of newly
    // inserted batches not appearing on the live site until the cache's
    // own TTL happened to expire.
    await invalidateFlashcardIndex();
    console.log("Invalidated the shared flashcard cache — new cards are live immediately.");
  }

  console.log(`\n${inserted} inserted, ${failed} failed (of ${raw.length}).`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
