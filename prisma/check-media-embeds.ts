/**
 * Re-validates every media catalog item's `youtubeVideoId` against the
 * real YouTube Data API v3 (`videos.list?part=status`), and writes the
 * result back into `embedStatus`/`lastCheckedAt` in mediaData.json.
 *
 * WHY THIS EXISTS
 * The gallery has repeatedly had items go from "plays fine" to "Video
 * unavailable" on the live site after the fact — a rightsholder can claim
 * a video's embed rights, or a whole channel can get terminated, at any
 * point after it was added (see rusofasil_media_content_policy memory).
 * Neither `yt-dlp`'s `playable_in_embed` field nor YouTube's oEmbed API
 * reliably predicts this (both were confirmed to return "fine" for songs
 * that were actually broken). The Data API's `status.embeddable` /
 * `status.privacyStatus` fields are the same data YouTube's own player
 * checks, so they're authoritative — but this is still a snapshot, not a
 * guarantee for tomorrow. That's why this is a script meant to be RE-RUN
 * periodically, not a one-time sourcing-time check.
 *
 * SETUP
 * 1. Create a key at https://console.cloud.google.com/apis/credentials
 *    (enable "YouTube Data API v3" on the project first). Free tier is
 *    10,000 units/day; this script costs 1 unit per 50 videos, so the
 *    whole catalog (~150 items) costs about 3 units per run.
 * 2. Add it to .env:  YOUTUBE_API_KEY="AIza..."
 * 3. Run:             npm run check:media-embeds
 *
 * Without a key, the script prints these instructions and exits without
 * making any network calls — same "demo mode" degradation as the other
 * optional integrations in this app (Stripe, OpenAI TTS, Anthropic).
 *
 * USAGE
 *   npm run check:media-embeds            # check everything, print + save
 *   npm run check:media-embeds -- --dry-run   # print only, don't write
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkMediaEmbeds, type EmbedCheckResult } from "../src/lib/media/checkEmbeds";
import type { EmbedStatus, MediaItem } from "../src/lib/media/types";

// Reads/writes mediaData.json directly instead of importing
// src/lib/media/data.ts: that module is tagged `import "server-only"`,
// which Next's webpack build resolves via a built-in shim but plain
// `tsx` (no bundler) can't — the package isn't actually installed in
// node_modules. (This is a pre-existing issue: `generate-media-subtitles.ts`
// hits the exact same `Cannot find module 'server-only'` error today,
// unrelated to this script.) Duplicating the tiny amount of file I/O here
// keeps this script runnable standalone without touching that module.
const MEDIA_DATA_FILE = path.join(__dirname, "../src/lib/media/mediaData.json");

async function readMediaStore(): Promise<Record<string, MediaItem>> {
  const raw = await readFile(MEDIA_DATA_FILE, "utf-8");
  return JSON.parse(raw) as Record<string, MediaItem>;
}

async function saveEmbedStatuses(updates: { id: string; embedStatus: EmbedStatus; note?: string }[]) {
  const store = await readMediaStore();
  const checkedAt = new Date().toISOString().slice(0, 10);
  for (const { id, embedStatus, note } of updates) {
    if (!store[id]) continue;
    const existing = store[id];
    const flagLine = note ? `[check ${checkedAt}] ${note}` : undefined;
    const sourceNote =
      flagLine && !existing.sourceNote?.includes(flagLine)
        ? [existing.sourceNote, flagLine].filter(Boolean).join(" ")
        : existing.sourceNote;
    store[id] = { ...existing, embedStatus, lastCheckedAt: checkedAt, sourceNote };
  }
  await writeFile(MEDIA_DATA_FILE, JSON.stringify(store, null, 2) + "\n", "utf-8");
}

function parseArgs(argv: string[]) {
  return { dryRun: argv.includes("--dry-run") };
}

function toEmbedStatus(outcome: EmbedCheckResult["outcome"]): EmbedStatus | null {
  switch (outcome) {
    case "ok":
      return "ok";
    case "blocked":
    case "unavailable":
      return "blocked";
    case "check_failed":
      return null; // transient — don't overwrite the last known-good status
  }
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log(
      [
        "YOUTUBE_API_KEY is not set — nothing to do.",
        "",
        "To check media embed status:",
        "  1. Create a key at https://console.cloud.google.com/apis/credentials",
        '     (enable "YouTube Data API v3" on the project first)',
        '  2. Add it to .env:  YOUTUBE_API_KEY="AIza..."',
        "  3. Run again:       npm run check:media-embeds",
      ].join("\n"),
    );
    return;
  }

  const { dryRun } = parseArgs(process.argv.slice(2));
  const items = Object.values(await readMediaStore());
  console.log(`Checking ${items.length} media items against the YouTube Data API...`);

  const results = await checkMediaEmbeds(
    items.map((item) => ({ id: item.id, youtubeVideoId: item.youtubeVideoId })),
    apiKey,
  );

  const broken = results.filter((r) => r.outcome === "blocked" || r.outcome === "unavailable");
  const failed = results.filter((r) => r.outcome === "check_failed");
  const ok = results.filter((r) => r.outcome === "ok");

  console.log(`\n${ok.length} OK, ${broken.length} broken, ${failed.length} check failed.\n`);

  if (broken.length > 0) {
    console.log("BROKEN — needs a source swap (see rusofasil_media_content_policy memory for the pattern):");
    for (const r of broken) {
      const item = items.find((i) => i.id === r.id);
      console.log(`  [${r.outcome}] ${r.id} (${r.youtubeVideoId}) — ${item?.title ?? "?"} — ${r.reason}`);
    }
    console.log("");
  }
  if (failed.length > 0) {
    console.log("CHECK FAILED (network/API issue, not necessarily broken — status left unchanged):");
    for (const r of failed) console.log(`  ${r.id} (${r.youtubeVideoId}) — ${r.reason}`);
    console.log("");
  }

  if (dryRun) {
    console.log("--dry-run: not writing changes.");
    return;
  }

  const updates: { id: string; embedStatus: EmbedStatus; note?: string }[] = [];
  for (const r of results) {
    const embedStatus = toEmbedStatus(r.outcome);
    if (embedStatus !== null) updates.push({ id: r.id, embedStatus, note: r.reason });
  }

  await saveEmbedStatuses(updates);
  console.log(`Saved embedStatus for ${updates.length} items.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
