/**
 * Generates and permanently saves timestamped bilingual subtitles for the
 * media catalog (src/lib/media/mediaData.json + MediaOverride), with a
 * fallback for videos that have no YouTube caption track at all and
 * automatic chunking for long videos — the two gaps that made the web
 * admin panel's "Generar subtítulos" button unreliable for grammar
 * lecture videos (see rusofasil_media session notes).
 *
 * Runs entirely locally — no Vercel wall-clock limit to fit under, unlike
 * the API routes this duplicates the logic of (server-only and `@/` path
 * aliases are deliberately absent from youtubeCaptions.ts,
 * generateSubtitlesWithClaude.ts and whisperTranscribe.ts specifically so
 * this script can import them directly; see those files' headers).
 *
 * PIPELINE PER VIDEO
 * 1. Skip immediately if this item already has subtitles saved — see
 *    "WRITE ONCE, LOCK FOREVER" below. This check runs BEFORE any paid
 *    API call, every time, no exceptions.
 * 2. Try fetchRussianCaptions() (free — extracts an existing YouTube
 *    caption track, manual or auto-generated).
 * 3. If none exist, fall back to downloadAudioForWhisper() + OpenAI
 *    Whisper transcription (paid, ~$0.006/minute of audio).
 * 4. generateSubtitlesWithClaude() cleans up/translates the transcript,
 *    chunking internally so long videos can't get truncated by a single
 *    call's token limit or (on the web route, not here) a platform
 *    timeout.
 * 5. Saved via a local saveMediaSubtitles() reimplementation (mirrors
 *    src/lib/media/data.ts, which can't be imported directly under plain
 *    tsx — see check-media-embeds.ts's file header for the same issue).
 *
 * WRITE ONCE, LOCK FOREVER (standing project policy)
 * Once a video has subtitles saved, this script will NEVER regenerate or
 * overwrite them on a plain re-run — matches the exact policy already
 * enforced by ensureAudioAsset() for narration audio (see
 * src/lib/audio-assets.ts). There is deliberately no blanket `--force`.
 * The only way to re-generate a specific, already-subtitled item is
 * `--force=<mediaId>` naming that ONE id explicitly — for a confirmed,
 * reviewed error in already-saved subtitles, never as a routine action.
 *
 * SETUP
 *   ANTHROPIC_API_KEY  — required (Claude cleanup/translation)
 *   OPENAI_API_KEY     — required only for videos that need the Whisper
 *                         fallback (no YouTube captions at all)
 *   yt-dlp             — required on PATH or at the common pip --user
 *                         install locations (see youtubeCaptions.ts)
 *
 * USAGE
 *   npm run generate:media-subtitles -- --pilot=5              # first 5 grammar items without subtitles — always start here
 *   npm run generate:media-subtitles -- --category=grammar     # every grammar item without subtitles
 *   npm run generate:media-subtitles -- --id=video-casos-rusos # one specific item
 *   npm run generate:media-subtitles                             # ⚠ every item in the catalog without subtitles (265 items) — review the pilot's cost/quality first
 *   npm run generate:media-subtitles -- --force=video-alfabeto-ruso   # re-generate ONE already-subtitled item (confirmed error only)
 *
 *   PROD_TURSO_DATABASE_URL="libsql://..." PROD_TURSO_AUTH_TOKEN="..." \
 *     npm run generate:media-subtitles -- --id=... # write straight to production instead of local dev.db
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { fetchRussianCaptions, downloadAudioForWhisper, type CaptionLine } from "../src/lib/video-lesson/youtubeCaptions";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";
import { generateSubtitlesWithClaude } from "../src/lib/media/generateSubtitlesWithClaude";
import type { MediaItem } from "../src/lib/media/types";

const MEDIA_DATA_FILE = path.join(__dirname, "../src/lib/media/mediaData.json");

const dbUrl = process.env.PROD_TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const dbAuthToken = process.env.PROD_TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const isProd = Boolean(process.env.PROD_TURSO_DATABASE_URL);
const db = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl, authToken: dbAuthToken }) });

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
    }
  }
  throw new Error("unreachable");
}

async function saveMediaSubtitlesLocal(id: string, subtitles: CaptionLine[] | unknown): Promise<void> {
  await db.mediaOverride.upsert({
    where: { mediaId: id },
    create: { mediaId: id, subtitles: JSON.stringify(subtitles) },
    update: { subtitles: JSON.stringify(subtitles) },
  });
}

interface Args {
  pilot?: number;
  category?: string;
  id?: string;
  force?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const raw of argv) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    if (key === "pilot") args.pilot = Number(value);
    if (key === "category") args.category = value;
    if (key === "id") args.id = value;
    if (key === "force") args.force = value;
  }
  return args;
}

async function loadCatalog(): Promise<MediaItem[]> {
  const raw = await readFile(MEDIA_DATA_FILE, "utf-8");
  const store = JSON.parse(raw) as Record<string, MediaItem>;
  const overrides = await db.mediaOverride.findMany();
  const overrideById = new Map(overrides.map((o) => [o.mediaId, o]));
  return Object.values(store).map((item) => {
    const override = overrideById.get(item.id);
    return override?.subtitles ? { ...item, subtitles: JSON.parse(override.subtitles) } : item;
  });
}

async function generateOne(item: MediaItem): Promise<void> {
  console.log(`\n=== ${item.id} — "${item.title}" ===`);

  let captions: CaptionLine[] | null;
  let source: "youtube_captions" | "whisper";
  try {
    captions = await withRetry(() => fetchRussianCaptions(item.youtubeVideoId));
  } catch (error) {
    console.log(`  ✗ caption fetch failed: ${(error as Error).message}`);
    captions = null;
  }

  if (captions && captions.length > 0) {
    source = "youtube_captions";
    console.log(`  ✓ found ${captions.length} existing YouTube caption lines (free)`);
  } else {
    console.log("  … no YouTube captions found, falling back to audio + Whisper");
    if (!process.env.OPENAI_API_KEY) {
      console.log("  ✗ OPENAI_API_KEY not set — cannot use the Whisper fallback, skipping this item");
      return;
    }
    let audio;
    try {
      audio = await withRetry(() => downloadAudioForWhisper(item.youtubeVideoId));
    } catch (error) {
      console.log(`  ✗ audio download failed: ${(error as Error).message}`);
      return;
    }
    try {
      captions = await withRetry(() => transcribeAudioWithWhisper(audio.path));
      source = "whisper";
      console.log(`  ✓ Whisper transcribed ${captions.length} segments (paid)`);
    } catch (error) {
      console.log(`  ✗ Whisper transcription failed: ${(error as Error).message}`);
      return;
    } finally {
      await audio.cleanup();
    }
  }

  if (!captions || captions.length === 0) {
    console.log("  ✗ no usable transcript from either source, skipping");
    return;
  }

  try {
    const subtitles = await withRetry(() => generateSubtitlesWithClaude({ title: item.title, captions: captions! }));
    await saveMediaSubtitlesLocal(item.id, subtitles);
    console.log(
      `  ✓ saved ${subtitles.length} subtitle lines (source: ${source}) to ${isProd ? "PRODUCTION" : "local dev.db"}`,
    );
  } catch (error) {
    console.log(`  ✗ Claude generation failed: ${(error as Error).message}`);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in .env — see .env.example.");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog();

  if (args.force) {
    const item = catalog.find((i) => i.id === args.force);
    if (!item) {
      console.error(`No media item with id "${args.force}".`);
      process.exit(1);
    }
    console.log(`⚠ --force: regenerating "${item.id}" even though it already has subtitles.`);
    await generateOne(item);
    return;
  }

  let candidates = catalog.filter((item) => !item.subtitles || item.subtitles.length === 0);
  const alreadyDone = catalog.length - candidates.length;
  console.log(`${catalog.length} media items total, ${alreadyDone} already have subtitles (never touched by this run), ${candidates.length} pending.`);

  if (args.id) {
    candidates = candidates.filter((item) => item.id === args.id);
    if (candidates.length === 0) {
      const existing = catalog.find((i) => i.id === args.id);
      if (existing) {
        console.log(`"${args.id}" already has subtitles — nothing to do (use --force=${args.id} to override).`);
      } else {
        console.error(`No media item with id "${args.id}".`);
        process.exit(1);
      }
      return;
    }
  } else if (args.category) {
    candidates = candidates.filter((item) => item.category === args.category);
  }

  if (args.pilot !== undefined) {
    candidates = candidates.slice(0, args.pilot);
    console.log(`Pilot mode: processing the first ${candidates.length} of the ${args.category ?? "full"} backlog.`);
  }

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log(`Processing ${candidates.length} item(s)...`);
  for (const item of candidates) {
    await generateOne(item);
  }
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
