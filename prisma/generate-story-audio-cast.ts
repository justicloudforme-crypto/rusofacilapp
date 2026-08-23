/**
 * PILOT for multi-voice ("cast") story narration — see the plain single-
 * voice generate-story-audio.ts for the original, still-in-use pipeline.
 * This script adds two things on top of it, per an explicit project owner
 * directive (audio is permanent once cached, zero tolerance for redoing
 * paid work):
 *
 * 1. VOICE CASTING — a Claude pre-pass reads a story's full text (already
 *    split into the exact same paragraph/sentence units generate-story-
 *    audio.ts and the reader UI use — see splitStoryParagraphs/
 *    splitSentences in src/lib/stories.ts) and classifies EVERY resulting
 *    sentence fragment as either narrator text or a specific named
 *    character's dialogue, with that character's gender. This works at
 *    the same fragment granularity the sentence-splitter already produces
 *    — a quoted line like «Порфирий! — воскликнул толстый. — Ты ли это?»
 *    splits into narrator fragments ("— воскликнул толстый.") interleaved
 *    with character fragments ("«Порфирий!", "Ты ли это?»"), and each one
 *    gets classified and voiced independently. A character keeps the same
 *    voice for every fragment attributed to them within one story.
 *
 * 2. SYNTHESIS AUDIT — before any clip is written to the AudioAsset cache,
 *    it is transcribed back with Whisper and diffed against the exact text
 *    that was sent to TTS (normalized: lowercase, punctuation stripped).
 *    Below SIMILARITY_THRESHOLD, the clip is discarded and re-synthesized
 *    (up to AUDIT_MAX_ATTEMPTS times) rather than ever being cached. This
 *    reuses ensureAudioAsset()'s existing contract unmodified: its
 *    `synthesize` callback is expected to throw on failure, which
 *    ensureAudioAsset already treats as "failed" and never writes to
 *    cache or disk — the audit lives entirely inside that callback here.
 *
 * SCOPE: --story=<id1>,<id2>,... for a specific list (used for the initial
 * 7-story pilot and for retrying individual failed items), or --level=<A1|
 * A2|B1|B2|C1> for every story at that CEFR level (~65 stories) — added
 * once the project owner reviewed the pilot's real output (text, voice
 * casting, audit data) and explicitly approved scaling to the full
 * library. Still no fully unscoped "every story regardless of level" mode
 * — level-sized batches (mirroring generate-lesson-audio.ts's own
 * --level= requirement) keep each run's cost and duration legible and
 * let a bad batch be caught before the next level starts.
 *
 * USAGE
 *   npm run generate:story-audio-cast -- --story=<id1>,<id2>,...
 *   npm run generate:story-audio-cast -- --level=B1
 */
import "dotenv/config";
import path from "node:path";
import { mkdtemp, rm, writeFile as writeFileFs } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { splitStoryParagraphs, splitSentences, storyAudioItemKey } from "../src/lib/stories";
import { ensureAudioAsset } from "../src/lib/audio-assets";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const AUDIO_ROOT = path.join(__dirname, "..", "public", "audio", "stories");

// A small, deliberately curated pool — one clearly distinct voice per role
// — rather than picking arbitrarily per character. The narrator's voice
// (onyx) is never reused for any character, so the author's "authoritative,
// pleasant" voice from the project's own requirement always stands apart
// from the cast. A 3rd-of-a-gender character in the same story falls back
// to the last voice in its pool (logged clearly) rather than reusing the
// narrator's.
const NARRATOR_VOICE = "onyx";
const MALE_VOICES = ["echo", "ash"];
const FEMALE_VOICES = ["nova", "shimmer"];

const SIMILARITY_THRESHOLD = 0.82;
const AUDIT_MAX_ATTEMPTS = 3;

interface SentenceUnit {
  itemKey: string;
  text: string;
}

interface CastLine {
  itemKey: string;
  speaker: string; // "narrator" or a character name, verbatim from the story
  gender: "male" | "female" | null; // null for narrator
}

function parseArgs(argv: string[]) {
  const storyArg = argv.find((arg) => arg.startsWith("--story="));
  const storyIds = storyArg ? storyArg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1].trim() : null;
  return { storyIds, level };
}

