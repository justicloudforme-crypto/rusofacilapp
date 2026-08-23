/**
 * ONE-TIME MIGRATION — Step 1 of the audio storage plan.
 *
 * Uploads every audio file referenced by an AudioAsset row in the LOCAL
 * dev.db to Vercel Blob, and writes a resumable map
 * (prisma/audio-blob-map.json) of `old public path -> new Blob URL`.
 *
 * Deliberately does NOT touch any database (local or Turso) and does NOT
 * delete or modify any local file under public/audio — it only reads
 * files and uploads copies to Blob. Updating AudioAsset.audioUrl to the
 * new Blob URLs and syncing those rows to the production Turso database
 * is a separate later step, requiring separate approval.
 *
 * Resumable by design: on every run, rows whose audioUrl already has an
 * entry in the map are skipped, so a crash/interrupt partway through
 * (1.4GB over the network will take a while) just needs a re-run.
 * `allowOverwrite: true` covers the one edge case a resume can't already
 * handle — a file that finished uploading to Blob right before a crash,
 * before its map entry got saved.
 *
 * Usage:
 *   npm run migrate:audio-to-blob                 # upload everything not yet migrated
 *   npm run migrate:audio-to-blob -- --dry-run     # list what's pending, no network calls, no token required
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const MAP_FILE = path.join(process.cwd(), "prisma", "audio-blob-map.json");
// Project is now on Vercel Pro (upgraded specifically to remove the
// Hobby plan's 10,000 Advanced Operations/month cap, which fully
// suspended the store's read+write access for the remainder of this
// migration's first attempt). Pro's documented rate limit is 4,500/min
// (75/s) advanced ops, well above what a handful of workers can produce
// — moderate concurrency plus the retry-with-backoff below still guards
// against any transient rate-limit response.
const CONCURRENCY = 4;
const RATE_LIMIT_RETRY_DELAY_MS = 65_000; // Blob's error message says "try again in 60 seconds"
const MAX_RATE_LIMIT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AudioRow = { id: string; contentType: string; contentId: string; itemKey: string; audioUrl: string };

async function loadMap(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(MAP_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, string>): Promise<void> {
  await writeFile(MAP_FILE, JSON.stringify(map, null, 2));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // A dedicated public Blob store for narration audio, separate from the
  // pre-existing private store (BLOB_READ_WRITE_TOKEN) used for students'
  // own voice-submission recordings in src/lib/voice-storage.ts — that one
  // stays private by design, this one must be public so <audio src> can
  // fetch clips directly from the browser without a server round-trip.
  if (!dryRun && (!process.env.AUDIO_BLOB_READ_WRITE_TOKEN || !process.env.AUDIO_BLOB_STORE_ID)) {
    console.error(
      "Missing AUDIO_BLOB_READ_WRITE_TOKEN and/or AUDIO_BLOB_STORE_ID in the environment.\n" +
        "Add both to .env (from the new public 'audio_blob' store's settings in the Vercel dashboard).\n" +
        "Or pass --dry-run to preview what would be uploaded without a token."
    );
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const db = new PrismaClient({ adapter });
  const rows: AudioRow[] = await db.audioAsset.findMany({
    select: { id: true, contentType: true, contentId: true, itemKey: true, audioUrl: true },
    orderBy: { contentType: "asc" },
  });
  console.log(`Found ${rows.length} AudioAsset row(s) in the local database.`);

  const map = await loadMap();
  const queue = rows.filter((r) => !map[r.audioUrl]);
  console.log(`${rows.length - queue.length} already migrated (resuming), ${queue.length} remaining.`);

  if (dryRun) {
    const byType = new Map<string, number>();
    for (const r of queue) byType.set(r.contentType, (byType.get(r.contentType) ?? 0) + 1);
    console.log("[dry-run] Pending uploads by content type:", Object.fromEntries(byType));
    await db.$disconnect();
    return;
  }

  const { put } = await import("@vercel/blob");

  let uploaded = 0;
  let skippedMissing = 0;
  let failed = 0;

  async function worker() {
    let row: AudioRow | undefined;
    while ((row = queue.shift())) {
      const localPath = path.join(process.cwd(), "public", row.audioUrl.replace(/^\//, ""));
      let bytes: Buffer;
      try {
        bytes = await readFile(localPath);
      } catch {
        console.warn(`MISSING local file for ${row.contentType}/${row.contentId}/${row.itemKey}: ${localPath}`);
        skippedMissing++;
        continue;
      }
      let attempt = 0;
      for (;;) {
        try {
          const blob = await put(row.audioUrl.replace(/^\//, ""), bytes, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "audio/mpeg",
            token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
            storeId: process.env.AUDIO_BLOB_STORE_ID,
          });
          map[row.audioUrl] = blob.url;
          uploaded++;
          if (uploaded % 200 === 0) {
            await saveMap(map);
            console.log(`... ${uploaded} uploaded so far (${queue.length} remaining)`);
          }
          break;
        } catch (error) {
          const message = (error as Error).message;
          const isRateLimit = /too many requests/i.test(message);
          if (isRateLimit && attempt < MAX_RATE_LIMIT_RETRIES) {
            attempt++;
            console.warn(`Rate limited on ${row.audioUrl}, waiting ${RATE_LIMIT_RETRY_DELAY_MS / 1000}s (retry ${attempt}/${MAX_RATE_LIMIT_RETRIES})...`);
            await sleep(RATE_LIMIT_RETRY_DELAY_MS);
            continue;
          }
          console.error(`FAILED ${row.audioUrl}:`, message);
          failed++;
          break;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await saveMap(map);
  await db.$disconnect();

  console.log(
    `\nDone. Uploaded ${uploaded}, missing locally ${skippedMissing}, failed ${failed}.\n` +
      `Map written to ${MAP_FILE} (${Object.keys(map).length} total entries) — review it before Step 2 (updating AudioAsset.audioUrl and syncing to Turso).`
  );
}

main();
