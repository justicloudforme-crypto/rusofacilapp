/**
 * Fills in ONLY the missing per-sentence clips for stories that were left
 * out of the fullAudioUrl batch (concat-story-audio.ts) because they
 * weren't 100% narrated — see PROGRESS.md's 2026-08-27 write-up. Never
 * touches an existing AudioAsset row: for every unit already present it's
 * a pure no-op (mirrors ensureAudioAsset()'s own cache-first contract
 * used by every other generate-*-audio.ts script).
 *
 * VOICE ASSIGNMENT — the important part, per an explicit owner
 * requirement ("тот же логике ролей, что и в остальных фрагментах этого
 * же рассказа"): re-classifies the WHOLE story via the same Claude
 * cast-director prompt generate-story-audio-cast.ts uses (deterministic
 * per speaker name, but re-running it fresh could in principle attribute
 * a borderline line to a differently-spelled/ordered speaker name than
 * the original run did), THEN cross-references every unit that already
 * has a clip against this fresh classification to build a per-speaker
 * "voice already in use in this story" map. A speaker with existing
 * clips ALWAYS keeps their established voice — the pool-based
 * first-seen-order assignment (assignVoices() in the cast script) only
 * ever applies to a speaker who has literally zero existing clips in
 * this story. This is what prevents a freshly-generated line from
 * introducing a second, different voice for a character who already
 * speaks elsewhere in the same story with an established one.
 *
 * Every new clip is Whisper-audited before being cached (same threshold/
 * retry policy as the cast script) and uploaded to Blob under a
 * content-hashed key (never a fixed itemKey.mp3 URL) — matching this
 * project's standing address-versioning rule.
 *
 * USAGE
 *   npx tsx prisma/fill-missing-story-audio.ts -- --story=<id1>,<id2>,...
 */
import "dotenv/config";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { splitStoryParagraphs, splitSentences, storyAudioItemKey } from "../src/lib/stories";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const AUDIO_ROOT = path.join(__dirname, "..", "public", "audio", "stories");

const NARRATOR_VOICE = "onyx";
const MALE_VOICES = ["echo", "ash"];
const FEMALE_VOICES = ["nova", "shimmer"];
const SIMILARITY_THRESHOLD = 0.82;
const AUDIT_MAX_ATTEMPTS = 3;
const CAST_MAX_ATTEMPTS = 5;

interface SentenceUnit {
  itemKey: string;
  text: string;
}
interface CastLine {
  itemKey: string;
  speaker: string;
  gender: "male" | "female" | null;
}

function parseArgs(argv: string[]) {
  const storyArg = argv.find((a) => a.startsWith("--story="));
  return storyArg ? storyArg.split("=")[1].split(",").filter(Boolean) : [];
}

