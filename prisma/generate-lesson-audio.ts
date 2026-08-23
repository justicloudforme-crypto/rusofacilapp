/**
 * Generates pronunciation audio for lesson content (vocabulary words,
 * grammar examples, readingPractice sentences, and the alphabet) using
 * OpenAI's text-to-speech API, and saves the .mp3 files into
 * public/audio/lessons/. Fills the shared AudioAsset cache (see
 * src/lib/audio-assets.ts) so SpeakButton can play a real file on mobile
 * instead of relying on the browser's Web Speech API — see
 * rusofasil_project_state memory for why that mattered for the mobile port.
 *
 * VOICE POLICY (explicit project owner directive): single male narrator
 * (ONYX, matching the story/glossary/flashcard narrator voice) for
 * everything — vocabulary, grammar examples, readingPractice, AND the
 * alphabet. No female voice anywhere in lesson content. (An earlier
 * revision alternated male/female per letter for the alphabet; the
 * project owner reviewed it and asked for a single male voice there too
 * — see git history for that version if it's ever needed again.) No
 * --voice override, so this can't drift from policy by accident.
 *
 * SYNTHESIS AUDIT — before any clip is written to the AudioAsset cache, it
 * is transcribed back with Whisper and diffed against the exact text sent
 * to TTS (word-similarity compare, ё/е folded — see generate-story-audio-
 * cast.ts for the same pattern and why the ё fold matters). Below
 * SIMILARITY_THRESHOLD, the clip is discarded and re-synthesized (up to
 * AUDIT_MAX_ATTEMPTS times) rather than ever cached.
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
 *   npm run generate:lesson-audio -- --level=a1 --lesson=1 --force   # re-narrate one lesson's items, even ones already cached (paid) — requires --lesson, see below
 *
 * Each never-narrated-before item is a separate paid TTS request (edited
 * items are NOT re-paid for automatically — see the cost policy above).
 * Always start with a single --level/--lesson pilot to check quality and
 * cost before running it against the whole course.
 *
 * Reads lesson content from the static content.json only (not the DB
 * Lesson-override table) — same source the seed script treats as
 * authoritative, and simplest for a one-off generation pass.
 *
 * COST POLICY — audio is permanent once generated, never auto-regenerated.
 * Each item's cache key is derived from its fixed position in the lesson
 * (which vocabulary/grammar-example/reading-practice/alphabet slot it is),
 * not from its text — so editing a lesson's Russian text (a typo fix, a
 * reword) NEVER triggers a new paid TTS call on a plain re-run. The
 * existing clip keeps playing; the script only logs that the text has
 * drifted. The only way to pay to re-narrate an item is `--force`, which
 * re-narrates every item in whatever --level/--lesson scope you give it —
 * always start narrow (a single --lesson) when you actually want to
 * update audio for edited content.
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
import { resolveFfmpegBinary } from "../src/lib/video-lesson/youtubeCaptions";
import {
  vocabAudioKey,
  alphabetAudioKey,
  grammarExampleAudioKey,
  readingPracticeAudioKey,
  exerciseAudioKey,
} from "../src/lib/lessons/audioKeys";
import { execFile } from "node:child_process";
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
const NARRATOR_VOICE = "onyx";

const SIMILARITY_THRESHOLD = 0.82;
// Bumped from 3 — see generate-flashcard-audio.ts's comment on the same
// constant for why more attempts pay off on short/rare vocabulary.
const AUDIT_MAX_ATTEMPTS = 5;

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : null;
  const lessonArg = argv.find((arg) => arg.startsWith("--lesson="));
  const lesson = lessonArg ? lessonArg.split("=")[1] : null;
  return { force, level, lesson };
}

interface LessonAudioItem {
  key: string;
  text: string;
  voice: string;
}

/** Every Russian string worth a pronunciation button in this lesson —
 * vocabulary words, grammar example sentences, readingPractice items, and
 * (only in lesson a1-1) the 33-letter alphabet. `key` is derived from the
 * item's fixed position within its own source list ("vocab-2",
 * "grammar-example-0", "reading-1", "alphabet-5"), NOT from the text
 * itself. This is what lets ensureAudioAsset() recognize "this is still
 * the same item, just edited" instead of treating an edited phrase as a
 * brand-new item to pay to narrate — the previous text-hash-derived key
 * meant fixing a typo silently minted a new, unrelated cache entry (paid)
 * while the old clip sat orphaned. See the cost policy note atop
 * src/lib/audio-assets.ts.
 *
 * No longer deduplicates an identical phrase that happens to appear in
 * two different slots (e.g. the same word in both vocabulary and a
 * reading-practice sentence) — each slot gets its own clip now. That can
 * cost marginally more on a first narration pass, but a stable per-slot
 * key matters far more than that small savings once "audio is permanent,
 * never silently re-billed" is the rule. */
