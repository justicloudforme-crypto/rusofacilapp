import { createClient } from "@libsql/client";

// Guards against the exact outage from 2026-08-27: commit 47a7847 added
// `Story.descriptionRu` to schema.prisma and the generated client, but
// `prisma db push` was only ever run against the local dev.db — nobody ran
// it against production Turso (this project has no prisma/migrations
// folder, it's a push-based workflow with no CI step that enforces this).
// The column-less production DB then 500'd on every `/[lang]` and
// `/[lang]/stories` request for BOTH locales (Prisma selects all scalar
// columns by default, so it wasn't Russian-only despite how it looked to
// the site owner).
//
// This runs as part of `npm run build` (see package.json's "build" script)
// so it executes during the Vercel build step, which is the only place a
// real TURSO_AUTH_TOKEN is ever available to non-runtime code — local
// tooling can't hold that secret (see PROGRESS.md). It only ever ADDs
// missing nullable columns it explicitly knows about below; it never
// drops/renames/alters an existing column, so it can't cause data loss.
// A local `next dev`/`next build` has no TURSO_DATABASE_URL and no-ops.
//
// Add a new `{ table, column, sqlType }` entry here whenever a future
// schema.prisma change adds a nullable column, alongside the real Prisma
// migration — this is a safety net for forgetting to sync Turso, not a
// replacement for testing the migration.
const knownColumns = [
  { table: "Story", column: "descriptionRu", sqlType: "TEXT" },
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.log("[ensure-schema-sync] No TURSO_DATABASE_URL — skipping (local/dev build).");
    return;
  }

  const client = createClient({ url, authToken });

  for (const { table, column, sqlType } of knownColumns) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const hasColumn = info.rows.some((row) => row.name === column);
    if (hasColumn) {
      console.log(`[ensure-schema-sync] ${table}.${column} already present — skipping.`);
      continue;
    }
    console.log(`[ensure-schema-sync] Adding missing column ${table}.${column} ${sqlType}...`);
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
    console.log(`[ensure-schema-sync] Added ${table}.${column}.`);
  }

  client.close();
}

main().catch((error) => {
  console.error("[ensure-schema-sync] Failed:", error);
  process.exit(1);
});
