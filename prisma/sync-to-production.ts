/**
 * General-purpose content sync: copies rows that exist in local dev.db but
 * not in production Turso, for every content table (FlashcardCard, Idiom,
 * GlossaryTerm, Story). Replaces the one-off scripts improvised earlier
 * this project (push_sport_law.ts, fix_categories.ts) — those worked, but
 * relying on remembering to write one after every content batch is
 * exactly how a 1521-row gap accumulated in the first place. This is the
 * standing tool going forward.
 *
 * One-directional by design: it only INSERTS rows present locally and
 * missing in prod. It never deletes or overwrites anything already in
 * prod — a verified pre-condition (see the audit this script came out of)
 * is that prod is always a strict subset of local, never diverging, so
 * there is nothing to reconcile or choose between.
 *
 * Diffs by a CONTENT key per table, never by `id` — every content seed
 * script here (add-flashcards.ts, add-idioms.ts, seed-glossary.ts,
 * seed-stories.ts) either calls plain `.create()` with no fixed id, or
 * upserts by a natural key that isn't `id`, so the SAME row seeded
 * independently into two databases ends up with two DIFFERENT ids. An
 * earlier version of this script compared by `id` and (wrongly) reported
 * essentially the entire GlossaryTerm/Story tables as "missing" in prod
 * even though the content was already there — caught by cross-checking
 * against the live site's own API before trusting the diff.
 *
 * Dry-run by default — prints exactly what would be inserted, per table
 * (and per category/level for FlashcardCard/Idiom/GlossaryTerm/Story) and
 * makes zero writes. Pass --apply to actually insert.
 *
 * Usage:
 *   PROD_TURSO_DATABASE_URL="libsql://..." PROD_TURSO_AUTH_TOKEN="..." \
 *     npm run sync:to-production                 # dry run
 *   PROD_TURSO_DATABASE_URL="libsql://..." PROD_TURSO_AUTH_TOKEN="..." \
 *     npm run sync:to-production -- --apply       # actually insert
 *
 * Deliberately separate env var names (PROD_TURSO_*, not TURSO_*) from the
 * convention src/lib/db.ts reads — this script always opens BOTH a local
 * and a production connection in the same process, so reusing TURSO_* for
 * "the other side" would be ambiguous with whatever the shared `db`
 * import might already be pointed at.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { invalidateFlashcardIndex } from "../src/lib/flashcards/cache";

import { isEntryPoint } from "../src/lib/entry-point";
const APPLY = process.argv.includes("--apply");

const prodUrl = process.env.PROD_TURSO_DATABASE_URL ?? "";
const prodToken = process.env.PROD_TURSO_AUTH_TOKEN ?? "";
// Argument validation exits the process, so it must not run on import
// either — see src/lib/entry-point.ts.
if (isEntryPoint(import.meta.url) && (!prodUrl || !prodToken)) {
  console.error("Set PROD_TURSO_DATABASE_URL and PROD_TURSO_AUTH_TOKEN (production Turso credentials) before running this.");
  process.exit(1);
}

const localDb = new PrismaClient({ adapter: new PrismaLibSql({ url: "file:./dev.db" }) });
const prodDb = new PrismaClient({ adapter: new PrismaLibSql({ url: prodUrl, authToken: prodToken }) });

interface TableSpec<T> {
  name: string;
  findAllLocal: () => Promise<T[]>;
  keysInProd: () => Promise<Set<string>>;
  // The natural content key this table actually dedupes on — see the
  // file-level comment on why this can never be `id`.
  contentKey: (row: T) => string;
  insertIntoProd: (rows: T[]) => Promise<void>;
  // Used only for the dry-run breakdown printout — a human-readable bucket
  // label per row (category, level, whatever's most useful to skim).
  bucketOf: (row: T) => string;
}

async function syncTable<T>(spec: TableSpec<T>): Promise<number> {
  const [localRows, prodKeys] = await Promise.all([spec.findAllLocal(), spec.keysInProd()]);
  const missing = localRows.filter((row) => !prodKeys.has(spec.contentKey(row)));

  if (missing.length === 0) {
    console.log(`${spec.name}: already in sync (${localRows.length} rows).`);
    return 0;
  }

  const byBucket = new Map<string, number>();
  for (const row of missing) {
    const bucket = spec.bucketOf(row);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1);
  }
  const bucketSummary = Array.from(byBucket.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(", ");

  console.log(`${spec.name}: ${missing.length} row(s) missing in prod (of ${localRows.length} local) — ${bucketSummary}`);

  if (APPLY) {
    await spec.insertIntoProd(missing);
    console.log(`  -> inserted ${missing.length} row(s) into production.`);
  }

  return missing.length;
}

async function main() {
  console.log(APPLY ? "Mode: APPLY (writing to production)" : "Mode: DRY RUN (no writes — pass --apply to actually sync)");
  console.log();

  let totalMissing = 0;

  totalMissing += await syncTable({
    name: "FlashcardCard",
    findAllLocal: () => localDb.flashcardCard.findMany(),
    // The bank deliberately reuses the same Russian word across categories
    // on purpose (e.g. "красивый" appears once under clothing and again
    // under synonymsAntonyms as a cross-reference) — verified locally:
    // 5678 rows, only 5668 distinct `russian`, but exactly 5678 distinct
    // (russian, category) pairs. Keying on russian alone would treat that
    // deliberate reuse as a false "already exists" collision.
    contentKey: (row) => `${row.russian}|${row.category}`,
    keysInProd: async () => {
      const rows = await prodDb.flashcardCard.findMany({ select: { russian: true, category: true } });
      return new Set(rows.map((r) => `${r.russian}|${r.category}`));
    },
    bucketOf: (row) => `${row.category}/${row.level}`,
    insertIntoProd: async (rows) => {
      for (const row of rows) await prodDb.flashcardCard.create({ data: row });
    },
  });

  totalMissing += await syncTable({
    name: "Idiom",
    findAllLocal: () => localDb.idiom.findMany(),
    contentKey: (row) => row.phrase,
    keysInProd: async () => {
      const rows = await prodDb.idiom.findMany({ select: { phrase: true } });
      return new Set(rows.map((r) => r.phrase));
    },
    bucketOf: (row) => `${row.category}/${row.level}`,
    insertIntoProd: async (rows) => {
      for (const row of rows) await prodDb.idiom.create({ data: row });
    },
  });

  totalMissing += await syncTable({
    name: "GlossaryTerm",
    findAllLocal: () => localDb.glossaryTerm.findMany(),
    // Matches seed-glossary.ts's own dedup key (`upserts by slug`) —
    // slug already has a unique constraint in the schema.
    contentKey: (row) => row.slug,
    keysInProd: async () => {
      const rows = await prodDb.glossaryTerm.findMany({ select: { slug: true } });
      return new Set(rows.map((r) => r.slug));
    },
    bucketOf: (row) => row.category,
    insertIntoProd: async (rows) => {
      for (const row of rows) await prodDb.glossaryTerm.create({ data: row });
    },
  });

  totalMissing += await syncTable({
    name: "Story",
    findAllLocal: () => localDb.story.findMany(),
    // Matches seed-stories.ts's own dedup key (findFirst by title+author).
    contentKey: (row) => `${row.title}|${row.author}`,
    keysInProd: async () => {
      const rows = await prodDb.story.findMany({ select: { title: true, author: true } });
      return new Set(rows.map((r) => `${r.title}|${r.author}`));
    },
    bucketOf: (row) => row.level,
    insertIntoProd: async (rows) => {
      for (const row of rows) await prodDb.story.create({ data: row });
    },
  });

  console.log();
  if (!APPLY) {
    console.log(`${totalMissing} row(s) total would be inserted. Re-run with --apply to actually sync.`);
    return;
  }

  if (totalMissing > 0) {
    // Redis (Upstash)-backed, not tied to either SQL connection above —
    // local .env already holds the same live Upstash credentials
    // production uses (see src/lib/redis.ts), so this reaches the real
    // shared cache without any extra wiring.
    await invalidateFlashcardIndex();
    console.log("Production flashcard cache invalidated.");
  }
  console.log(`Done — ${totalMissing} row(s) synced to production.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => Promise.all([localDb.$disconnect(), prodDb.$disconnect()]));
}
