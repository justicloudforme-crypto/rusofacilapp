/**
 * Generates pronunciation audio for idioms/proverbs (Idiom.phrase, itemKey
 * "phrase") and their context example sentence (Idiom.contextExampleRu,
 * itemKey "context") — saves .mp3 files into public/audio/idioms/. Fills
 * the shared AudioAsset cache (see src/lib/audio-assets.ts), read by
 * /api/idioms and consumed by IdiomsList.tsx.
 *
 * Same policy as every other generate-*-audio.ts script: single male ONYX
 * narrator, Whisper word-match audit before caching, permanent once
 * generated, --force scoped narrowly.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:idiom-audio -- --category=daily
 *
 * USAGE
 *   npm run generate:idiom-audio -- --category=daily          # one category only
 *   npm run generate:idiom-audio -- --pilot=5                  # first 5 idioms, for review
 *   npm run generate:idiom-audio                                 # ⚠ every idiom (771 — review cost first)
 *   npm run generate:idiom-audio -- --category=daily --force    # re-narrate one category, even cached ones
 *
 * COST POLICY — audio is permanent once generated. Cache key is the
 * idiom's own DB id (contentId), so editing text never re-bills. --force
 * requires --category (never a blanket re-narrate of all 771).
 */
import "dotenv/config";
import path from "node:path";
import { mkdtemp, rm, writeFile as writeFileFs } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { ensureAudioAsset } from "../src/lib/audio-assets";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "idioms");
const NARRATOR_VOICE = "onyx";

const SIMILARITY_THRESHOLD = 0.82;
const AUDIT_MAX_ATTEMPTS = 5;

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const categoryArg = argv.find((arg) => arg.startsWith("--category="));
  const category = categoryArg ? categoryArg.split("=")[1] : null;
  const pilotArg = argv.find((arg) => arg.startsWith("--pilot="));
  const pilot = pilotArg ? Number(pilotArg.split("=")[1]) : undefined;
  return { force, category, pilot };
}

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS request failed (${res.status}): ${errorBody.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–/+]/g, " ")
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

function makeAuditedSynthesize(apiKey: string, tmpDir: string) {
  return async (text: string, voice: string): Promise<Buffer> => {
    let lastSimilarity = 0;
    for (let attempt = 1; attempt <= AUDIT_MAX_ATTEMPTS; attempt++) {
      const buffer = await synthesizeSpeech(apiKey, text, voice);
      const tmpFile = path.join(tmpDir, `audit-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
      await writeFileFs(tmpFile, buffer);
      let transcript = "";
      try {
        const segments = await transcribeAudioWithWhisper(tmpFile);
        transcript = segments.map((s) => s.text).join(" ");
      } finally {
        await rm(tmpFile, { force: true });
      }
      const similarity = wordSimilarity(text, transcript);
      lastSimilarity = similarity;
      if (similarity >= SIMILARITY_THRESHOLD) {
        return buffer;
      }
      console.log(
        `    ⚠ audit attempt ${attempt} failed (${(similarity * 100).toFixed(0)}% word match) — ` +
          `expected "${text.slice(0, 60)}" got "${transcript.slice(0, 60)}"`
      );
    }
    throw new Error(`audit_failed_after_${AUDIT_MAX_ATTEMPTS}_attempts_${(lastSimilarity * 100).toFixed(0)}pct`);
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(
      [
        "OPENAI_API_KEY is not set — nothing to do.",
        "",
        "To generate idiom audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:idiom-audio -- --category=daily",
      ].join("\n")
    );
    return;
  }

  const { force, category, pilot } = parseArgs(process.argv.slice(2));

  if (!category && pilot === undefined) {
    console.log(
      [
        "No --category or --pilot given — refusing to run against all 771",
        "idioms by default.",
        "",
        "Start with a pilot:  npm run generate:idiom-audio -- --pilot=5",
        "Or by category:      npm run generate:idiom-audio -- --category=daily",
      ].join("\n")
    );
    return;
  }

  if (force && !category) {
    console.log(
      [
        "--force without --category is refused on purpose: it would re-pay",
        "to re-narrate every idiom, not just the ones you meant to fix.",
        "",
        "Re-narrate one category:  npm run generate:idiom-audio -- --category=daily --force",
      ].join("\n")
    );
    return;
  }

  const where: { category?: string } = {};
  if (category) where.category = category;
  let idioms = await db.idiom.findMany({ where, orderBy: { createdAt: "asc" } });
  if (pilot !== undefined) {
    idioms = idioms.slice(0, pilot);
  }

  if (idioms.length === 0) {
    console.log(`No idioms found for category="${category ?? ""}".`);
    return;
  }

  console.log(`Processing ${idioms.length} idiom(s)${pilot !== undefined ? ` (pilot, first ${pilot})` : ""}.`);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "idiom-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const idiom of idioms) {
      const phraseResult = await ensureAudioAsset(db, {
        contentType: "idiom",
        contentId: idiom.id,
        itemKey: "phrase",
        text: sanitizeTextForTTS(idiom.phrase),
        voice: NARRATOR_VOICE,
        model: OPENAI_TTS_MODEL,
        force,
        audioDir: AUDIO_DIR,
        publicPath: "/audio/idioms",
        fileName: `${idiom.id}-phrase.mp3`,
        synthesize: makeAuditedSynthesize(apiKey, tmpDir),
      });
      if (phraseResult.status === "cached") {
        cached++;
        if (phraseResult.textStale) stale++;
      } else if (phraseResult.status === "generated") {
        console.log(`"${idiom.phrase}": done.`);
        generated++;
      } else {
        console.error(`"${idiom.phrase}": FAILED — ${phraseResult.error}`);
        failed++;
      }

      if (idiom.contextExampleRu) {
        const contextResult = await ensureAudioAsset(db, {
          contentType: "idiom",
          contentId: idiom.id,
          itemKey: "context",
          text: sanitizeTextForTTS(idiom.contextExampleRu),
          voice: NARRATOR_VOICE,
          model: OPENAI_TTS_MODEL,
          force,
          audioDir: AUDIO_DIR,
          publicPath: "/audio/idioms",
          fileName: `${idiom.id}-context.mp3`,
          synthesize: makeAuditedSynthesize(apiKey, tmpDir),
        });
        const label = `  context "${idiom.contextExampleRu.slice(0, 40)}${idiom.contextExampleRu.length > 40 ? "…" : ""}"`;
        if (contextResult.status === "cached") {
          cached++;
          if (contextResult.textStale) stale++;
        } else if (contextResult.status === "generated") {
          console.log(`${label}: done.`);
          generated++;
        } else {
          console.error(`${label}: FAILED — ${contextResult.error}`);
          failed++;
        }
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  console.log(
    `\n✔ Generated ${generated} clip(s), ${cached} already cached` +
      `${stale ? ` (${stale} of those have edited text — see notes above)` : ""}` +
      `${failed ? `, ${failed} failed` : ""}.`
  );
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