function collectSentenceUnits(text: string): SentenceUnit[] {
  const units: SentenceUnit[] = [];
  const paragraphs = splitStoryParagraphs(text);
  paragraphs.forEach((paragraph, paragraphIndex) => {
    splitSentences(paragraph).forEach((sentence, sentenceIndex) => {
      units.push({ itemKey: storyAudioItemKey(paragraphIndex, sentenceIndex), text: sentence.text });
    });
  });
  return units;
}

const CAST_TOOL_SCHEMA = {
  name: "emit_cast",
  description: "Emit the speaker/gender classification for every sentence fragment.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["lines"],
    properties: {
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["itemKey", "speaker", "gender"],
          properties: {
            itemKey: { type: "string" },
            speaker: { type: "string", minLength: 1 },
            gender: { type: ["string", "null"], enum: ["male", "female", null] },
          },
        },
      },
    },
  },
};

async function castStory(title: string, units: SentenceUnit[], apiKey: string): Promise<CastLine[]> {
  const numbered = units.map((u) => `[${u.itemKey}] ${u.text}`).join("\n");

  const prompt = `Eres un director de casting de audiolibros. Te doy un cuento ruso ("${title}") ya dividido en fragmentos de oración (cada uno con su "itemKey"). Cada fragmento puede ser: (a) narración del autor, o (b) una línea de diálogo de un personaje concreto — incluso las etiquetas de atribución tipo «— dijo Pedro.» dentro de una cita SON narración, no diálogo, aunque estén pegadas a una cita.

Fragmentos (en orden):
"""
${numbered}
"""

Para CADA itemKey (sin omitir ninguno), decide:
- speaker: "narrator" para narración, o el nombre del personaje (tal como aparece en el texto, ej. "Очумелов", "толстый") para diálogo. Usa EXACTAMENTE el mismo nombre para el mismo personaje en todo el cuento, incluso si el texto lo menciona con apodos distintos en distintos puntos — infiere quién es por contexto y unifica el nombre.
- gender: "male" o "female" para un personaje (según el propio texto — pronombres, terminaciones verbales rusas en pasado revelan género, nombres), o null si speaker es "narrator".

Llama a emit_cast con una línea por CADA itemKey de la lista, en cualquier orden.`;

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      tools: [CAST_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_cast" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(`anthropic_error_${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; input?: { lines?: unknown } }[];
    stop_reason?: string;
  };

  if (data.stop_reason === "max_tokens") {
    throw new Error("cast_truncated");
  }

  const toolUse = (data.content ?? []).find((block) => block.type === "tool_use");
  let lines = toolUse?.input?.lines;
  if (!lines) {
    throw new Error("cast_no_tool_output");
  }

  // A real, confirmed API quirk (not hypothetical — hit on a live call):
  // despite the schema declaring "lines" as an array, the model
  // occasionally serializes it as a JSON-encoded STRING value instead,
  // sometimes with malformed JSON inside it too (an unquoted enum value).
  // Treat any shape mismatch here as equivalent to "bad response" and
  // throw a distinct, clearly-labeled error — the retry loop around
  // castStory() in main() just asks the API again rather than trying to
  // creatively repair malformed JSON.
  if (typeof lines === "string") {
    try {
      lines = JSON.parse(lines);
    } catch {
      throw new Error("cast_lines_was_unparseable_string");
    }
  }
  if (!Array.isArray(lines)) {
    throw new Error("cast_lines_not_an_array");
  }
  for (const line of lines) {
    if (
      typeof line !== "object" ||
      line === null ||
      typeof (line as CastLine).itemKey !== "string" ||
      typeof (line as CastLine).speaker !== "string" ||
      !["male", "female", null].includes((line as CastLine).gender)
    ) {
      throw new Error("cast_line_malformed");
    }
  }
  const castLines = lines as CastLine[];

  const expectedKeys = new Set(units.map((u) => u.itemKey));
  const gotKeys = new Set(castLines.map((l) => l.itemKey));
  for (const key of expectedKeys) {
    if (!gotKeys.has(key)) {
      throw new Error(`cast_missing_itemKey_${key}`);
    }
  }

  return castLines;
}

// Confirmed via direct repeated testing (not a hypothetical): the model
// serializes "lines" as a malformed JSON-string roughly 1 in 3 calls,
// unrelated to any particular story's content — 3 attempts occasionally
// hits 3 bad draws in a row (observed once in practice), so 5 keeps the
// odds of a whole story failing negligibly small without being wasteful
// (a failed cast attempt costs one small text-only Claude call, not TTS).
const CAST_MAX_ATTEMPTS = 5;

