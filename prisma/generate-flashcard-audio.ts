/**
 * Generates pronunciation audio for flashcard headwords using OpenAI's
 * text-to-speech API, and saves the .mp3 files into
 * public/audio/flashcards/. Fills the shared AudioAsset cache (see
 * src/lib/audio-assets.ts) so SpeakButton can play a real file instead of
 * relying on the browser's Web Speech API.
 *
 * Only the headword (`russian`) is narrated for now, not `exampleRu` — the
 * flashcard bank is large (4000+ cards), so start with the word itself and
 * revisit examples later if it's worth the extra cost.
 *
 * VOICE — single male narrator (ONYX, matching the story/glossary narrator
 * voice for a consistent brand voice), always. Explicit project owner
 * policy: no female voice anywhere in the vocabulary/dictionary reading —
 * that alternation is reserved for the alphabet only (see
 * generate-lesson-audio.ts's alphabet handling). No --voice override here
 * on purpose, so this can't drift from that policy by accident.
 *
 * SYNTHESIS AUDIT — before any clip is written to the AudioAsset cache, it
 * is transcribed back with Whisper and diffed against the exact text sent
 * to TTS (word-similarity compare, ё/е folded — see generate-story-audio-
 * cast.ts and generate-glossary-audio.ts for the same pattern and why the
 * ё fold matters). Below SIMILARITY_THRESHOLD, the clip is discarded and
 * re-synthesized (up to AUDIT_MAX_ATTEMPTS times) rather than ever cached.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:flashcard-audio -- --level=A1
 *
 * Without a key, the script prints these instructions and exits without
 * making any network calls or touching the database — same "demo mode"
 * degradation as the other generate-*-audio.ts scripts.
 *
 * USAGE
 *   npm run generate:flashcard-audio -- --level=A1              # one level only
 *   npm run generate:flashcard-audio -- --category=food          # one category only
 *   npm run generate:flashcard-audio -- --level=A1 --pilot=5      # first 5 cards of a level, for review
 *   npm run generate:flashcard-audio                              # ⚠ every card in the app (4000+ — many hundreds of paid TTS calls, review cost first)
 *   npm run generate:flashcard-audio -- --level=A1 --category=food --force   # re-narrate one narrow slice, even cards already cached (paid) — requires BOTH --level and --category
 *
 * COST POLICY — audio is permanent once generated, never auto-regenerated.
 * Each card's cache key is its own DB id (contentId: card.id), which never
 * changes when the card's Russian text is edited — so fixing a typo NEVER
 * triggers a new paid TTS call on a plain re-run. The existing clip keeps
 * playing; the script only logs that the text has drifted. The only way
 * to pay to re-narrate cards is `--force`, which requires both --level
 * and --category together (one alone can still be hundreds of cards) —
 * always start narrow when you actually want to update audio for edited
 * cards. Every never-narrated card is still a separate paid TTS request
 * either way; always start with a single --level/--category (or --pilot=)
 * run to check quality and cost before running it against the whole bank.
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
// Bumped from 3: most audit failures on short/rare vocabulary are Whisper
// mishearing a correctly-pronounced word, not TTS mispronouncing it (see
// the ё/е and "в/на" false-positive fixes) — an independent redraw of
// both TTS and Whisper often clears on a later attempt. Cheap to retry
// since these are single short words.
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

// Same normalization as generate-story-audio-cast.ts / generate-glossary-
// audio.ts, including the ё→е fold (a confirmed false-positive source).
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
          `expected "${text}" got "${transcript}"`
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
        "To generate flashcard pronunciation audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:flashcard-audio -- --level=A1",
      ].join("\n")
    );
    return;
  }

  const { force, level, category, pilot } = parseArgs(process.argv.slice(2));

  if (!level && !category) {
    console.log(
      [
        "No --level or --category given — refusing to run against the whole",
        "bank by default (4000+ cards, many hundreds of paid TTS calls).",
        "",
        "Start with a pilot:  npm run generate:flashcard-audio -- --level=A1 --pilot=5",
        "Or by category:      npm run generate:flashcard-audio -- --category=food",
      ].join("\n")
    );
    return;
  }

  if (force && !(level && category)) {
    console.log(
      [
        "--force without BOTH --level and --category is refused on purpose:",
        "one alone can still match hundreds of cards to re-pay for.",
        "",
        "Re-narrate a narrow slice:  npm run generate:flashcard-audio -- --level=A1 --category=food --force",
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

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "flashcard-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const card of cards) {
      const text = sanitizeTextForTTS(card.russian);
      const result = await ensureAudioAsset(db, {
        contentType: "flashcard",
        contentId: card.id,
        itemKey: "word",
        text,
        voice: NARRATOR_VOICE,
        model: OPENAI_TTS_MODEL,
        force,
        audioDir: AUDIO_DIR,
        publicPath: "/audio/flashcards",
        fileName: `${card.id}-word.mp3`,
        synthesize: makeAuditedSynthesize(apiKey, tmpDir),
      });

      if (result.status === "cached") {
        cached++;
        if (result.textStale) {
          stale++;
          console.log(`"${card.russian}": text changed since narration — keeping existing clip (not re-billing).`);
        }
      } else if (result.status === "generated") {
        console.log(`"${card.russian}": done.`);
        generated++;
      } else {
        console.error(`"${card.russian}": FAILED — ${result.error}`);
        failed++;
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  // The flashcard API's response is served through a shared TTL cache
  // (src/lib/flashcards/cache.ts) that embeds each card's audioUrl — a
  // real, confirmed staleness source: this script writes straight to
  // AudioAsset via its own Prisma connection, entirely bypassing that
  // cache, so a freshly-narrated card's audio wouldn't show up on the live
  // site/app until the cache's TTL (5 min) expired on its own. Explicitly
  // invalidating here makes new narration visible immediately instead of
  // silently waiting out the TTL.
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
