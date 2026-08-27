/**
 * ONE-OFF, surgical fix — see PROGRESS.md's 2026-08-27 Teremok write-up
 * and prisma/fix-teremok-0-1.ts (same pattern, different fragment).
 *
 * The owner listened to the pilot concat of "Теремок" and asked for
 * itemKey "1-1" ("Увидела теремок и спрашивает: Теремок-теремок, кто в
 * тереме живёт?") to be re-voiced as the narrator (onyx) instead of the
 * mouse character's voice (nova) it was cast as — their explicit call
 * after listening, not a re-run of the automated cast/audit logic.
 * Deliberately does NOT touch the structurally identical bear line later
 * in the story ("10-1", currently voiced "echo") — only the one fragment
 * named — and does not touch any other fragment.
 *
 * Unlike fix-teremok-0-1.ts, the new clip is uploaded under a NEW,
 * content-hashed Blob key rather than overwritten at the same URL — see
 * PROGRESS.md's cache-control finding (2026-08-27): reusing an
 * already-served URL risks a stale CDN/client cache for up to 30 days.
 *
 * Usage: npx tsx prisma/fix-teremok-1-1.ts
 */
import "dotenv/config";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile as writeFileFs } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

const STORY_ID = "cmsjur3be000160ncimavidij"; // Теремок
const ITEM_KEY = "1-1";
const NARRATOR_VOICE = "onyx";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const SIMILARITY_THRESHOLD = 0.82;
const MAX_ATTEMPTS = 3;

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = normalizeForCompare(a).split(" ").filter(Boolean);
  const wordsB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (wordsA.length === 0) return wordsB.size === 0 ? 1 : 0;
  const matched = wordsA.filter((w) => wordsB.has(w)).length;
  return matched / wordsA.length;
}

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("OPENAI_API_KEY missing — nothing to do.");
    return;
  }

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const db = new PrismaClient({ adapter });

  const existing = await db.audioAsset.findUnique({
    where: { contentType_contentId_itemKey: { contentType: "story", contentId: STORY_ID, itemKey: ITEM_KEY } },
  });
  if (!existing) {
    console.log("Row not found — nothing to fix.");
    await db.$disconnect();
    return;
  }
  console.log(`Current row: voice="${existing.voice}", text="${existing.text}"`);
  if (existing.voice === NARRATOR_VOICE) {
    console.log("Already onyx — nothing to do.");
    await db.$disconnect();
    return;
  }

  const sanitized = sanitizeTextForTTS(existing.text);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teremok-fix-1-1-"));
  let finalBuffer: Buffer | null = null;
  let lastSimilarity = 0;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const buffer = await synthesizeSpeech(openaiKey, sanitized, NARRATOR_VOICE);
      const tmpFile = path.join(tmpDir, `attempt-${attempt}.mp3`);
      await writeFileFs(tmpFile, buffer);
      const segments = await transcribeAudioWithWhisper(tmpFile);
      const transcript = segments.map((s) => s.text).join(" ");
      const similarity = wordSimilarity(sanitized, transcript);
      lastSimilarity = similarity;
      console.log(`  attempt ${attempt}: ${(similarity * 100).toFixed(0)}% word match ("${transcript}")`);
      if (similarity >= SIMILARITY_THRESHOLD) {
        finalBuffer = buffer;
        break;
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  if (!finalBuffer) {
    console.error(`Audit failed after ${MAX_ATTEMPTS} attempts (best ${(lastSimilarity * 100).toFixed(0)}%). Nothing written.`);
    await db.$disconnect();
    process.exit(1);
  }

  const localDir = path.join(process.cwd(), "public", "audio", "stories", STORY_ID);
  await import("node:fs/promises").then((fs) => fs.mkdir(localDir, { recursive: true }));
  const localPath = path.join(localDir, `${ITEM_KEY}.mp3`);
  await writeFileFs(localPath, finalBuffer);

  const { parseFile } = await import("music-metadata");
  let durationSeconds: number | null = null;
  try {
    const meta = await parseFile(localPath);
    durationSeconds = typeof meta.format.duration === "number" ? meta.format.duration : null;
  } catch {
    // non-fatal
  }

  // Content-addressed key — never overwrite an already-served URL (see
  // PROGRESS.md's cache-control finding).
  const contentHash = createHash("sha256").update(finalBuffer).digest("hex").slice(0, 16);
  const { put } = await import("@vercel/blob");
  const blob = await put(`audio/stories/${STORY_ID}/${ITEM_KEY}.${contentHash}.mp3`, finalBuffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "audio/mpeg",
    token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
    storeId: process.env.AUDIO_BLOB_STORE_ID,
  });
  console.log(`Uploaded to Blob (new URL): ${blob.url}`);

  await db.audioAsset.update({
    where: { id: existing.id },
    data: { voice: NARRATOR_VOICE, durationSeconds, audioUrl: blob.url },
  });
  console.log(`dev.db row ${existing.id} updated: voice=${NARRATOR_VOICE}, durationSeconds=${durationSeconds}, audioUrl=${blob.url}`);

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
