/**
 * Generates pronunciation audio for exam listening/reading-comprehension
 * exercises (ExamSkillArea.exercises — same Exercise union as lessons) and
 * saves the .mp3 files into public/audio/exams/. Fills the shared
 * AudioAsset cache (see src/lib/audio-assets.ts), read by /api/exam-audio
 * and consumed by ExamView.tsx.
 *
 * Same policy as generate-lesson-audio.ts in every respect (single male
 * ONYX narrator, Whisper word-match audit before caching, permanent once
 * generated, --force scoped to one exam only) — see that file's header
 * for the full rationale, not repeated here.
 *
 * Reads exam content the same way getExamContent() does (see
 * src/lib/exams/content.ts): the Exam DB table (admin overrides) takes
 * priority per (level, examSlug), falling back to the static
 * src/lib/exams/content.json seed. Read directly here (not through that
 * "server-only" module) for the same reason generate-lesson-audio.ts reads
 * content.json directly — this runs outside Next's module graph.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:exam-audio -- --level=a1 --exam=a1-exam-1
 *
 * USAGE
 *   npm run generate:exam-audio -- --level=a1 --exam=a1-exam-1   # one exam only
 *   npm run generate:exam-audio -- --level=a1                     # every a1 exam
 *   npm run generate:exam-audio                                    # ⚠ every exam (review cost first)
 *   npm run generate:exam-audio -- --level=a1 --exam=a1-exam-1 --force   # re-narrate one exam, even cached items
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
import type { ExamContent } from "../src/lib/exams/types";
import rawExamContent from "../src/lib/exams/content.json";

const staticExamContent = rawExamContent as unknown as Record<string, ExamContent>;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "exams");
const NARRATOR_VOICE = "onyx";

const SIMILARITY_THRESHOLD = 0.82;
const AUDIT_MAX_ATTEMPTS = 5;

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const levelArg = argv.find((arg) => arg.startsWith("--level="));
  const level = levelArg ? levelArg.split("=")[1] : null;
  const examArg = argv.find((arg) => arg.startsWith("--exam="));
  const examSlug = examArg ? examArg.split("=")[1] : null;
  return { force, level, examSlug };
}

async function loadExamContent(level: string, examSlug: string): Promise<ExamContent | null> {
  const row = await db.exam.findUnique({ where: { level_examSlug: { level, examSlug } } });
  if (row) {
    try {
      return JSON.parse(row.contentJson) as ExamContent;
    } catch {
      // fall through to static
    }
  }
  const stat = staticExamContent[examSlug];
  return stat && stat.level === level ? stat : null;
}

interface ExamAudioItem {
  key: string;
  text: string;
  voice: string;
}

/** Same key-by-position (not text) reasoning as collectLessonAudioItems in
 * generate-lesson-audio.ts — a typo fix in an exam sentence must never
 * silently mint a new paid clip. */
function collectExamAudioItems(exam: ExamContent): ExamAudioItem[] {
  const items: ExamAudioItem[] = [];
  exam.skillAreas.forEach((area, areaIndex) => {
    area.exercises.forEach((exercise, exIndex) => {
      const prefix = `area-${areaIndex}-ex-${exIndex}`;
      if (exercise.type === "listening" && exercise.audioText) {
        items.push({ key: `${prefix}-listening`, text: exercise.audioText, voice: NARRATOR_VOICE });
      } else if (exercise.type === "listening-transcription" && exercise.audioText) {
        items.push({ key: `${prefix}-listening-transcription`, text: exercise.audioText, voice: NARRATOR_VOICE });
      } else if (exercise.type === "reading-comprehension" && exercise.text) {
        items.push({ key: `${prefix}-reading`, text: exercise.text, voice: NARRATOR_VOICE });
      }
    });
  });
  return items;
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

// Same normalization as every other generate-*-audio.ts script.
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
        "To generate exam pronunciation audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:exam-audio -- --level=a1 --exam=a1-exam-1",
      ].join("\n")
    );
    return;
  }

  const { force, level, examSlug } = parseArgs(process.argv.slice(2));

  if (!level) {
    console.log(
      [
        "No --level given — refusing to run against every exam by default.",
        "",
        "Start with one exam:  npm run generate:exam-audio -- --level=a1 --exam=a1-exam-1",
        "Then a full level:    npm run generate:exam-audio -- --level=a1",
      ].join("\n")
    );
    return;
  }

  if (force && !examSlug) {
    console.log(
      [
        `--force with --level=${level} but no --exam=<slug> is refused on purpose:`,
        "it would re-pay to re-narrate every item in every exam of that level.",
        "",
        `Re-narrate one exam:  npm run generate:exam-audio -- --level=${level} --exam=<slug> --force`,
      ].join("\n")
    );
    return;
  }

  const allSlugs = Object.keys(staticExamContent).filter((slug) => staticExamContent[slug].level === level);
  const examSlugs = examSlug ? allSlugs.filter((slug) => slug === examSlug) : allSlugs;

  if (examSlugs.length === 0) {
    console.log(`No exams found for level="${level}"${examSlug ? ` exam="${examSlug}"` : ""}.`);
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "exam-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const slug of examSlugs) {
      const exam = await loadExamContent(level, slug);
      if (!exam) continue;
      const items = collectExamAudioItems(exam);
      const contentId = `${level}-${slug}`;

      console.log(`\n${contentId} — ${items.length} item(s)`);

      for (const { key: itemKey, text, voice } of items) {
        const sanitized = sanitizeTextForTTS(text);
        const result = await ensureAudioAsset(db, {
          contentType: "exam",
          contentId,
          itemKey,
          text: sanitized,
          voice,
          model: OPENAI_TTS_MODEL,
          force,
          audioDir: AUDIO_DIR,
          publicPath: "/audio/exams",
          fileName: `${contentId}-${itemKey}.mp3`,
          synthesize: makeAuditedSynthesize(apiKey, tmpDir),
        });

        const label = `"${text.slice(0, 40)}${text.length > 40 ? "…" : ""}" (${itemKey})`;
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
