/**
 * Step 2a — LOCAL ONLY. Applies the public/audio -> Vercel Blob URL map
 * produced by Step 1 (prisma/migrate-audio-to-blob.ts, prisma/audio-blob-map.json)
 * to the local AudioAsset.audioUrl column, so every row points at its real
 * Blob URL instead of the old /audio/... path that no longer resolves on
 * a deployed site.
 *
 * Never touches Turso — that's Step 2b (prisma/sync-audio-assets-to-turso.ts),
 * a separate, explicitly-approved later run. Idempotent: any row whose
 * audioUrl already starts with "https://" is left alone, so re-running
 * after a partial run or after Step 2b just does nothing to already-migrated
 * rows.
 *
 * Usage:
 *   npm run apply-audio-blob-urls -- --dry-run
 *   npm run apply-audio-blob-urls
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { isEntryPoint } from "../src/lib/entry-point";
const MAP_FILE = path.join(process.cwd(), "prisma", "audio-blob-map.json");
const BATCH_SIZE = 500;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const map: Record<string, string> = JSON.parse(await readFile(MAP_FILE, "utf-8"));

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const db = new PrismaClient({ adapter });

  const rows = await db.audioAsset.findMany({ select: { id: true, audioUrl: true } });
  console.log(`Found ${rows.length} AudioAsset row(s) locally, map has ${Object.keys(map).length} entries.`);

  let alreadyBlob = 0;
  let noMapping = 0;
  const updates: { id: string; newUrl: string }[] = [];

  for (const row of rows) {
    if (row.audioUrl.startsWith("https://")) {
      alreadyBlob++;
      continue;
    }
    const newUrl = map[row.audioUrl];
    if (!newUrl) {
      console.warn(`No Blob mapping for row ${row.id} (${row.audioUrl})`);
      noMapping++;
      continue;
    }
    updates.push({ id: row.id, newUrl });
  }

  console.log(`To update: ${updates.length}, already Blob URLs: ${alreadyBlob}, no mapping found: ${noMapping}`);

  if (dryRun) {
    console.log("[dry-run] No changes written. Sample of what would change:");
    for (const u of updates.slice(0, 3)) console.log(" ", u);
    await db.$disconnect();
    return;
  }

  let updated = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map((u) => db.audioAsset.update({ where: { id: u.id }, data: { audioUrl: u.newUrl } }))
    );
    updated += batch.length;
    console.log(`... ${updated}/${updates.length} updated`);
  }

  await db.$disconnect();
  console.log(`Done. Updated ${updated} row(s) with their Blob URL.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main();
}
