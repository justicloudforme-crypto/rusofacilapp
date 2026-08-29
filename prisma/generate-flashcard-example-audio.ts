/**
 * Generates pronunciation audio for flashcard EXAMPLE SENTENCES
 * (FlashcardCard.exampleRu) — the headword itself is narrated separately
 * by generate-flashcard-audio.ts (itemKey "word"); this script covers the
 * example sentence shown on the card's flip side (itemKey "example").
 * Same AudioAsset cache, same public/audio/flashcards/ directory, same
 * single-narrator ONYX voice policy, same Whisper audit-before-cache
 * pattern — see generate-flashcard-audio.ts's header for the full
 * rationale, not repeated here.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:flashcard-example-audio -- --level=A1
 *
 * USAGE
 *   npm run generate:flashcard-example-audio -- --level=A1
 *   npm run generate:flashcard-example-audio -- --category=food
 *   npm run generate:flashcard-example-audio -- --level=A1 --pilot=5
 *   npm run generate:flashcard-example-audio -- --level=A1 --category=food --force
 *
 * COST POLICY — same as generate-flashcard-audio.ts: permanent once
 * generated, cache key is the card's own id (contentId), --force requires
 * BOTH --level and --category.
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
import { invalidateFlashcardIndex } from "../src/lib/flashcards/cache";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "flashcards");
const NARRATOR_VOICE = "onyx";

const SIMILARITY_THRESHOLD = 0.82;
const AUDIT_MAX_ATTEMPTS = 5;

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : null;
  const categoryArg = argv.find((arg) => arg.startsWith("--category="));
  const category = categoryArg ? categoryArg.split("=")[1] : null;
  const pilotArg = argv.find((arg) => arg.startsWith("--pilot="));
  const pilot = pilotArg ? Number(pilotArg.split("=")[1]) : undefined;
  return { force, level, category, pilot };
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
        "To generate flashcard example-sentence audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:flashcard-example-audio -- --level=A1",
      ].join("\n")
    );
    return;
  }

  const { force, level, category, pilot } = parseArgs(process.argv.slice(2));

  if (!level && !category) {
    console.log(
      [
        "No --level or --category given — refusing to run against the whole",
        "bank by default (5600+ cards).",
        "",
        "Start with a pilot:  npm run generate:flashcard-example-audio -- --level=A1 --pilot=5",
        "Or by category:      npm run generate:flashcard-example-audio -- --category=food",
      ].join("\n")
    );
    return;
  }

  if (force && !(level && category)) {
    console.log(
      [
        "--force without BOTH --level and --category is refused on purpose.",
        "",
        "Re-narrate a narrow slice:  npm run generate:flashcard-example-audio -- --level=A1 --category=food --force",
      ].join("\n")
    );
    return;
  }

  const where: { level?: string; category?: string } = {};
  if (level) where.level = level;
  if (category) where.category = category;
  let cards = await db.flashcardCard.findMany({ where, orderBy: { id: "asc" } });
  if (pilot !== undefined) {
    cards = cards.slice(0, pilot);
  }

  if (cards.length === 0) {
    console.log(`No cards found for level="${level ?? ""}" category="${category ?? ""}".`);
    return;
  }

  console.log(`Processing ${cards.length} card(s)${pilot !== undefined ? ` (pilot, first ${pilot})` : ""}.`);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "flashcard-example-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const card of cards) {
      if (!card.exampleRu) continue;
      const text = sanitizeTextForTTS(card.exampleRu);
      const result = await ensureAudioAsset(db, {
        contentType: "flashcard",
        contentId: card.id,
        itemKey: "example",
        text,
        voice: NARRATOR_VOICE,
        model: OPENAI_TTS_MODEL,
        force,
        audioDir: AUDIO_DIR,
        publicPath: "/audio/flashcards",
        fileName: `${card.id}-example.mp3`,
        synthesize: makeAuditedSynthesize(apiKey, tmpDir),
      });

      if (result.status === "cached") {
        cached++;
        if (result.textStale) {
          stale++;
          console.log(`"${card.exampleRu}": text changed since narration — keeping existing clip (not re-billing).`);
        }
      } else if (result.status === "generated") {
        console.log(`"${card.exampleRu}": done.`);
        generated++;
      } else {
        console.error(`"${card.exampleRu}": FAILED — ${result.error}`);
        failed++;
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  if (generated > 0) {
    await invalidateFlashcardIndex();
  }

  console.log(
    `\n✔ Generated ${generated} card(s), ${cached} already cached` +
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
