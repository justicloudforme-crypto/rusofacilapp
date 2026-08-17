/**
 * Generates narration audio for the "Cuentos / Lecturas" library using
 * OpenAI's text-to-speech API, and saves the .mp3 files into
 * public/audio/stories/<storyId>/.
 *
 * One clip is synthesized PER SENTENCE (not one big file per story) —
 * this is what lets the reader page sync narration to text: a clip's
 * boundaries ARE a sentence's boundaries, so no forced-alignment /
 * timestamp step is needed. Sentence boundaries are computed with
 * splitSentences() from src/lib/stories.ts, the exact same function the
 * reader UI (StoryText) uses to build its on-screen sentence queue — the
 * two must never disagree, or a clip would narrate the wrong line.
 *
 * Safe to re-run any time (e.g. after adding new stories): every sentence
 * is looked up in the shared `AudioAsset` cache (see
 * src/lib/audio-assets.ts) before synthesizing — already-narrated
 * sentences whose text hasn't changed since cost nothing. Editing a
 * typo in one already-narrated sentence only re-synthesizes that one
 * sentence, not the whole story or the whole library.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:story-audio
 *
 * Without a key, the script prints these instructions and exits without
 * making any network calls or touching the database — same "demo mode"
 * degradation as the Stripe integration elsewhere in this app.
 *
 * USAGE
 *   npm run generate:story-audio            # generate whatever's missing/changed
 *   npm run generate:story-audio -- --force # resynthesize every sentence, ignoring the cache
 *   npm run generate:story-audio -- --voice=nova   # pick an OpenAI TTS voice
 *
 * Each new/changed sentence is a separate paid TTS request. Review
 * OpenAI's current TTS pricing before running this against many stories.
 *
 * USING ELEVENLABS INSTEAD
 * The OpenAI-specific parts are isolated in synthesizeSpeech() below. To
 * use ElevenLabs instead, swap that function's body for a POST to
 * https://api.elevenlabs.io/v1/text-to-speech/{voice_id} with header
 * `xi-api-key: <ELEVENLABS_API_KEY>` and body `{ text, model_id }` — it
 * also returns raw MP3 bytes, so ensureAudioAsset() needs no changes.
 */
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { splitStoryParagraphs, splitSentences, storyAudioItemKey } from "../src/lib/stories";
import { ensureAudioAsset } from "../src/lib/audio-assets";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_ROOT = path.join(__dirname, "..", "public", "audio", "stories");

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const voiceArg = argv.find((arg) => arg.startsWith("--voice="));
  const voice = voiceArg ? voiceArg.split("=")[1] : "alloy";
  return { force, voice };
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
        "To generate story narration audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:story-audio",
      ].join("\n")
    );
    return;
  }

  const { force, voice } = parseArgs(process.argv.slice(2));
  const stories = await db.story.findMany();

  let generated = 0;
  let cached = 0;
  let failed = 0;

  for (const story of stories) {
    const paragraphs = splitStoryParagraphs(story.text);
    const storyDir = path.join(AUDIO_ROOT, story.id);

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const sentences = splitSentences(paragraphs[paragraphIndex]);
      for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
        const itemKey = storyAudioItemKey(paragraphIndex, sentenceIndex);
        const label = `"${story.title}" [${itemKey}]`;
        const result = await ensureAudioAsset(db, {
          contentType: "story",
          contentId: story.id,
          itemKey,
          text: sanitizeTextForTTS(sentences[sentenceIndex].text),
          voice,
          model: OPENAI_TTS_MODEL,
          force,
          audioDir: storyDir,
          publicPath: `/audio/stories/${story.id}`,
          fileName: `${itemKey}.mp3`,
          synthesize: (text, v) => synthesizeSpeech(apiKey, text, v),
        });

        if (result.status === "cached") {
          cached++;
        } else if (result.status === "generated") {
          console.log(`Generated audio for ${label}.`);
          generated++;
        } else {
          console.error(`FAILED ${label}: ${result.error}`);
          failed++;
        }
      }
    }
  }

  console.log(
    `\n✔ Generated ${generated} clip(s), ${cached} already cached${failed ? `, ${failed} failed` : ""}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
