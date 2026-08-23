/**
 * Generates pronunciation audio for glossary terms (GlossaryTerm.russianEquivalent
 * — a single word or short phrase, e.g. "именительный падеж") using OpenAI's
 * text-to-speech API, and saves the .mp3 files into public/audio/glossary/.
 * Fills the shared AudioAsset cache (see src/lib/audio-assets.ts).
 *
 * Single consistent narrator voice only (ONYX, matching the narrator voice
 * established for story narration — see generate-story-audio-cast.ts — for
 * a consistent brand voice across the app). No multi-speaker casting: these
 * are reference terms, not dialogue.
 *
 * SYNTHESIS AUDIT — before any clip is written to the AudioAsset cache, it
 * is transcribed back with Whisper and diffed against the exact text sent
 * to TTS (normalized: lowercase, punctuation stripped, ё folded to е — see
 * normalizeForCompare in generate-story-audio-cast.ts for why the ё fold
 * matters, a real confirmed false-positive source). Below
 * SIMILARITY_THRESHOLD, the clip is discarded and re-synthesized (up to
 * AUDIT_MAX_ATTEMPTS times) rather than ever being cached — same pattern
 * proven across the 325-story narration run.
 *
 * SETUP
 * 1. Get an API key at https://platform.openai.com/api-keys.
 * 2. Add it to .env:  OPENAI_API_KEY="sk-..."
 * 3. Run:             npm run generate:glossary-audio -- --pilot=5
 *
 * USAGE
 *   npm run generate:glossary-audio -- --pilot=5                 # first N terms only, for review
 *   npm run generate:glossary-audio -- --category=casos            # one category only
 *   npm run generate:glossary-audio                                 # every term (91 — small, but still requires an explicit ack)
 *   npm run generate:glossary-audio -- --category=casos --force     # re-narrate one narrow slice, even cached ones (paid)
 *
 * COST POLICY — audio is permanent once generated, never auto-regenerated.
 * Each term's cache key is its own DB id (contentId: term.id), which never
 * changes when the term's text is edited — fixing a typo never triggers a
 * new paid TTS call on a plain re-run. --force requires --category (never
 * a blanket re-narrate of all 91).
 */
import "dotenv/config";
import path from "node:path";
import { mkdtemp, rm, writeFile as writeFileFs } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { ensureAudioAsset } from "../src/lib/audio-assets";
import { parseExamplesJson } from "../src/lib/glossary";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio", "glossary");
const NARRATOR_VOICE = "onyx";

const SIMILARITY_THRESHOLD = 0.82;
// Bumped from 3 — see generate-flashcard-audio.ts's comment on the same
// constant for why more attempts pay off on short/rare vocabulary.
const AUDIT_MAX_ATTEMPTS = 5;

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const categoryArg = argv.find((arg) => arg.startsWith("--category="));
  const category = categoryArg ? categoryArg.split("=")[1] : null;
  const pilotArg = argv.find((arg) => arg.startsWith("--pilot="));
  const pilot = pilotArg ? Number(pilotArg.split("=")[1]) : undefined;
  return { force, category, pilot };
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

