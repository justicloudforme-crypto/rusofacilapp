/**
 * ONE-OFF, surgical fix — see PROGRESS.md's 2026-08-27 Teremok write-up.
 * Regenerates ONLY the AudioAsset row (contentType="story", contentId=
 * Teremok's id, itemKey="0-1"), which was found cached with voice="alloy"
 * (a leftover from the old single-voice generate-story-audio.ts, most
 * likely from the same-day partial-audio-gap fill that round-3's own
 * session notes record for this exact story). The fragment has no
 * dialogue markers at all — it is unambiguously narrator text — so the
 * fix hardcodes NARRATOR_VOICE = "onyx" to exactly match every other
 * narrator line in this story, rather than re-running the LLM cast step.
 *
 * Updates the EXISTING row IN PLACE (same `id`, plain UPDATE) rather than
 * deleting+recreating it — a delete+recreate would get a fresh cuid from
 * Prisma's default, and this project's local dev.db has already drifted
 * from production Turso's row ids for older rows (see round-3 session
 * notes / PROGRESS.md), making any full-table resync unsafe. Never
 * touching `id` here sidesteps that landmine entirely: the later Turso
 * write is a plain `UPDATE ... WHERE contentType=? AND contentId=? AND
 * itemKey=?`, matched by the same tuple already there, not a fresh insert.
 *
 * Also re-uploads to the SAME Blob object key (addRandomSuffix: false,
 * allowOverwrite: true) so the row's audioUrl string doesn't need to
 * change at all — every existing link/cache pointing at that URL keeps
 * working, now serving the corrected audio.
 *
 * Usage: npx tsx prisma/fix-teremok-0-1.ts
 */
import "dotenv/config";
import path from "node:path";
import { mkdtemp, rm, writeFile as writeFileFs } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createClient } from "@libsql/client";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

const STORY_ID = "cmsjur3be000160ncimavidij"; // Теремок
const ITEM_KEY = "0-1";
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
    console.log("Row not found — nothing to fix (already fixed, or ids changed).");
    await db.$disconnect();
    return;
  }
  console.log(`Current row: voice="${existing.voice}", audioUrl="${existing.audioUrl}"`);
  if (existing.voice === NARRATOR_VOICE) {
    console.log("Already onyx — nothing to do.");
    await db.$disconnect();
    return;
  }

  const sanitized = sanitizeTextForTTS(existing.text);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "teremok-fix-"));
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

  // Write locally (generation cache, matches the rest of the pipeline).
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
    // non-fatal, matches ensureAudioAsset's own behavior
  }

  // Re-upload to the SAME Blob object key so the URL (and every existing
  // reference to it) doesn't need to change.
  const url = new URL(existing.audioUrl);
  const blobKey = url.pathname.replace(/^\//, "");
  const { put } = await import("@vercel/blob");
  const blob = await put(blobKey, finalBuffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "audio/mpeg",
    token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
    storeId: process.env.AUDIO_BLOB_STORE_ID,
  });
  console.log(`Uploaded to Blob: ${blob.url}`);

  await db.audioAsset.update({
    where: { id: existing.id },
    data: { voice: NARRATOR_VOICE, durationSeconds, audioUrl: blob.url },
  });
  console.log(`Local dev.db row ${existing.id} updated: voice=${NARRATOR_VOICE}, durationSeconds=${durationSeconds}, audioUrl=${blob.url}`);

  // Scoped Turso update — same tuple, `id` never touched, sidesteps the
  // known local/Turso id-drift issue (see prisma/sync-audio-assets-to-turso.ts
  // and this session's PROGRESS.md note: a full-table sync is unsafe).
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    const before = await turso.execute({
      sql: `SELECT id, voice, audioUrl FROM AudioAsset WHERE contentType = ? AND contentId = ? AND itemKey = ?`,
      args: ["story", STORY_ID, ITEM_KEY],
    });
    console.log("Turso row before update:", before.rows[0]);
    if (before.rows.length === 0) {
      console.warn("No matching row in Turso — skipping Turso update (nothing to sync).");
    } else {
      await turso.execute({
        sql: `UPDATE AudioAsset SET voice = ?, durationSeconds = ?, audioUrl = ?, updatedAt = ? WHERE contentType = ? AND contentId = ? AND itemKey = ?`,
        args: [
          NARRATOR_VOICE,
          durationSeconds,
          blob.url,
          new Date().toISOString(),
          "story",
          STORY_ID,
          ITEM_KEY,
        ],
      });
      const after = await turso.execute({
        sql: `SELECT id, voice, audioUrl FROM AudioAsset WHERE contentType = ? AND contentId = ? AND itemKey = ?`,
        args: ["story", STORY_ID, ITEM_KEY],
      });
      console.log("Turso row after update:", after.rows[0]);
    }
  } else {
    console.warn("TURSO_DATABASE_URL/TURSO_AUTH_TOKEN not set — production Turso NOT updated. Run again with those set, or update manually.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
