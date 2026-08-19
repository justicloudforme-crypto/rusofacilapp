/**
 * One-time backfill: fills in AudioAsset.durationSeconds for rows that
 * predate that column (any row still NULL). New rows get it automatically
 * at generation time now (see src/lib/audio-assets.ts's probeDurationSeconds)
 * — this script only needs to run once against a database that has old
 * rows, and is safe to re-run any time after (it only ever touches rows
 * where durationSeconds IS NULL, never re-probes ones that already have a
 * value).
 *
 * Fetches each clip's actual bytes over HTTPS from the live site rather
 * than reading local files — correct regardless of whether audioUrl is a
 * relative /public path (served as a static asset from the deployment) or
 * an absolute URL, and works the same whether this script is pointed at
 * local dev.db or production.
 *
 * USAGE (against local dev.db, the default):
 *   npm run db:backfill-audio-durations
 *
 * USAGE (against production — export the same Turso credentials src/lib/db.ts
 * uses, then run the same command):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:backfill-audio-durations
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { parseBuffer } from "music-metadata";

const SITE_ORIGIN = process.env.BACKFILL_SITE_ORIGIN ?? "https://rusofacilapp.com";

// Mirrors src/lib/db.ts's own adapter selection — Turso when its env vars
// are set, otherwise the local file, so the same script works against
// either without a separate "prod mode" flag.
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

async function probeDurationSeconds(url: string): Promise<number | null> {
  const absoluteUrl = url.startsWith("http") ? url : `${SITE_ORIGIN}${url}`;
  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) {
      console.error(`  fetch failed (${res.status}) for ${absoluteUrl}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const metadata = await parseBuffer(buffer, "audio/mpeg");
    const duration = metadata.format.duration;
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
  } catch (error) {
    console.error(`  probe failed for ${absoluteUrl}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  const rows = await db.audioAsset.findMany({
    where: { durationSeconds: null },
    select: { id: true, contentType: true, contentId: true, itemKey: true, audioUrl: true },
  });

  if (rows.length === 0) {
    console.log("Nothing to backfill — every AudioAsset row already has a durationSeconds.");
    return;
  }

  console.log(`Backfilling durationSeconds for ${rows.length} row(s)...`);
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const label = `${row.contentType}/${row.contentId}/${row.itemKey}`;
    const duration = await probeDurationSeconds(row.audioUrl);
    if (duration === null) {
      failed++;
      continue;
    }
    await db.audioAsset.update({ where: { id: row.id }, data: { durationSeconds: duration } });
    updated++;
    console.log(`  ${label}: ${duration.toFixed(2)}s`);
  }

  console.log(`\n✔ Updated ${updated} row(s)${failed ? `, ${failed} failed (see errors above)` : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
