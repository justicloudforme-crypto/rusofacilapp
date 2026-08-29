/**
 * Builds ONE continuous mp3 per story by concatenating its EXISTING
 * per-sentence AudioAsset clips (never new TTS/narration — pure ffmpeg
 * concat of already-generated audio). Fixes real-device background/
 * lock-screen playback: the per-sentence chain (still the fallback for
 * stories this script skips) reassigns a shared <audio> element's `src`
 * and calls .play() from an `onended` handler for every sentence, which
 * browsers/OSes don't reliably keep advancing once the app is
 * backgrounded — see PROGRESS.md for the full investigation. A single
 * real <audio src="..."> element plays natively in the background with
 * no such issue.
 *
 * ELIGIBILITY: only stories with a real clip for EVERY sentence (same
 * coverage check as check-story-audio.ts) are concatenated — the ~15
 * partially-narrated stories are left untouched (Story.fullAudioUrl
 * stays null forever for them) and keep using the per-sentence chain.
 *
 * RESUMABLE: `Story.fullAudioUrl IS NULL` is itself the resume marker —
 * no separate checkpoint file needed. A crash/Ctrl-C mid-run loses at
 * most the one story in flight; re-running the same command skips every
 * story that already has a fullAudioUrl and only processes what's left.
 *
 * DURATION SANITY CHECK: after concatenation, the real probed duration
 * of the output file is compared against the sum of the source clips'
 * own `durationSeconds` (all 4291 story clips already have this
 * backfilled — see backfill-audio-durations.ts). Any discrepancy beyond
 * a small tolerance is logged, not silently accepted.
 *
 * ADDRESSING: every uploaded file's Blob key includes a short hash of its
 * own bytes (audio/stories/<id>/full.<hash>.mp3), never a fixed filename —
 * standing project rule (see PROGRESS.md, 2026-08-27): Vercel Blob's
 * public files are served with a 30-day Cache-Control, so overwriting an
 * already-served URL doesn't reliably reach every CDN edge/client cache
 * quickly (confirmed the hard way on a single narration-clip fix before
 * this script existed in its current form). Content-addressing sidesteps
 * that entirely — re-running this on an unchanged story reproduces the
 * exact same hash/URL (a harmless no-op re-upload), and any real change
 * to the underlying clips naturally lands at a brand-new URL with zero
 * chance of stale-cache ambiguity.
 *
 * USAGE (against local dev.db, the default):
 *   npm run concat:story-audio                          # every eligible story, writes for real
 *   npm run concat:story-audio -- --story=<id>           # PILOT: dry run only (no upload/write) for the given story/stories
 *   npm run concat:story-audio -- --story=<id> --commit  # same one/few stories, but writes for real (explicit opt-in — see PROGRESS.md's pilot-then-batch rule)
 *
 * USAGE (against production — export the same Turso + Blob credentials
 * migrate-audio-to-blob.ts uses, then run the same command):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." \
 *   AUDIO_BLOB_READ_WRITE_TOKEN="..." AUDIO_BLOB_STORE_ID="..." \
 *   npm run concat:story-audio
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseFile } from "music-metadata";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { splitSentences, splitStoryParagraphs, storyAudioItemKey } from "../src/lib/stories";
import { resolveFfmpegBinary } from "../src/lib/video-lesson/youtubeCaptions";

import { isEntryPoint } from "../src/lib/entry-point";
const execFileAsync = promisify(execFile);

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

// Tolerance for the concat-vs-sum duration sanity check — the concat
// demuxer's stream copy is lossless, but container/frame boundaries can
// introduce a fraction of a second of drift even when nothing is wrong.
const DURATION_TOLERANCE_SECONDS = 1.0;

function parseArgs(argv: string[]) {
  const storyArg = argv.find((a) => a.startsWith("--story="));
  const storyIds = storyArg ? storyArg.split("=")[1].split(",").filter(Boolean) : null;
  const commit = argv.includes("--commit");
  return { storyIds, commit };
}

interface OrderedClip {
  itemKey: string;
  audioUrl: string;
  durationSeconds: number | null;
}

async function downloadClip(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed (${res.status}) for ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, bytes);
}

async function main() {
  const { storyIds, commit } = parseArgs(process.argv.slice(2));
  // Scoped (--story=) runs are a dry run UNLESS --commit is also passed —
  // an unscoped run (the real batch) always writes for real, same as
  // before. This split exists so a pilot on a couple of stories can be
  // promoted to a real write without touching the ~300+ untouched stories
  // in one command — see PROGRESS.md's pilot-then-batch rule.
  const dryRun = storyIds !== null && !commit;

  const ffmpeg = await resolveFfmpegBinary();
  if (!ffmpeg) {
    console.error("No ffmpeg binary available (checked system PATH and imageio_ffmpeg) — nothing to do.");
    process.exitCode = 1;
    return;
  }

  if (!dryRun && (!process.env.AUDIO_BLOB_READ_WRITE_TOKEN || !process.env.AUDIO_BLOB_STORE_ID)) {
    console.error("Missing AUDIO_BLOB_READ_WRITE_TOKEN and/or AUDIO_BLOB_STORE_ID in the environment.");
    process.exitCode = 1;
    return;
  }

  const stories = storyIds
    ? await db.story.findMany({ where: { id: { in: storyIds } } })
    : await db.story.findMany({ where: { fullAudioUrl: null }, orderBy: { createdAt: "asc" } });

  console.log(`${stories.length} stories in scope.`);

  const { put } = await import("@vercel/blob");

  let concatenated = 0;
  let skippedPartial = 0;
  let skippedNoAudio = 0;

  for (const [index, story] of stories.entries()) {
    const paragraphs = splitStoryParagraphs(story.text);
    const expectedKeys: string[] = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      splitSentences(paragraph).forEach((_sentence, sentenceIndex) => {
        expectedKeys.push(storyAudioItemKey(paragraphIndex, sentenceIndex));
      });
    });

    const rows = await db.audioAsset.findMany({
      where: { contentType: "story", contentId: story.id },
      select: { itemKey: true, audioUrl: true, durationSeconds: true },
    });
    const byKey = new Map(rows.map((r) => [r.itemKey, r]));

    if (expectedKeys.length === 0 || rows.length === 0) {
      console.log(`  [${index + 1}/${stories.length}] "${story.title}" — no narration at all, skipped.`);
      skippedNoAudio++;
      continue;
    }
    const missing = expectedKeys.filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      console.log(
        `  [${index + 1}/${stories.length}] "${story.title}" — partially narrated (${missing.length}/${expectedKeys.length} sentences missing), left on the per-sentence fallback.`
      );
      skippedPartial++;
      continue;
    }

    const clips: OrderedClip[] = expectedKeys.map((key) => byKey.get(key)!);
    const sumDuration = clips.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0);

    const tmpDir = await mkdtemp(path.join(tmpdir(), "story-concat-"));
    try {
      const localPaths: string[] = [];
      for (const [i, clip] of clips.entries()) {
        const dest = path.join(tmpDir, `${String(i).padStart(4, "0")}.mp3`);
        await downloadClip(clip.audioUrl, dest);
        localPaths.push(dest);
      }

      const fileListPath = path.join(tmpDir, "filelist.txt");
      await writeFile(fileListPath, localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));

      const outputPath = path.join(tmpDir, "full.mp3");
      await execFileAsync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", fileListPath, "-c", "copy", outputPath]);

      const metadata = await parseFile(outputPath);
      const actualDuration = metadata.format.duration ?? 0;
      const drift = Math.abs(actualDuration - sumDuration);
      if (drift > DURATION_TOLERANCE_SECONDS) {
        console.warn(
          `  [${index + 1}/${stories.length}] "${story.title}" — DURATION MISMATCH: concatenated=${actualDuration.toFixed(2)}s vs sum-of-clips=${sumDuration.toFixed(2)}s (drift ${drift.toFixed(2)}s)`
        );
      }

      // Cumulative start offset of each sentence, same order as
      // buildStoryQueue() — offsets[0] is always 0.
      const offsets: number[] = [];
      let cursor = 0;
      for (const clip of clips) {
        offsets.push(cursor);
        cursor += clip.durationSeconds ?? 0;
      }

      if (dryRun) {
        // Pilot run: report what WOULD happen, but don't upload/write —
        // the owner reviews on their phone before this touches real data.
        console.log(
          `  [${index + 1}/${stories.length}] "${story.title}" — PILOT (dry run): would upload ${outputPath} (${actualDuration.toFixed(1)}s, ${clips.length} clips), offsets computed. Not written to DB/blob.`
        );
        console.log(`    Local file kept at: ${outputPath} (inspect/play it directly, then re-run with --commit to write for real)`);
        // Skip cleanup for a pilot run so the file survives for listening.
        concatenated++;
        continue;
      }

      const bytes = await readFile(outputPath);
      // Content-addressed key — see the ADDRESSING note at the top of
      // this file for why a fixed filename is never reused here.
      const contentHash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const blob = await put(`audio/stories/${story.id}/full.${contentHash}.mp3`, bytes, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/mpeg",
        token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
        storeId: process.env.AUDIO_BLOB_STORE_ID,
      });

      await db.story.update({
        where: { id: story.id },
        data: { fullAudioUrl: blob.url, sentenceOffsetsJson: JSON.stringify(offsets) },
      });

      console.log(
        `  [${index + 1}/${stories.length}] "${story.title}" — concatenated (${actualDuration.toFixed(1)}s, ${clips.length} clips) -> ${blob.url}`
      );
      concatenated++;
    } finally {
      if (!dryRun) await rm(tmpDir, { recursive: true, force: true });
    }
  }

  console.log(
    `\nDone. ${concatenated} concatenated, ${skippedPartial} skipped (partial narration), ${skippedNoAudio} skipped (no narration).`
  );
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
