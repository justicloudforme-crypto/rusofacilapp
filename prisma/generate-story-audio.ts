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
 * COST POLICY — audio is permanent once generated, never auto-regenerated.
 * Safe to re-run any time (e.g. after adding new stories): every sentence
 * is looked up in the shared `AudioAsset` cache (see
 * src/lib/audio-assets.ts) before synthesizing — a sentence that already
 * has a clip costs nothing on a plain re-run, EVEN IF ITS TEXT HAS SINCE
 * CHANGED (a typo fix, a rewording). The existing clip keeps playing as-is;
 * the script only prints a note that it's stale. Re-narrating a specific
 * sentence/story is a paid action that only happens when you explicitly
 * pass --force together with --story=<id> for that one story — never as a
 * side effect of editing text or of a routine re-run.
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
 *   npm run generate:story-audio                            # narrate only stories that have never been narrated at all
 *   npm run generate:story-audio -- --story=<storyId>        # same, scoped to one story
 *   npm run generate:story-audio -- --story=<storyId> --force  # re-narrate EVERY sentence of one story, even ones with a still-valid cached clip — the only way to pay to update audio for an edited story
 *   npm run generate:story-audio -- --voice=nova              # pick an OpenAI TTS voice
 *
 * --force with no --story is refused on purpose: it would re-pay for the
 * entire library's worth of clips (hundreds of sentences) in one run.
 * Every new/never-narrated sentence is a separate paid TTS request either
 * way — review OpenAI's current TTS pricing before a large first pass.
 *
 * ⚠ DO NOT run this against any story that has already been narrated by
 * generate-story-audio-cast.ts (the multi-voice pipeline — check for
 * AudioAsset rows with contentType="story" first). This script's default
 * voice ("alloy") is not part of that pipeline's fixed voice map (onyx for
 * the narrator; echo/ash/nova/shimmer for characters) — running it on a
 * still-unnarrated sentence of an already-cast story would permanently
 * seed a wrong, out-of-map voice into the shared AudioAsset cache, since
 * ensureAudioAsset() never overwrites an existing cached clip. This is
 * exactly how one line of "Теремок" ended up narrated in "alloy" instead
 * of the narrator's "onyx" (found and documented 2026-08-27, see
 * PROGRESS.md) — a leftover from an early single-voice run, not a defect
 * in the cast pipeline's own logic. generate-story-audio-cast.ts is the
 * only script that should ever touch story narration going forward.
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
  const storyArg = argv.find((arg) => arg.startsWith("--story="));
  const storyId = storyArg ? storyArg.split("=")[1] : null;
  return { force, voice, storyId };
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

  const { force, voice, storyId } = parseArgs(process.argv.slice(2));

  if (force && !storyId) {
    console.log(
      [
        "--force with no --story=<id> is refused on purpose: it would re-pay",
        "to re-narrate every sentence of every story in the library, not just",
        "the one you meant to fix.",
        "",
        "Re-narrate one story:  npm run generate:story-audio -- --story=<id> --force",
      ].join("\n")
    );
    return;
  }

  const stories = storyId ? await db.story.findMany({ where: { id: storyId } }) : await db.story.findMany();
  if (storyId && stories.length === 0) {
    console.log(`No story found with id="${storyId}".`);
    return;
  }

  let generated = 0;
  let cached = 0;
  let stale = 0;
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
          if (result.textStale) {
            stale++;
            console.log(
              `Text changed since narration for ${label} — keeping the existing clip (not re-billing). ` +
                `Run with --story=${story.id} --force to update it.`
            );
          }
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
    `\n✔ Generated ${generated} clip(s), ${cached} already cached` +
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
