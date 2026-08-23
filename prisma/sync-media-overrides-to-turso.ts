/**
 * Syncs the local MediaOverride table (subtitles generated via the admin
 * "Generar subtítulos con Claude" action, plus embed-status flags) into
 * the PRODUCTION Turso database.
 *
 * Same root cause as the original AudioAsset gap this project just spent
 * a whole session fixing: subtitle generation (prisma/generate-media-
 * subtitles.ts) only ever wrote to the local dev.db — nothing here was
 * ever synced to production, so 232 of 233 locally-generated subtitle
 * rows never reached the live site.
 *
 * Unlike Story/GlossaryTerm, MediaOverride.mediaId is a stable natural
 * key (it's the static id from src/lib/media/mediaData.json, not a
 * database-generated cuid) — so no local-id -> prod-id remapping is
 * needed here, a plain upsert keyed by mediaId is safe. The internal `id`
 * column is never read anywhere in the app (mediaId is the real key —
 * see the @unique constraint), so it doesn't need to match between the
 * two databases either.
 *
 * Upserts by mediaId — never overwrites a prod row's manualOverride flag
 * with a local one that would clear it (a human judgment call, like
 * song-ty-uydyosh's confirmed-blocked flag, must never be silently
 * reverted by a routine content sync).
 *
 * Usage:
 *   npm run sync-media-overrides-to-turso -- --dry-run
 *   npm run sync-media-overrides-to-turso
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { createClient, type InStatement } from "@libsql/client";

const BATCH_SIZE = 200;

interface LocalRow {
  id: string;
  mediaId: string;
  subtitles: string | null;
  embedStatus: string | null;
  lastCheckedAt: string | null;
  sourceNoteAppend: string | null;
  manualOverride: number;
  updatedAt: string;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in the environment.");
    process.exit(1);
  }

  const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
  const sqlite = new Database(dbPath, { readonly: true });
  const rows = sqlite.prepare("SELECT * FROM MediaOverride").all() as LocalRow[];
  sqlite.close();

  const withSubtitles = rows.filter((r) => r.subtitles !== null).length;
  console.log(`Found ${rows.length} local MediaOverride row(s), ${withSubtitles} with subtitles.`);

  const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const existing = await turso.execute("SELECT mediaId, manualOverride FROM MediaOverride");
  const prodManualOverrides = new Set(
    (existing.rows as unknown as { mediaId: string; manualOverride: number }[])
      .filter((r) => r.manualOverride)
      .map((r) => r.mediaId)
  );
  console.log(`Turso currently has ${existing.rows.length} row(s), ${prodManualOverrides.size} manually-overridden.`);

  if (dryRun) {
    console.log(`[dry-run] Would upsert ${rows.length} row(s). No writes made.`);
    if (prodManualOverrides.size > 0) {
      console.log("Manual-override rows in prod, whose manualOverride/embedStatus fields will be preserved as-is:", [...prodManualOverrides]);
    }
    return;
  }

  // `manualOverride` is deliberately absent from the SET list — leaving a
  // column out of DO UPDATE SET leaves prod's existing value untouched,
  // which is exactly right: a human judgment call in prod must never be
  // silently reverted by a routine content sync. The embedStatus/
  // lastCheckedAt/sourceNoteAppend CASE guards do the same for the fields
  // that flag records too (bare column names in a DO UPDATE SET refer to
  // the pre-update row, same as a plain UPDATE — "excluded." is the only
  // way to reach the new/incoming values).
  const upsertSql = `INSERT INTO MediaOverride
      (id, mediaId, subtitles, embedStatus, lastCheckedAt, sourceNoteAppend, manualOverride, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mediaId) DO UPDATE SET
        subtitles = excluded.subtitles,
        embedStatus = CASE WHEN manualOverride = 1 THEN embedStatus ELSE excluded.embedStatus END,
        lastCheckedAt = CASE WHEN manualOverride = 1 THEN lastCheckedAt ELSE excluded.lastCheckedAt END,
        sourceNoteAppend = CASE WHEN manualOverride = 1 THEN sourceNoteAppend ELSE excluded.sourceNoteAppend END,
        updatedAt = excluded.updatedAt`;

  let synced = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const statements: InStatement[] = batch.map((row) => ({
      sql: upsertSql,
      args: [
        row.id,
        row.mediaId,
        row.subtitles,
        row.embedStatus,
        row.lastCheckedAt,
        row.sourceNoteAppend,
        row.manualOverride,
        row.updatedAt,
      ],
    }));
    await turso.batch(statements, "write");
    synced += batch.length;
    console.log(`... ${synced}/${rows.length} synced`);
  }

  const after = await turso.execute("SELECT count(*) as c FROM MediaOverride WHERE subtitles IS NOT NULL");
  console.log(`\nDone. Synced ${synced} row(s). Turso now has ${(after.rows[0] as unknown as { c: number }).c} row(s) with subtitles.`);
}

main();