// Same normalization as generate-story-audio-cast.ts, including the ё→е
// fold — confirmed there to eliminate a real class of false-positive audit
// failures (Whisper drops the ё diacritic even on a perfectly correct
// reading).
function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–]/g, " ")
    // Glossary terms sometimes carry shorthand notation like "в/на" or
    // "+" ("в/на + винительный") that a real speaker reads aloud as
    // separate words ("в на плюс винительный") — a real, confirmed false
    // positive: the TTS read it exactly right, but "в/на" stayed one
    // token here while the transcript naturally split it into two words.
    // Treat these as word separators too, matching how they're spoken.
    .replace(/[/+]/g, " ")
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
        console.log(`    ✓ audit pass (${(similarity * 100).toFixed(0)}% word match, attempt ${attempt})`);
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
        "To generate glossary pronunciation audio:",
        "  1. Get an API key at https://platform.openai.com/api-keys",
        '  2. Add it to .env:  OPENAI_API_KEY="sk-..."',
        "  3. Run again:       npm run generate:glossary-audio -- --pilot=5",
      ].join("\n")
    );
    return;
  }

  const { force, category, pilot } = parseArgs(process.argv.slice(2));

  if (force && !category) {
    console.log(
      [
        "--force without --category is refused on purpose: it would re-pay",
        "to re-narrate every glossary term, not just the ones you meant to fix.",
        "",
        "Re-narrate one category:  npm run generate:glossary-audio -- --category=casos --force",
      ].join("\n")
    );
    return;
  }

  const where: { category?: string } = {};
  if (category) where.category = category;
  let terms = await db.glossaryTerm.findMany({ where, orderBy: { slug: "asc" } });
  if (pilot !== undefined) {
    terms = terms.slice(0, pilot);
  }

  if (terms.length === 0) {
    console.log(`No glossary terms found for category="${category ?? ""}".`);
    return;
  }

  console.log(`Processing ${terms.length} term(s)${pilot !== undefined ? ` (pilot, first ${pilot})` : ""}.`);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "glossary-audio-"));
  let generated = 0;
  let cached = 0;
  let stale = 0;
  let failed = 0;

  try {
    for (const term of terms) {
      const text = sanitizeTextForTTS(term.russianEquivalent);
      const result = await ensureAudioAsset(db, {
        contentType: "glossary",
        contentId: term.id,
        itemKey: "term",
        text,
        voice: NARRATOR_VOICE,
        model: OPENAI_TTS_MODEL,
        force,
        audioDir: AUDIO_DIR,
        publicPath: "/audio/glossary",
        fileName: `${term.id}-term.mp3`,
        synthesize: makeAuditedSynthesize(apiKey, tmpDir),
      });

      if (result.status === "cached") {
        cached++;
        if (result.textStale) {
          stale++;
          console.log(`"${term.russianEquivalent}" (${term.slug}): text changed since narration — keeping existing clip.`);
        }
      } else if (result.status === "generated") {
        console.log(`"${term.russianEquivalent}" (${term.slug}): done.`);
        generated++;
      } else {
        console.error(`"${term.russianEquivalent}" (${term.slug}): FAILED — ${result.error}`);
        failed++;
      }

      // Example sentences (GlossaryTerm.examples, a JSON { es, ru }[]
      // column) — itemKey "example-${i}" matches src/lib/glossary-audio.ts's
      // read side (attachGlossaryAudio), which /api/glossary uses to embed
      // audioUrl on each example. Keyed by array position, same "edit text
      // without re-billing" reasoning as the term itself.
      const examples = parseExamplesJson(term.examples);
      for (const [i, example] of examples.entries()) {
        if (!example.ru) continue;
        const exampleText = sanitizeTextForTTS(example.ru);
        const exampleResult = await ensureAudioAsset(db, {
          contentType: "glossary",
          contentId: term.id,
          itemKey: `example-${i}`,
          text: exampleText,
          voice: NARRATOR_VOICE,
          model: OPENAI_TTS_MODEL,
          force,
          audioDir: AUDIO_DIR,
          publicPath: "/audio/glossary",
          fileName: `${term.id}-example-${i}.mp3`,
          synthesize: makeAuditedSynthesize(apiKey, tmpDir),
        });

        const label = `  example[${i}] "${example.ru.slice(0, 40)}${example.ru.length > 40 ? "…" : ""}" (${term.slug})`;
        if (exampleResult.status === "cached") {
          cached++;
          if (exampleResult.textStale) stale++;
        } else if (exampleResult.status === "generated") {
          console.log(`${label}: done.`);
          generated++;
        } else {
          console.error(`${label}: FAILED — ${exampleResult.error}`);
          failed++;
        }
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
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