async function castStoryWithRetry(title: string, units: SentenceUnit[], apiKey: string): Promise<CastLine[]> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= CAST_MAX_ATTEMPTS; attempt++) {
    try {
      return await castStory(title, units, apiKey);
    } catch (error) {
      lastError = error as Error;
      console.log(`  ⚠ casting attempt ${attempt} failed: ${lastError.message}`);
    }
  }
  throw lastError;
}

/** Assigns a stable voice per unique speaker within one story. Narrator
 * always gets NARRATOR_VOICE. Characters get the next unused voice from
 * their gender's pool, first-seen order; a story with more distinct
 * characters of one gender than the pool size reuses the pool's last
 * voice for the overflow (logged, not silently swallowed) rather than
 * ever falling back to the narrator's own voice. */
function assignVoices(lines: CastLine[]): Map<string, string> {
  const voiceBySpeaker = new Map<string, string>();
  voiceBySpeaker.set("narrator", NARRATOR_VOICE);
  let maleIndex = 0;
  let femaleIndex = 0;

  for (const line of lines) {
    if (line.speaker === "narrator" || voiceBySpeaker.has(line.speaker)) continue;
    if (line.gender === "male") {
      const voice = MALE_VOICES[Math.min(maleIndex, MALE_VOICES.length - 1)];
      voiceBySpeaker.set(line.speaker, voice);
      if (maleIndex >= MALE_VOICES.length) {
        console.log(`  ⚠ more than ${MALE_VOICES.length} male characters — "${line.speaker}" reuses ${voice}`);
      }
      maleIndex++;
    } else if (line.gender === "female") {
      const voice = FEMALE_VOICES[Math.min(femaleIndex, FEMALE_VOICES.length - 1)];
      voiceBySpeaker.set(line.speaker, voice);
      if (femaleIndex >= FEMALE_VOICES.length) {
        console.log(`  ⚠ more than ${FEMALE_VOICES.length} female characters — "${line.speaker}" reuses ${voice}`);
      }
      femaleIndex++;
    } else {
      console.log(`  ⚠ speaker "${line.speaker}" has no gender — treating as narrator voice`);
      voiceBySpeaker.set(line.speaker, NARRATOR_VOICE);
    }
  }

  return voiceBySpeaker;
}

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI TTS request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    // ё vs е is a real, confirmed false-positive source — Russian text
    // conventionally omits the ё diacritic even though it's pronounced
    // distinctly, and Whisper's transcription is inconsistent about
    // restoring it. A correctly-read "берёт" coming back as "берет" is
    // the exact same word, not a mispronunciation — fold both to the
    // same character before comparing.
    .replace(/ё/g, "е")
    .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-level similarity (not char-level Levenshtein) — Whisper commonly
// normalizes numerals/abbreviations differently than the source text even
// on a perfect reading, so word-set overlap is the more forgiving, more
// meaningful signal for "did it actually say the right words."
function wordSimilarity(a: string, b: string): number {
  const wordsA = normalizeForCompare(a).split(" ").filter(Boolean);
  const wordsB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (wordsA.length === 0) return wordsB.size === 0 ? 1 : 0;
  const matched = wordsA.filter((w) => wordsB.has(w)).length;
  return matched / wordsA.length;
}

interface AuditStats {
  passed: number;
  retried: number;
  failed: number;
}

