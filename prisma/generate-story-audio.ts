/**
 * Generates narration audio for every story in the "Cuentos / Lecturas"
 * library that doesn't have one yet, using OpenAI's text-to-speech API,
 * and saves the .mp3 files into public/audio/stories/.
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
 *   npm run generate:story-audio            # only stories missing audioUrl
 *   npm run generate:story-audio -- --force # regenerate every story's audio
 *   npm run generate:story-audio -- --voice=nova   # pick an OpenAI TTS voice
 *
 * Each request costs a small amount against your OpenAI account — this is
 * a paid API, so review OpenAI's current TTS pricing before running it
 * against many stories.
 *
 * USING ELEVENLABS INSTEAD
 * The OpenAI-specific parts are isolated in synthesizeSpeech() below. To
 * use ElevenLabs instead, swap that function's body for a POST to
 * https://api.elevenlabs.io/v1/text-to-speech/{voice_id} with header
 * `xi-api-key: <ELEVENLABS_API_KEY>` and body `{ text, model_id }` — it
 * also returns raw MP3 bytes, so the rest of the script (saving the file,
 * updating audioUrl) needs no changes.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "stories");

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

  const stories = force
    ? await db.story.findMany()
    : await db.story.findMany({ where: { OR: [{ audioUrl: null }, { audioUrl: "" }] } });

  if (stories.length === 0) {
    console.log("Every story already has audio. Pass --force to regenerate all of them.");
    return;
  }

  await mkdir(AUDIO_DIR, { recursive: true });

  let ok = 0;
  let failed = 0;

  for (const story of stories) {
    process.stdout.write(`Generating audio for "${story.title}"... `);
    try {
      const audioBuffer = await synthesizeSpeech(apiKey, sanitizeTextForTTS(story.text), voice);
      const fileName = `${story.id}.mp3`;
      await writeFile(path.join(AUDIO_DIR, fileName), audioBuffer);
      await db.story.update({
        where: { id: story.id },
        data: { audioUrl: `/audio/stories/${fileName}` },
      });
      console.log("done.");
      ok++;
    } catch (error) {
      console.log("FAILED.");
      console.error(`  ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n✔ Generated audio for ${ok} stor${ok === 1 ? "y" : "ies"}${failed ? `, ${failed} failed` : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
