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
 *   npm run generate:flashcard-audio                              # ⚠ every card in the app (4000+ — many hundreds of paid TTS calls, review cost first)
 *   npm run generate:flashcard-audio -- --level=A1 --category=food --force   # re-narrate one narrow slice, even cards already cached (paid) — requires BOTH --level and --category
 *   npm run generate:flashcard-audio -- --voice=nova               # pick an OpenAI TTS voice
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
 * either way; always start with a single --level or --category pilot to
 * check quality and cost before running it against the whole bank.
 */
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { ensureAudioAsset } from "../src/lib/audio-assets";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "flashcards");

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const voiceArg = argv.find((arg) => arg.startsWith("--voice="));
  const voice = voiceArg ? voiceArg.split("=")[1] : "alloy";
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : null;
  const categoryArg = argv.find((arg) => arg.startsWith("--category="));
  const category = categoryArg ? categoryArg.split("=")[1] : null;
  return { force, voice, level, category };
}

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS request failed (${res.status}): ${errorBody.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
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

  const { force, voice, level, category } = parseArgs(process.argv.slice(2));

  if (!level && !category) {
    console.log(
      [
        "No --level or --category given — refusing to run against the whole",
        "bank by default (4000+ cards, many hundreds of paid TTS calls).",
        "",
        "Start with a pilot:  npm run generate:flashcard-audio -- --level=A1",
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
  const cards = await db.flashcardCard.findMany({ where });

  if (cards.length === 0) {
    console.log(`No cards found for level="${level ?? ""}" category="${category ?? ""}".`);
    return;
  }

  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  for (const card of cards) {
    const text = sanitizeTextForTTS(card.russian);
    const result = await ensureAudioAsset(db, {
      contentType: "flashcard",
      contentId: card.id,
      itemKey: "word",
      text,
      voice,
      model: OPENAI_TTS_MODEL,
      force,
      audioDir: AUDIO_DIR,
      publicPath: "/audio/flashcards",
      fileName: `${card.id}-word.mp3`,
      synthesize: (t, v) => synthesizeSpeech(apiKey, t, v),
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

  console.log(
    `\n✔ Generated ${generated} card(s), ${cached} already cached` +
      `${stale ? ` (${stale} of those have edited text — see notes above)` : ""}` +
      `${failed ? `, ${failed} failed` : ""}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
