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
 *
 * THIS SCRIPT ONLY EVER APPENDS. There is no --force and no update path:
 * a run that would touch an existing row is a run that has misunderstood
 * its own input, so it refuses instead of writing anything at all. Two
 * independent collisions are checked before the first insert:
 *
 *   - `id` — an entry carrying an `id` that already exists in the table.
 *     `validateFlashcardInput` drops unknown fields, so without this check
 *     such an entry would silently become a SECOND row for the same card.
 *   - `russian` — a headword already present in the bank at any level.
 *     Duplicate headwords are the failure mode the content pipeline
 *     actually hits (see PROGRESS.md, the vocabulary audit rules).
 *
 * FLAGS
 *   --dry-run          validate + collision-check + print the numbers, write nothing
 *   --only=a,b,c       restrict the run to entries whose `russian` is listed
 *   --only-file=path   same, one `russian` per line (comments with # allowed)
 *   --self-test        run the pure collision planner against fixtures, no DB
 *
 * The `--only` list is matched against `russian`, and every name in it must
 * resolve to exactly one entry of the batch file — a typo there would
 * otherwise silently narrow the run instead of failing it.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { validateFlashcardInput, serializeFlashcardData } from "../src/lib/flashcards";
import { invalidateFlashcardIndex } from "../src/lib/flashcards/cache";

import { isEntryPoint } from "../src/lib/entry-point";

export interface BatchEntry {
  id?: unknown;
  russian?: unknown;
}

export interface ExistingRow {
  id: string;
  russian: string;
}

export interface Collision {
  index: number;
  russian: string;
  kind: "id" | "russian";
  existingId: string;
}

/**
 * Pure planner — kept separate from the DB so the positive control can
 * plant a collision on the input instead of in the production bank.
 */
export function findCollisions(entries: BatchEntry[], existing: ExistingRow[]): Collision[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const byRussian = new Map(existing.map((r) => [r.russian, r]));
  const collisions: Collision[] = [];
  for (const [index, entry] of entries.entries()) {
    const russian = typeof entry.russian === "string" ? entry.russian.trim() : "";
    if (typeof entry.id === "string" && byId.has(entry.id)) {
      collisions.push({ index, russian, kind: "id", existingId: entry.id });
      continue;
    }
    const clash = byRussian.get(russian);
    if (clash) collisions.push({ index, russian, kind: "russian", existingId: clash.id });
  }
  return collisions;
}

function parseOnlyList(): string[] | null {
  const inline = process.argv.find((a) => a.startsWith("--only="));
  const fromFile = process.argv.find((a) => a.startsWith("--only-file="));
  const names: string[] = [];
  if (inline) names.push(...inline.slice("--only=".length).split(",").map((s) => s.trim()));
  if (fromFile) {
    const path = fromFile.slice("--only-file=".length);
    names.push(
      ...readFileSync(path, "utf-8")
        .split("\n")
        .map((l) => l.replace(/#.*$/, "").trim())
    );
  }
  const cleaned = names.filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

function selfTest() {
  const existing: ExistingRow[] = [{ id: "row-1", russian: "дом" }];
  const cases: Array<[string, BatchEntry[], number, Collision["kind"] | null]> = [
    ["clean batch", [{ russian: "жилище" }], 0, null],
    ["planted id", [{ id: "row-1", russian: "жилище" }], 1, "id"],
    ["planted headword", [{ russian: "дом" }], 1, "russian"],
  ];
  let failed = 0;
  for (const [name, entries, expected, kind] of cases) {
    const found = findCollisions(entries, existing);
    const ok = found.length === expected && (kind === null || found[0]?.kind === kind);
    console.log(`  ${ok ? "✓" : "✗"} ${name}: ${found.length} collision(s)${kind ? ` (${found[0]?.kind ?? "none"})` : ""}`);
    if (!ok) failed++;
  }
  console.log(failed === 0 ? "\nself-test passed" : `\nself-test FAILED: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  if (process.argv.includes("--force")) {
    console.error("There is no --force here: this script only appends. Refusing.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const batchPath = join(__dirname, "flashcards-batch.json");
  const raw = JSON.parse(readFileSync(batchPath, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("flashcards-batch.json must contain a JSON array");

  const only = parseOnlyList();
  let entries = raw as BatchEntry[];
  if (only) {
    const wanted = new Set(only);
    const missing = only.filter((n) => !raw.some((e: BatchEntry) => e.russian === n));
    if (missing.length > 0) {
      console.error(`--only names ${missing.length} entr(y/ies) not in the batch file: ${missing.join(", ")}`);
      process.exit(1);
    }
    entries = raw.filter((e: BatchEntry) => typeof e.russian === "string" && wanted.has(e.russian));
  }

  console.log(
    `Batch file: ${raw.length} entr(y/ies); this run covers ${entries.length}${only ? ` (--only)` : ""}.`
  );

  // Collision gate — runs before ANY write, over the selected entries only.
  const existingRows = await db.flashcardCard.findMany({ select: { id: true, russian: true } });
  console.log(`Bank currently holds ${existingRows.length} card(s).`);
  const collisions = findCollisions(entries, existingRows);
  if (collisions.length > 0) {
    console.error(`\nRefusing to run: ${collisions.length} entr(y/ies) would touch an existing row.`);
    for (const c of collisions) {
      console.error(`  ✗ entry ${c.index} (${c.russian || "?"}): ${c.kind} collides with ${c.existingId}`);
    }
    console.error("Nothing was written. This script appends new rows only.");
    process.exit(1);
  }
  console.log("Collision gate: 0 entries touch an existing row.");

  let inserted = 0;
  let failed = 0;
  const byLevel = new Map<string, number>();
  for (const [i, entry] of entries.entries()) {
    const result = validateFlashcardInput(entry);
    if (!result.valid) {
      console.error(`  ✗ entry ${i} (${(entry as { russian?: string }).russian ?? "?"}): ${result.error}`);
      failed++;
      continue;
    }
    byLevel.set(result.value.level, (byLevel.get(result.value.level) ?? 0) + 1);
    if (dryRun) {
      console.log(`  ~ would create ${result.value.category}/${result.value.level} ${result.value.russian}`);
      inserted++;
      continue;
    }
    const data = serializeFlashcardData(result.value);
    const card = await db.flashcardCard.create({ data });
    console.log(`  + [${card.id}] ${card.category}/${card.level} ${card.russian}`);
    inserted++;
  }

  if (failed > 0) {
    console.error(`\n${failed} entr(y/ies) failed validation.`);
  }

  if (inserted > 0 && !dryRun) {
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

  const levels = [...byLevel.entries()].sort().map(([l, n]) => `${l} ${n}`).join(", ");
  console.log(
    `\n${dryRun ? "would create" : "created"} ${inserted}, failed ${failed} (of ${entries.length} selected, ${raw.length} in file).`
  );
  if (levels) console.log(`By level: ${levels}.`);
  if (!dryRun) console.log(`Bank: ${existingRows.length} → ${existingRows.length + inserted}.`);
  if (failed > 0) process.exitCode = 1;
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main().finally(() => db.$disconnect());
}
