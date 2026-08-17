/**
 * Generates pronunciation audio for lesson content (vocabulary words,
 * grammar examples, readingPractice sentences) using OpenAI's text-to-speech
 * API, and saves the .mp3 files into public/audio/lessons/. Fills the
 * shared AudioAsset cache (see src/lib/audio-assets.ts) so SpeakButton can
 * play a real file on mobile instead of relying on the browser's Web
 * Speech API — see rusofasil_project_state memory for why that mattered
 * for the mobile port.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:lesson-audio -- --level=a1 --lesson=1
 *
 * Without a key, the script prints these instructions and exits without
 * making any network calls or touching the database — same "demo mode"
 * degradation as generate-story-audio.ts.
 *
 * USAGE
 *   npm run generate:lesson-audio -- --level=a1 --lesson=1   # one lesson only
 *   npm run generate:lesson-audio -- --level=a1               # every a1 lesson
 *   npm run generate:lesson-audio                              # ⚠ every lesson in the app (120 lessons — many hundreds of paid TTS calls, review cost first)
 *   npm run generate:lesson-audio -- --force                   # resynthesize even items already cached
 *   npm run generate:lesson-audio -- --voice=nova               # pick an OpenAI TTS voice
 *
 * Each new/changed item is a separate paid TTS request — this is a paid
 * API. Always start with a single --level/--lesson pilot to check quality
 * and cost before running it against the whole course.
 *
 * Reads lesson content from the static content.json only (not the DB
 * Lesson-override table) — same source the seed script treats as
 * authoritative, and simplest for a one-off generation pass. Safe to
 * re-run after editing a lesson's Russian text: the AudioAsset cache is
 * keyed by a hash of the text itself, so an edited item is detected and
 * resynthesized on its own — nothing else in the lesson (or app) is
 * touched or re-paid-for.
 */
import "dotenv/config";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { ensureAudioAsset } from "../src/lib/audio-assets";
// Imported directly from the JSON file (not src/lib/lessons/content.ts,
// which is marked "server-only" and can't be required outside Next.js's
// own module graph) — same reasoning as generate-story-audio.ts using its
// own PrismaClient instead of src/lib/db.ts.
import rawLessonContent from "../src/lib/lessons/content.json";

const staticLessonContent = rawLessonContent as unknown as Record<string, Record<string, unknown>>;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "lessons");

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const voiceArg = argv.find((arg) => arg.startsWith("--voice="));
  const voice = voiceArg ? voiceArg.split("=")[1] : "alloy";
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : null;
  const lessonArg = argv.find((arg) => arg.startsWith("--lesson="));
  const lesson = lessonArg ? lessonArg.split("=")[1] : null;
  return { force, voice, level, lesson };
}

/** Short filesystem/DB-key-safe id for an item, derived from its own text
 * — so the id itself already IS the "did this text change" signal, same
 * spirit as AudioAsset's textHash but usable as a stable file name. */
function itemKeyFor(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

/** Every distinct Russian string worth a pronunciation button in this
 * lesson — vocabulary words, grammar example sentences, and readingPractice
 * items — deduplicated (the same phrase sometimes appears in both the
 * grammar examples and readingPractice). */
function collectItemTexts(content: Record<string, unknown>): string[] {
  const texts = new Set<string>();

  const vocabulary = content.vocabulary as { word: string }[] | undefined;
  for (const item of vocabulary ?? []) {
    if (item?.word) texts.add(item.word);
  }

  const grammar = content.grammar as { examples?: { russian: string }[] } | undefined;
  for (const example of grammar?.examples ?? []) {
    if (example?.russian) texts.add(example.russian);
  }

  const readingPractice = content.readingPractice as { items?: { text: string }[] } | undefined;
  for (const item of readingPractice?.items ?? []) {
    if (item?.text) texts.add(item.text);
  }

  return [...texts];
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
        "To generate lesson pronunciation audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:lesson-audio -- --level=a1 --lesson=1",
      ].join("\n")
    );
    return;
  }

  const { force, voice, level, lesson } = parseArgs(process.argv.slice(2));

  if (!level) {
    console.log(
      [
        "No --level given — refusing to run against the whole course by default",
        "(120 lessons, many hundreds of paid TTS calls).",
        "",
        "Start with a pilot:  npm run generate:lesson-audio -- --level=a1 --lesson=1",
        "Then a full level:   npm run generate:lesson-audio -- --level=a1",
      ].join("\n")
    );
    return;
  }

  const lessonIds = Object.keys(staticLessonContent).filter((id) => {
    const [idLevel, idLesson] = id.split("-");
    if (idLevel !== level) return false;
    if (lesson && idLesson !== lesson) return false;
    return true;
  });

  if (lessonIds.length === 0) {
    console.log(`No lessons found for level="${level}"${lesson ? ` lesson="${lesson}"` : ""}.`);
    return;
  }

  let generated = 0;
  let cached = 0;
  let failed = 0;

  for (const lessonId of lessonIds) {
    const content = staticLessonContent[lessonId];
    const texts = collectItemTexts(content);

    console.log(`\n${lessonId} — ${texts.length} item(s)`);

    for (const text of texts) {
      const sanitized = sanitizeTextForTTS(text);
      const itemKey = itemKeyFor(sanitized);
      const result = await ensureAudioAsset(db, {
        contentType: "lesson",
        contentId: lessonId,
        itemKey,
        text: sanitized,
        voice,
        model: OPENAI_TTS_MODEL,
        force,
        audioDir: AUDIO_DIR,
        publicPath: "/audio/lessons",
        fileName: `${lessonId}-${itemKey}.mp3`,
        synthesize: (t, v) => synthesizeSpeech(apiKey, t, v),
      });

      const label = `"${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"`;
      if (result.status === "cached") {
        cached++;
      } else if (result.status === "generated") {
        console.log(`  ${label}: done.`);
        generated++;
      } else {
        console.error(`  ${label}: FAILED — ${result.error}`);
        failed++;
      }
    }
  }

  console.log(
    `\n✔ Generated ${generated} item(s), ${cached} already cached${failed ? `, ${failed} failed` : ""}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
