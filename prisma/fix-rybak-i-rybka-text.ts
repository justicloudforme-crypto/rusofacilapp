/**
 * ONE-OFF, surgical fix — see PROGRESS.md's "Сказка о рыбаке и рыбке"
 * write-up. Owner resolved the local-vs-prod text discrepancy: the
 * checked-in source of truth (prisma/stories-data.ts) and prod Turso
 * both already say "Хоть бы взял ты с неё новое корыто" / "а у старухи
 * новое корыто" — local dev.db had drifted to a different word order
 * ("Хоть бы корыто новое взял ты у неё" / "а у старухи корыто уже
 * новое") at some point outside the tracked source file. Canonical
 * wording = the checked-in file / Turso's existing text.
 *
 * This script, run against LOCAL dev.db only:
 * 1. Updates Story.text to the canonical wording (two sentences).
 * 2. Re-synthesizes the two AudioAsset fragments whose text changed
 *    (8-1: старуха/shimmer, 10-1: рассказчик/onyx — same established
 *    voices, Whisper-audited), uploaded under new content-hashed URLs
 *    (never overwrite an already-served address).
 * 3. Does NOT touch any other fragment, does NOT touch Turso — the
 *    Turso sync (matching by title+level, never by id) is a separate
 *    follow-up script, since Turso's story row needs fullAudioUrl too.
 *
 * Usage: npx tsx prisma/fix-rybak-i-rybka-text.ts
 */
import "dotenv/config";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile as writeFileFs, mkdir } from "node:fs/promises";
import os from "node:os";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

import { isEntryPoint } from "../src/lib/entry-point";
const STORY_ID = "cmsjcjx6s0003gvncjoxsn2nu"; // Сказка о рыбаке и рыбке (local dev.db id)
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const OPENAI_TTS_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const SIMILARITY_THRESHOLD = 0.82;
const MAX_ATTEMPTS = 3;

const CANONICAL_TEXT = [
  "Жил старик со своею старухой у самого синего моря; жили они в ветхой землянке ровно тридцать лет и три года.",
  "Старик ловил неводом рыбу, а старуха пряла свою пряжу.",
  "Раз он в море закинул невод — пришёл невод с одною тиной. Закинул другой раз — пришёл невод с травой морскою.",
  "В третий раз закинул он невод — пришёл невод с одною рыбкой, с непростою рыбкой — золотою.",
  "Взмолилась золотая рыбка человечьим голосом: «Отпусти ты, старче, меня в море, откуплюсь чем только пожелаешь».",
  "Удивился старик, испугался: тридцать лет и три года рыбачил и не слыхивал, чтоб рыба говорила.",
  "Отпустил он рыбку золотую и сказал ей ласковое слово: «Бог с тобою, ступай себе в синее море гулять на просторе».",
  "Воротился старик ко старухе и рассказал ей про чудо-рыбку, которую отпустил без всякого выкупа.",
  "Старуха забранила его: «Дурачина ты, простофиля! Хоть бы взял ты с неё новое корыто — наше совсем раскололось».",
  "Пошёл старик к морю, кликнул золотую рыбку. Приплыла рыбка и спросила: «Чего тебе надобно, старче?»",
  "Отвечает рыбка: «Не печалься, ступай себе с богом, будет вам новое корыто». И правда — воротился старик, а у старухи новое корыто.",
  "Но старуха забранилась ещё пуще: «Что корыто? В нём мало корысти! Воротись, старик, попроси у рыбки избу».",
  "Пошёл старик к морю опять, и рыбка снова исполнила желание: появилась у старика со старухой новая изба.",
  "Не успокоилась старуха: захотела стать столбовою дворянкой. Пошёл старик к морю — море слегка помутилось, но рыбка снова исполнила желание.",
  "Воротился старик, а старуха уже в новой горнице, на ней парчовая душегрейка, и слуги перед ней кланяются, а она их бьёт да за чупрун таскает.",
  "Прошла неделя, и старуха захотела стать вольною царицей. Испугался старик, но пошёл к морю снова.",
  "На этот раз море почернело, поднялись сердитые волны. Рыбка молча выслушала старика и снова исполнила желание: старуха стала царицей в пышных палатах.",
  "Старик хотел было подойти к своей старухе-царице, но стража его прогнала, а сама царица и вовсе не узнала в нём мужа.",
  "Прошло ещё немного времени, и старухе наскучило быть даже царицей.",
  "Каждый раз старик шёл к морю, и каждый раз море было всё неспокойнее, а рыбка молча исполняла желание.",
  "Наконец старуха захотела стать владычицей морскою, чтобы сама золотая рыбка ей служила и была у неё на посылках.",
  "Долго стоял старик у моря и ждал ответа — рыбка не приплыла, только море бушевало сильнее прежнего.",
  "Пошёл он домой, а дома — глядь: опять перед ним старая землянка, а на пороге сидит его старуха, и перед нею разбитое корыто.",
].join("\n");