function collectLessonAudioItems(content: Record<string, unknown>): LessonAudioItem[] {
  const items: LessonAudioItem[] = [];

  const vocabulary = content.vocabulary as { word: string }[] | undefined;
  (vocabulary ?? []).forEach((item, i) => {
    if (item?.word) items.push({ key: vocabAudioKey(i), text: item.word, voice: NARRATOR_VOICE });
  });

  const grammar = content.grammar as { examples?: { russian: string }[] } | undefined;
  (grammar?.examples ?? []).forEach((example, i) => {
    if (example?.russian) items.push({ key: grammarExampleAudioKey(i), text: example.russian, voice: NARRATOR_VOICE });
  });

  const readingPractice = content.readingPractice as { items?: { text: string }[] } | undefined;
  (readingPractice?.items ?? []).forEach((item, i) => {
    if (item?.text) items.push({ key: readingPracticeAudioKey(i), text: item.text, voice: NARRATOR_VOICE });
  });

  // `name` is the letter's spoken name ("бэ", "вэ"), not the two-glyph
  // `letter` field ("Б б"), which would read both the capital and
  // lowercase forms aloud. Same single narrator voice as everything else.
  const alphabet = content.alphabet as { name: string }[] | undefined;
  (alphabet ?? []).forEach((item, i) => {
    if (item?.name) {
      items.push({ key: alphabetAudioKey(i), text: item.name, voice: NARRATOR_VOICE });
    }
  });

  // Exercises tab: listening/listening-transcription play a Russian
  // sentence via TTS before the student answers; reading-comprehension
  // shows a Russian passage with its own listen button. Keyed by exercise
  // type + position (not exercise.id or its text) via the shared
  // src/lib/lessons/audioKeys.ts helpers — ExercisesTab/ExamView look
  // these up by that same position-derived key via /api/lesson-audio, not
  // by literal text, so an admin editing the Lesson-override text later
  // (a typo/grammar fix) can never silently break the audio link.
  const exercises = content.exercises as
    | { type: string; audioText?: string; text?: string }[]
    | undefined;
  (exercises ?? []).forEach((exercise, i) => {
    if (exercise.type === "listening" && exercise.audioText) {
      items.push({ key: exerciseAudioKey("listening", i), text: exercise.audioText, voice: NARRATOR_VOICE });
    } else if (exercise.type === "listening-transcription" && exercise.audioText) {
      items.push({ key: exerciseAudioKey("listening-transcription", i), text: exercise.audioText, voice: NARRATOR_VOICE });
    } else if (exercise.type === "reading-comprehension" && exercise.text) {
      items.push({ key: exerciseAudioKey("reading", i), text: exercise.text, voice: NARRATOR_VOICE });
    }
  });

  return items;
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

// A real, confirmed failure mode distinct from mispronunciation: gpt-4o-
// mini-tts occasionally returns a clip that's technically valid MP3 but
// carries no audible speech at all — reproduced directly on bare
// single-letter inputs ("е", "ы"): most attempts synthesize normally
// (peak around -7 to -12 dB), but some come back at -50+ dB, silence in
// practice. The Whisper audit is skipped for alphabet items (see below —
// it's unreliable on such short utterances) so it would never have caught
// this; a direct volume check on the actual audio bytes catches it
// instead, measuring the thing that's actually broken rather than
// inferring it through a second unreliable model. -35 dB is comfortably
// below every healthy sample observed (-7 to -12 dB) and comfortably
// above the broken ones (-50 to -54 dB) — a wide margin either way.
const SILENCE_MAX_VOLUME_DB = -35;

async function isEffectivelySilent(buffer: Buffer, tmpDir: string): Promise<boolean> {
  const ffmpeg = await resolveFfmpegBinary();
  if (!ffmpeg) return false; // no ffmpeg available — don't block generation over a check we can't run
  const tmpFile = path.join(tmpDir, `silence-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  await writeFileFs(tmpFile, buffer);
  try {
    const stderr = await new Promise<string>((resolve) => {
      execFile(ffmpeg, ["-i", tmpFile, "-af", "volumedetect", "-f", "null", "-"], (_err, _stdout, stderr) => {
        resolve(stderr ?? "");
      });
    });
    const match = stderr.match(/max_volume:\s*(-?[\d.]+) dB/);
    if (!match) return false; // couldn't parse — don't block generation over an inconclusive read
    return Number(match[1]) < SILENCE_MAX_VOLUME_DB;
  } finally {
    await rm(tmpFile, { force: true });
  }
}

/** Alphabet items skip the Whisper word-match audit (see the itemKey
 * branch in main() below — unreliable on single-letter utterances) but
 * still get the silence check above, with its own independent retry loop,
 * since that failure mode is real and unrelated to ASR reliability. */
function makeAlphabetSynthesize(apiKey: string, tmpDir: string) {
  return async (text: string, voice: string): Promise<Buffer> => {
    for (let attempt = 1; attempt <= AUDIT_MAX_ATTEMPTS; attempt++) {
      const buffer = await synthesizeSpeech(apiKey, text, voice);
      if (!(await isEffectivelySilent(buffer, tmpDir))) {
        return buffer;
      }
      console.log(`    ⚠ silence check attempt ${attempt} failed for "${text}" — near-silent clip, retrying`);
    }
    throw new Error(`silent_after_${AUDIT_MAX_ATTEMPTS}_attempts`);
  };
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
        "To generate lesson pronunciation audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:lesson-audio -- --level=a1 --lesson=1",
      ].join("\n")
    );
    return;
  }

  const { force, level, lesson } = parseArgs(process.argv.slice(2));

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

  if (force && !lesson) {
    console.log(
      [
        `--force with --level=${level} but no --lesson=<n> is refused on purpose:`,
        "it would re-pay to re-narrate every item in every lesson of that level.",
        "",
        `Re-narrate one lesson:  npm run generate:lesson-audio -- --level=${level} --lesson=<n> --force`,
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

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lesson-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const lessonId of lessonIds) {
      const content = staticLessonContent[lessonId];
      const items = collectLessonAudioItems(content);

      console.log(`\n${lessonId} — ${items.length} item(s)`);

      for (const { key: itemKey, text, voice } of items) {
        const sanitized = sanitizeTextForTTS(text);
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
          // The Whisper word-match audit is skipped for alphabet items
          // specifically — a real, confirmed methodology mismatch, not a
          // hypothetical one: a single letter name ("жэ", "зэ", "эль") is
          // too short an utterance for Whisper to transcribe reliably even
          // when TTS pronounces it perfectly. It's replaced with a direct
          // silence check (makeAlphabetSynthesize) instead — also real,
          // also confirmed: "е"/"ё"/"ы" came back as near-silent clips on
          // the very first generation pass, which the word-match audit
          // wouldn't have caught anyway (Whisper hallucinates plausible-
          // looking but wrong text on silence, e.g. video credits boiler-
          // plate, rather than failing loudly) but the volume check does.
          synthesize: itemKey.startsWith("alphabet-")
            ? makeAlphabetSynthesize(apiKey, tmpDir)
            : makeAuditedSynthesize(apiKey, tmpDir),
        });

        const label = `"${text.slice(0, 40)}${text.length > 40 ? "…" : ""}" (${itemKey}/${voice})`;
        if (result.status === "cached") {
          cached++;
          if (result.textStale) {
            stale++;
            console.log(`  ${label}: text changed since narration — keeping existing clip (not re-billing).`);
          }
        } else if (result.status === "generated") {
          console.log(`  ${label}: done.`);
          generated++;
        } else {
          console.error(`  ${label}: FAILED — ${result.error}`);
          failed++;
        }
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  console.log(
    `\n✔ Generated ${generated} item(s), ${cached} already cached` +
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
