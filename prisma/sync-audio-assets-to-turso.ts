/**
 * Step 2b — syncs the full local AudioAsset table (after Step 2a has
 * applied Blob URLs, see prisma/apply-audio-blob-urls.ts) into the
 * PRODUCTION Turso database. Only ever touches the AudioAsset table —
 * no other model. Upserts on the same (contentType, contentId, itemKey)
 * unique key Prisma itself uses, so it's safe to re-run (e.g. after
 * narrating new content later).
 *
 * Reads local rows through raw better-sqlite3 rather than the Prisma
 * Client so createdAt/updatedAt are copied through as the exact strings
 * already stored on disk (Prisma's own sqlite adapter serializes them as
 * e.g. "2026-08-21T19:28:07.643+00:00", not JS's Date#toISOString()
 * "...Z" form) — this is a mirror of existing data, not a fresh write,
 * so preserving the original values byte-for-byte avoids any drift
 * between what's stored locally and what ends up in Turso.
 *
 * Usage:
 *   npm run sync-audio-assets-to-turso -- --dry-run
 *   npm run sync-audio-assets-to-turso
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { createClient, type InStatement } from "@libsql/client";

const BATCH_SIZE = 200;

interface LocalRow {
  id: string;
  contentType: string;
  contentId: string;
  itemKey: string;
  textHash: string;
  text: string;
  voice: string;
  model: string;
  audioUrl: string;
  durationSeconds: number | null;
  createdAt: string;
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
  const rows = sqlite.prepare("SELECT * FROM AudioAsset").all() as LocalRow[];
  sqlite.close();

  const nonBlob = rows.filter((r) => !r.audioUrl.startsWith("https://"));
  if (nonBlob.length > 0) {
    console.error(
      `Refusing to sync: ${nonBlob.length} row(s) still have a non-Blob audioUrl (e.g. "${nonBlob[0].audioUrl}"). Run Step 2a (apply-audio-blob-urls) first.`
    );
    process.exit(1);
  }

  console.log(`Found ${rows.length} local AudioAsset row(s), all using Blob URLs.`);

  const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const existing = await turso.execute("select count(*) as c from AudioAsset");
  console.log(`Turso currently has ${existing.rows[0].c} AudioAsset row(s).`);

  if (dryRun) {
    console.log(`[dry-run] Would upsert ${rows.length} row(s). No writes made.`);
    return;
  }

  const upsertSql = `INSERT INTO AudioAsset
      (id, contentType, contentId, itemKey, textHash, text, voice, model, audioUrl, durationSeconds, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(contentType, contentId, itemKey) DO UPDATE SET
        id = excluded.id,
        textHash = excluded.textHash,
        text = excluded.text,
        voice = excluded.voice,
        model = excluded.model,
        audioUrl = excluded.audioUrl,
        durationSeconds = excluded.durationSeconds,
        updatedAt = excluded.updatedAt`;

  let synced = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const statements: InStatement[] = batch.map((row) => ({
      sql: upsertSql,
      args: [
        row.id,
        row.contentType,
        row.contentId,
        row.itemKey,
        row.textHash,
        row.text,
        row.voice,
        row.model,
        row.audioUrl,
        row.durationSeconds,
        row.createdAt,
        row.updatedAt,
      ],
    }));
    await turso.batch(statements, "write");
    synced += batch.length;
    if (synced % 2000 === 0 || synced === rows.length) {
      console.log(`... ${synced}/${rows.length} synced`);
    }
  }

  const after = await turso.execute("select count(*) as c from AudioAsset");
  console.log(`Done. Synced ${synced} row(s). Turso now has ${after.rows[0].c} AudioAsset row(s) total.`);
}

main();