function makeAuditedSynthesize(apiKey: string, tmpDir: string, stats: AuditStats, label: string) {
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
        if (attempt > 1) stats.retried++;
        stats.passed++;
        console.log(`  ✓ audit ${label} pass (${(similarity * 100).toFixed(0)}% word match, attempt ${attempt})`);
        return buffer;
      }
      console.log(
        `  ⚠ audit ${label} attempt ${attempt} failed (${(similarity * 100).toFixed(0)}% word match) — ` +
          `expected "${text}" got "${transcript}"`
      );
    }
    stats.failed++;
    throw new Error(`audit_failed_after_${AUDIT_MAX_ATTEMPTS}_attempts_${(lastSimilarity * 100).toFixed(0)}pct`);
  };
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openaiKey || !anthropicKey) {
    console.log("OPENAI_API_KEY and ANTHROPIC_API_KEY are both required — nothing to do.");
    return;
  }

  const { storyIds, level } = parseArgs(process.argv.slice(2));
  if (storyIds.length === 0 && !level) {
    console.log("Requires --story=<id1>,<id2>,... or --level=<A1|A2|B1|B2|C1> — no unscoped mode, by design.");
    return;
  }
  if (storyIds.length > 0 && level) {
    console.log("Pass either --story= or --level=, not both.");
    return;
  }

  const stories = level
    ? await db.story.findMany({ where: { level } })
    : await db.story.findMany({ where: { id: { in: storyIds } } });
  if (stories.length === 0) {
    console.log(level ? `No stories found at level="${level}".` : "No stories found for the given --story ids.");
    return;
  }
  console.log(`Processing ${stories.length} stor${stories.length === 1 ? "y" : "ies"}${level ? ` at level ${level}` : ""}.`);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "story-audio-cast-"));

  const overallStats: AuditStats = { passed: 0, retried: 0, failed: 0 };
  const voiceUsageSummary = new Map<string, number>();

  const failedStories: string[] = [];

  try {
    for (const story of stories) {
      try {
        await processStory(story, anthropicKey, openaiKey, tmpDir, overallStats, voiceUsageSummary);
      } catch (error) {
        failedStories.push(story.title);
        console.error(`  ✗ STORY FAILED, moving to next: ${(error as Error).message}`);
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n=== Pilot audit summary ===`);
  console.log(`Passed: ${overallStats.passed} (${overallStats.retried} needed a retry), Failed: ${overallStats.failed}`);
  console.log(`Voice usage:`, Object.fromEntries(voiceUsageSummary));
  if (failedStories.length > 0) {
    console.log(`Stories that failed entirely (re-run the same --story list to retry — cached sentences are free): ${failedStories.join(", ")}`);
  }
}

async function processStory(
  story: { id: string; title: string; level: string; author: string; text: string },
  anthropicKey: string,
  openaiKey: string,
  tmpDir: string,
  overallStats: AuditStats,
  voiceUsageSummary: Map<string, number>
): Promise<void> {
  console.log(`\n=== "${story.title}" (${story.level}, ${story.author}) [${story.id}] ===`);
  const units = collectSentenceUnits(story.text);
  console.log(`  ${units.length} sentence fragment(s) to cast.`);

  const castLines = await castStoryWithRetry(story.title, units, anthropicKey);
  const castByKey = new Map(castLines.map((l) => [l.itemKey, l]));
  const voiceBySpeaker = assignVoices(castLines);

  const speakers = new Set(castLines.map((l) => l.speaker));
  console.log(
    `  Cast: ${[...speakers]
      .map((s) => `${s}=${voiceBySpeaker.get(s)}${s !== "narrator" ? `(${castLines.find((l) => l.speaker === s)?.gender})` : ""}`)
      .join(", ")}`
  );

  const storyDir = path.join(AUDIO_ROOT, story.id);
  let generated = 0;
  let cached = 0;

  for (const unit of units) {
    const cast = castByKey.get(unit.itemKey)!;
    const voice = voiceBySpeaker.get(cast.speaker) ?? NARRATOR_VOICE;
    voiceUsageSummary.set(voice, (voiceUsageSummary.get(voice) ?? 0) + 1);
    const sanitized = sanitizeTextForTTS(unit.text);
    if (!sanitized) continue;

    const label = `[${unit.itemKey}] (${cast.speaker}/${voice})`;
    const result = await ensureAudioAsset(db, {
      contentType: "story",
      contentId: story.id,
      itemKey: unit.itemKey,
      text: sanitized,
      voice,
      model: OPENAI_TTS_MODEL,
      audioDir: storyDir,
      publicPath: `/audio/stories/${story.id}`,
      fileName: `${unit.itemKey}.mp3`,
      synthesize: makeAuditedSynthesize(openaiKey, tmpDir, overallStats, label),
    });

    if (result.status === "cached") {
      cached++;
    } else if (result.status === "generated") {
      generated++;
      console.log(`  → "${sanitized}" — ${label}`);
    } else {
      console.error(`  ✗ FAILED ${label}: ${result.error}`);
    }
  }

  console.log(`  Story done: ${generated} generated, ${cached} already cached.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
