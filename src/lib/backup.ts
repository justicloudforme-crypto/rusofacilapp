import "server-only";
import { createClient } from "@libsql/client";

const RETENTION_COUNT = 14;

// Turso's free plan has no automatic point-in-time recovery — this is the
// app's only real insurance against a bad migration, a fat-fingered admin
// action, or a Turso-side incident, now that the DB holds real
// subscriptions/payments, not just seeded content.
//
// Reads the table list from sqlite_master rather than a hardcoded model
// list, so a future `prisma migrate` adding a table is backed up
// automatically instead of silently falling out of the dump.
async function dumpDatabase(): Promise<Record<string, unknown[]>> {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
    );

    const dump: Record<string, unknown[]> = {};
    for (const row of tables.rows) {
      const table = String(row.name);
      const res = await client.execute(`SELECT * FROM "${table}"`);
      dump[table] = res.rows.map((r) => ({ ...r }));
    }
    return dump;
  } finally {
    client.close();
  }
}

/** Dumps every table, uploads the result to a private Blob path, and
 * prunes old backups beyond RETENTION_COUNT. Returns a small summary safe
 * to log/return from an API route — never the dump itself, which contains
 * password hashes and other sensitive columns. */
export async function runBackup(): Promise<{ path: string; tables: number; totalRows: number }> {
  const dump = await dumpDatabase();
  const totalRows = Object.values(dump).reduce((sum, rows) => sum + rows.length, 0);

  const { put, list, del } = await import("@vercel/blob");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `backups/${timestamp}.json`;

  await put(path, JSON.stringify(dump), {
    access: "private",
    contentType: "application/json",
  });

  // Prune: ISO timestamps in the filename sort lexicographically the same
  // as chronologically, so the newest RETENTION_COUNT are just the last N
  // once the listing is sorted — no need to parse dates back out.
  const { blobs } = await list({ prefix: "backups/" });
  const sorted = blobs.map((b) => b.pathname).sort();
  const stale = sorted.slice(0, Math.max(0, sorted.length - RETENTION_COUNT));
  if (stale.length > 0) {
    await del(stale);
  }

  return { path, tables: Object.keys(dump).length, totalRows };
}