function collectSentenceUnits(text: string): SentenceUnit[] {
  const units: SentenceUnit[] = [];
  splitStoryParagraphs(text).forEach((paragraph, paragraphIndex) => {
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
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      tools: [CAST_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_cast" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`anthropic_error_${response.status}: ${(await response.text()).slice(0, 300)}`);

  const data = (await response.json()) as { content?: { type: string; input?: { lines?: unknown } }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens") throw new Error("cast_truncated");
  const toolUse = (data.content ?? []).find((b) => b.type === "tool_use");
  let lines = toolUse?.input?.lines;
  if (!lines) throw new Error("cast_no_tool_output");
  if (typeof lines === "string") {
    try {
      lines = JSON.parse(lines);
    } catch {
      throw new Error("cast_lines_was_unparseable_string");
    }
  }
  if (!Array.isArray(lines)) throw new Error("cast_lines_not_an_array");
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
    if (!gotKeys.has(key)) throw new Error(`cast_missing_itemKey_${key}`);
  }
  return castLines;
}

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

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// Whisper normalizes spoken numbers to digits regardless of how the
// source text spelled them out ("двести" -> "200") — a known, already-
// documented false-positive source for this audit (see the ё/е normalize
// note above and generate-story-audio-cast.ts's own comment on the same
// issue), but the word-set/char-level checks alone weren't tolerant
// enough for it on a short sentence where one number is a large fraction
// of the words. Converts spelled-out Russian cardinals/ordinals (up to
// 999, composing hundreds+tens+units the way they're actually spoken —
// "сто сорок первой" -> "141") into plain digit runs before comparing,
// so both sides end up in the same digit form. Not linguistically
// complete (doesn't handle thousands or irregular forms) — covers what
// this corpus's stories actually contain.
// Keys are written with "е", never "ё" — normalizeForCompare() folds ё->е
// BEFORE calling normalizeNumberWords(), so a key spelled with ё here
// would silently never match (confirmed hitting exactly this while
// testing "четвёртого" against a transcript, before this comment/fix).
const NUMBER_WORDS: Record<string, number> = {
  ноль: 0,
  один: 1, одна: 1, одного: 1, одной: 1, первый: 1, первого: 1, первой: 1, первым: 1,
  два: 2, две: 2, двух: 2, второй: 2, второго: 2, вторым: 2,
  три: 3, трех: 3, третий: 3, третьего: 3, третьей: 3,
  четыре: 4, четырех: 4, четвертый: 4, четвертого: 4, четвертой: 4,
  пять: 5, пяти: 5, пятый: 5, пятого: 5, пятой: 5,
  шесть: 6, шести: 6, шестой: 6, шестого: 6,
  семь: 7, семи: 7, седьмой: 7, седьмого: 7,
  восемь: 8, восьми: 8, восьмой: 8, восьмого: 8,
  девять: 9, девяти: 9, девятый: 9, девятого: 9,
  десять: 10, десяти: 10, десятый: 10, десятого: 10,
  одиннадцать: 11, одиннадцати: 11,
  двенадцать: 12, двенадцати: 12,
  тринадцать: 13, тринадцати: 13,
  четырнадцать: 14, четырнадцати: 14,
  пятнадцать: 15, пятнадцати: 15,
  шестнадцать: 16, шестнадцати: 16,
  семнадцать: 17, семнадцати: 17,
  восемнадцать: 18, восемнадцати: 18,
  девятнадцать: 19, девятнадцати: 19,
  двадцать: 20, двадцати: 20, двадцатый: 20, двадцатого: 20,
  тридцать: 30, тридцати: 30,
  сорок: 40, сорокового: 40, сорокой: 40,
  пятьдесят: 50, пятидесяти: 50,
  шестьдесят: 60, шестидесяти: 60,
  семьдесят: 70, семидесяти: 70,
  восемьдесят: 80, восьмидесяти: 80,
  девяносто: 90, девяностого: 90,
  сто: 100, ста: 100, сотого: 100,
  двести: 200, двухсот: 200,
  триста: 300, трехсот: 300,
  четыреста: 400, четырехсот: 400,
  пятьсот: 500, пятисот: 500,
  шестьсот: 600, шестисот: 600,
  семьсот: 700, семисот: 700,
  восемьсот: 800, восьмисот: 800,
  девятьсот: 900, девятисот: 900,
};

function magnitude(value: number): "hundreds" | "tens" | "units" {
  if (value >= 100) return "hundreds";
  if (value >= 20) return "tens";
  return "units";
}

function normalizeNumberWords(text: string): string {
  const words = text.split(" ");
  const out: string[] = [];
  let acc = 0;
  let haveAcc = false;
  let lastMagnitude: "hundreds" | "tens" | "units" | null = null;

  const flush = () => {
    if (haveAcc) out.push(String(acc));
    acc = 0;
    haveAcc = false;
    lastMagnitude = null;
  };

  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value === undefined) {
      flush();
      out.push(word);
      continue;
    }
    const mag = magnitude(value);
    // Russian numbers are spoken largest-magnitude-first ("сто сорок
    // первой" = 100, then 40, then 1) — each next word's magnitude should
    // be STRICTLY SMALLER than the last one's to keep combining into the
    // same number. A same-or-larger magnitude means a new number is
    // starting (two separate numbers back to back, or a repeat).
    if (haveAcc && lastMagnitude !== null && ORDER[mag] >= ORDER[lastMagnitude]) {
      flush();
    }
    acc += value;
    haveAcc = true;
    lastMagnitude = mag;
  }
  flush();
  return out.join(" ");
}
const ORDER = { hundreds: 3, tens: 2, units: 1 } as const;

function normalizeForCompare(text: string): string {
  return normalizeNumberWords(
    text
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Word-set overlap is the primary signal (same as generate-story-audio-
 * cast.ts's own audit), but on a SHORT sentence it's brittle against a
 * class of false positive that isn't a real mispronunciation: Whisper (or
 * the TTS itself) joining/splitting words that are phonetically identical
 * either way — "не простое" vs "непростое", "от чего" vs "отчего", "на
 * брег" vs "набрег". Both spellings sound the same in Russian; only the
 * word-boundary choice differs. Confirmed hitting this repeatedly on this
 * exact batch of missing sentences (short, often archaic/poetic lines
 * where every word matters to the word-set ratio). A character-level
 * comparison with ALL spaces stripped is immune to word-boundary choice
 * while still catching a genuine wrong-word/mispronunciation (those still
 * show up as real character edits) — used as a second, equally valid way
 * to pass, not a replacement for the word-set check. */
function charSimilarityIgnoringSpaces(a: string, b: string): number {
  const flatA = a.replace(/\s+/g, "");
  const flatB = b.replace(/\s+/g, "");
  if (flatA.length === 0) return flatB.length === 0 ? 1 : 0;
  const distance = levenshtein(flatA, flatB);
  return 1 - distance / Math.max(flatA.length, flatB.length);
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = normalizeForCompare(a).split(" ").filter(Boolean);
  const wordsB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (wordsA.length === 0) return wordsB.size === 0 ? 1 : 0;
  return wordsA.filter((w) => wordsB.has(w)).length / wordsA.length;
}

/** The actual pass/fail signal used below: word-set overlap OR
 * space-stripped character similarity, whichever is higher — see
 * charSimilarityIgnoringSpaces's doc comment for why. */
function bestSimilarity(a: string, b: string): number {
  return Math.max(wordSimilarity(a, b), charSimilarityIgnoringSpaces(normalizeForCompare(a), normalizeForCompare(b)));
}

async function synthesizeAudited(apiKey: string, tmpDir: string, text: string, voice: string, label: string): Promise<Buffer> {
  let lastSimilarity = 0;
  for (let attempt = 1; attempt <= AUDIT_MAX_ATTEMPTS; attempt++) {
    const buffer = await synthesizeSpeech(apiKey, text, voice);
    const tmpFile = path.join(tmpDir, `audit-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    await writeFile(tmpFile, buffer);
    let transcript = "";
    try {
      const segments = await transcribeAudioWithWhisper(tmpFile);
      transcript = segments.map((s) => s.text).join(" ");
    } finally {
      await rm(tmpFile, { force: true });
    }
    const similarity = bestSimilarity(text, transcript);
    lastSimilarity = similarity;
    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(`    ✓ audit ${label} pass (${(similarity * 100).toFixed(0)}% word match, attempt ${attempt})`);
      return buffer;
    }
    console.log(`    ⚠ audit ${label} attempt ${attempt} failed (${(similarity * 100).toFixed(0)}%) — got "${transcript}"`);
  }
  throw new Error(`audit_failed_after_${AUDIT_MAX_ATTEMPTS}_attempts_${(lastSimilarity * 100).toFixed(0)}pct`);
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openaiKey || !anthropicKey) {
    console.log("OPENAI_API_KEY and ANTHROPIC_API_KEY are both required.");
    return;
  }
  const storyIds = parseArgs(process.argv.slice(2));
  if (storyIds.length === 0) {
    console.log("Requires --story=<id1>,<id2>,...");
    return;
  }

  const { put } = await import("@vercel/blob");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "fill-missing-audio-"));

  try {
    for (const storyId of storyIds) {
      const story = await db.story.findUnique({ where: { id: storyId } });
      if (!story) {
        console.log(`\n✗ story ${storyId} not found, skipping.`);
        continue;
      }
      console.log(`\n=== "${story.title}" [${storyId}] ===`);

      const units = collectSentenceUnits(story.text);
      const existingRows = await db.audioAsset.findMany({
        where: { contentType: "story", contentId: storyId },
        select: { itemKey: true, voice: true },
      });
      const existingVoiceByKey = new Map(existingRows.map((r) => [r.itemKey, r.voice]));
      const missingUnits = units.filter((u) => !existingVoiceByKey.has(u.itemKey));
      if (missingUnits.length === 0) {
        console.log("  Nothing missing — skipped.");
        continue;
      }
      console.log(`  ${missingUnits.length} missing sentence(s) out of ${units.length}.`);

      const castLines = await castStoryWithRetry(story.title, units, anthropicKey);
      const castByKey = new Map(castLines.map((l) => [l.itemKey, l]));

      // Voice map: established speakers keep their EXISTING voice (never
      // reassigned); only a speaker with zero existing clips in this
      // story gets a fresh pool voice, first-seen order among the
      // missing units only skipping any voice already taken by an
      // established speaker.
      const voiceBySpeaker = new Map<string, string>();
      voiceBySpeaker.set("narrator", NARRATOR_VOICE);
      const usedVoices = new Set<string>([NARRATOR_VOICE]);
      for (const row of existingRows) {
        const cast = castByKey.get(row.itemKey);
        if (!cast || cast.speaker === "narrator") continue;
        if (!voiceBySpeaker.has(cast.speaker)) {
          voiceBySpeaker.set(cast.speaker, row.voice);
          usedVoices.add(row.voice);
        } else if (voiceBySpeaker.get(cast.speaker) !== row.voice) {
          console.log(
            `  ⚠ speaker "${cast.speaker}" has inconsistent existing voices in the DB (${voiceBySpeaker.get(cast.speaker)} vs ${row.voice}) — keeping the first one seen, not fixing this pre-existing inconsistency here.`
          );
        }
      }
      let maleIndex = 0;
      let femaleIndex = 0;
      for (const line of castLines) {
        if (line.speaker === "narrator" || voiceBySpeaker.has(line.speaker)) continue;
        const pool = line.gender === "female" ? FEMALE_VOICES : MALE_VOICES;
        let voice = pool.find((v) => !usedVoices.has(v));
        if (!voice) {
          voice = pool[line.gender === "female" ? femaleIndex % pool.length : maleIndex % pool.length];
          console.log(`  ⚠ ran out of unused ${line.gender} voices — "${line.speaker}" reuses ${voice}`);
        }
        if (line.gender === "female") femaleIndex++;
        else maleIndex++;
        voiceBySpeaker.set(line.speaker, voice);
        usedVoices.add(voice);
      }

      const storyDir = path.join(AUDIO_ROOT, storyId);
      await mkdir(storyDir, { recursive: true });

      for (const unit of missingUnits) {
        const cast = castByKey.get(unit.itemKey);
        const speaker = cast?.speaker ?? "narrator";
        const voice = voiceBySpeaker.get(speaker) ?? NARRATOR_VOICE;
        const sanitized = sanitizeTextForTTS(unit.text);
        if (!sanitized) {
          console.log(`  - ${unit.itemKey}: empty after sanitizing, skipped.`);
          continue;
        }
        const reason = speaker === "narrator" ? "рассказчик (onyx)" : `персонаж "${speaker}" (${voice})`;
        console.log(`  → ${unit.itemKey} "${sanitized}" — роль: ${reason}`);

        try {
          const buffer = await synthesizeAudited(openaiKey, tmpDir, sanitized, voice, unit.itemKey);
          const localPath = path.join(storyDir, `${unit.itemKey}.mp3`);
          await writeFile(localPath, buffer);
          const { parseFile } = await import("music-metadata");
          let durationSeconds: number | null = null;
          try {
            const meta = await parseFile(localPath);
            durationSeconds = typeof meta.format.duration === "number" ? meta.format.duration : null;
          } catch {
            // non-fatal
          }
          const contentHash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
          const blob = await put(`audio/stories/${storyId}/${unit.itemKey}.${contentHash}.mp3`, buffer, {
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "audio/mpeg",
            token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
            storeId: process.env.AUDIO_BLOB_STORE_ID,
          });
          await db.audioAsset.create({
            data: {
              contentType: "story",
              contentId: storyId,
              itemKey: unit.itemKey,
              textHash: createHash("sha256").update(sanitized).digest("hex"),
              text: sanitized,
              voice,
              model: OPENAI_TTS_MODEL,
              audioUrl: blob.url,
              durationSeconds,
            },
          });
          console.log(`    saved -> ${blob.url}`);
        } catch (error) {
          console.error(`  ✗ FAILED ${unit.itemKey}: ${(error as Error).message}`);
        }
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  await db.$disconnect();
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
