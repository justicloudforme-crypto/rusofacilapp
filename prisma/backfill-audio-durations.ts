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
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { parseFile } from "music-metadata";

import { isEntryPoint } from "../src/lib/entry-point";
const SITE_ORIGIN = process.env.BACKFILL_SITE_ORIGIN ?? "https://rusofacilapp.com";

// Mirrors src/lib/db.ts's own adapter selection — Turso when its env vars
// are set, otherwise the local file, so the same script works against
// either without a separate "prod mode" flag.
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

// Probes via a temp file + parseFile, not parseBuffer — a real, confirmed
// bug: under this project's tsx/ESM module resolution, parseBuffer(buffer,
// "audio/mpeg") always fails with "Guessed MIME-type not supported:
// audio/mpeg" (see src/lib/audio-assets.ts's probeDurationSeconds for the
// full story). parseFile's extension-based lookup is unaffected.
async function probeDurationSeconds(url: string, tmpDir: string): Promise<number | null> {
  const absoluteUrl = url.startsWith("http") ? url : `${SITE_ORIGIN}${url}`;
  const tmpFile = path.join(tmpDir, `probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) {
      console.error(`  fetch failed (${res.status}) for ${absoluteUrl}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(tmpFile, buffer);
    const metadata = await parseFile(tmpFile);
    const duration = metadata.format.duration;
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
  } catch (error) {
    console.error(`  probe failed for ${absoluteUrl}:`, (error as Error).message);
    return null;
  } finally {
    await rm(tmpFile, { force: true });
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
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "audio-duration-backfill-"));

  for (const row of rows) {
    const label = `${row.contentType}/${row.contentId}/${row.itemKey}`;
    const duration = await probeDurationSeconds(row.audioUrl, tmpDir);
    if (duration === null) {
      failed++;
      continue;
    }
    await db.audioAsset.update({ where: { id: row.id }, data: { durationSeconds: duration } });
    updated++;
    console.log(`  ${label}: ${duration.toFixed(2)}s`);
  }

  await rm(tmpDir, { recursive: true, force: true });
  console.log(`\n✔ Updated ${updated} row(s)${failed ? `, ${failed} failed (see errors above)` : ""}.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