const FRAGMENTS: { itemKey: string; voice: string; text: string }[] = [
  { itemKey: "8-1", voice: "shimmer", text: "Хоть бы взял ты с неё новое корыто — наше совсем раскололось." },
  { itemKey: "10-1", voice: "onyx", text: "И правда — воротился старик, а у старухи новое корыто." },
];

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”‘’„‟‚‛.,!?…:;()\-—–]/g, " ")
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

// Same fallback used in fill-missing-story-audio.ts: Whisper regularly
// mis-transcribes unstressed vowel reduction in folk-tale-register archaic
// words (Russian "akanye" — unstressed "о" sounds close to "а") as a
// different grammatical ending ("новое корыто" -> "новая корыта"), which
// tanks word-level similarity on an otherwise correct recording. Levenshtein
// on space-stripped text tolerates this without masking a real misreading.
function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function charSimilarityIgnoringSpaces(a: string, b: string): number {
  const sa = normalizeForCompare(a).replace(/\s+/g, "");
  const sb = normalizeForCompare(b).replace(/\s+/g, "");
  if (sa.length === 0) return sb.length === 0 ? 1 : 0;
  const dist = levenshtein(sa, sb);
  return Math.max(0, 1 - dist / Math.max(sa.length, sb.length));
}

function bestSimilarity(a: string, b: string): number {
  return Math.max(wordSimilarity(a, b), charSimilarityIgnoringSpaces(a, b));
}

async function synthesizeSpeech(apiKey: string, text: string, voice: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_TTS_MODEL, voice, input: text, response_format: "mp3" }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.log("OPENAI_API_KEY missing — nothing to do.");
    return;
  }

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const db = new PrismaClient({ adapter });

  const story = await db.story.findUnique({ where: { id: STORY_ID } });
  if (!story) {
    console.error("Story not found.");
    await db.$disconnect();
    process.exit(1);
  }
  console.log(`Story: "${story.title}" (${story.level})`);

  await db.story.update({ where: { id: STORY_ID }, data: { text: CANONICAL_TEXT } });
  console.log("Story.text updated to canonical wording.");

  const { put } = await import("@vercel/blob");
  const { parseFile } = await import("music-metadata");

  for (const frag of FRAGMENTS) {
    const existing = await db.audioAsset.findUnique({
      where: { contentType_contentId_itemKey: { contentType: "story", contentId: STORY_ID, itemKey: frag.itemKey } },
    });
    if (!existing) {
      console.error(`  ${frag.itemKey}: row not found — skipping.`);
      continue;
    }
    if (existing.text.trim() === frag.text.trim()) {
      console.log(`  ${frag.itemKey}: text already matches canonical — skipping.`);
      continue;
    }
    console.log(`  ${frag.itemKey}: "${existing.text}" -> "${frag.text}" (voice ${frag.voice})`);

    const sanitized = sanitizeTextForTTS(frag.text);
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), `rybak-fix-${frag.itemKey}-`));
    let finalBuffer: Buffer | null = null;
    let lastSimilarity = 0;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const buffer = await synthesizeSpeech(openaiKey, sanitized, frag.voice);
        const tmpFile = path.join(tmpDir, `attempt-${attempt}.mp3`);
        await writeFileFs(tmpFile, buffer);
        const segments = await transcribeAudioWithWhisper(tmpFile);
        const transcript = segments.map((s) => s.text).join(" ");
        const similarity = bestSimilarity(sanitized, transcript);
        lastSimilarity = similarity;
        console.log(`    attempt ${attempt}: ${(similarity * 100).toFixed(0)}% word match ("${transcript}")`);
        if (similarity >= SIMILARITY_THRESHOLD) {
          finalBuffer = buffer;
          break;
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }

    if (!finalBuffer) {
      console.error(`    audit failed after ${MAX_ATTEMPTS} attempts (best ${(lastSimilarity * 100).toFixed(0)}%). Not written.`);
      continue;
    }

    const localDir = path.join(process.cwd(), "public", "audio", "stories", STORY_ID);
    await mkdir(localDir, { recursive: true });
    const localPath = path.join(localDir, `${frag.itemKey}.mp3`);
    await writeFileFs(localPath, finalBuffer);

    let durationSeconds: number | null = null;
    try {
      const meta = await parseFile(localPath);
      durationSeconds = typeof meta.format.duration === "number" ? meta.format.duration : null;
    } catch {
      // non-fatal
    }

    const contentHash = createHash("sha256").update(finalBuffer).digest("hex").slice(0, 16);
    const blob = await put(`audio/stories/${STORY_ID}/${frag.itemKey}.${contentHash}.mp3`, finalBuffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "audio/mpeg",
      token: process.env.AUDIO_BLOB_READ_WRITE_TOKEN,
      storeId: process.env.AUDIO_BLOB_STORE_ID,
    });
    console.log(`    uploaded: ${blob.url}`);

    await db.audioAsset.update({
      where: { id: existing.id },
      data: { text: frag.text, voice: frag.voice, durationSeconds, audioUrl: blob.url },
    });
    console.log(`    dev.db row ${existing.id} updated.`);
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
