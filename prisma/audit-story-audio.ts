/**
 * Finds narration clips in the story-audio library (AudioAsset rows with
 * contentType="story") that look SUSPICIOUS — not necessarily wrong, just
 * worth a human's eyes/ears — and writes them to
 * prisma/audio-review-findings.json for the local-only review page at
 * /admin/audio-review (see src/app/[lang]/admin/audio-review/page.tsx).
 *
 * This script only READS. It never regenerates, deletes, or uploads
 * anything — see prisma/fix-teremok-0-1.ts for what an actual point-fix
 * looks like once a human has reviewed a finding and asked for one.
 *
 * CHECKS (all free — no OpenAI calls — unless --whisper is passed):
 *   - broken:      a HEAD request to the file's URL fails or returns an
 *                  empty body. Network-bound (one HEAD per clip, bounded
 *                  concurrency) but costs nothing.
 *   - too-short:   durationSeconds is null or under 0.3s.
 *   - duration-mismatch: the clip's seconds-per-character falls outside
 *                  the whole corpus's normal range (IQR-based outlier —
 *                  see computeOutlierBounds). Catches a clip that's much
 *                  too fast/slow for how much text it's supposed to read.
 *   - unknown-voice: `voice` isn't one of the fixed set the narration
 *                  pipeline ever assigns (onyx/echo/ash/nova/shimmer) —
 *                  this is exactly how the "Теремок" 0-1 bug was found
 *                  (a stray "alloy" from an old script — see PROGRESS.md).
 *   - maybe-wrong-voice: the fragment has no dialogue cue at all (no
 *                  quote mark, no colon, no dash) — i.e. it reads like
 *                  plain narration — but its voice isn't the narrator's
 *                  onyx. Lower confidence than unknown-voice (a colon-led
 *                  attribution like "Papá dijo: ..." is legitimate
 *                  character dialogue with no quote marks, so this can
 *                  still be a false positive — that's exactly why it goes
 *                  through a human review page instead of auto-fixing).
 *   - duplicate:   the exact same audioUrl is reused by more than one
 *                  (contentId, itemKey) — should never happen; means two
 *                  different sentences are pointing at the same clip.
 *   - whisper-mismatch (opt-in, --whisper only): the OpenAI Whisper
 *                  transcript of the actual audio doesn't sufficiently
 *                  match the sanitized text that was supposed to be
 *                  narrated (same word-overlap metric as
 *                  generate-story-audio-cast.ts's own synthesis audit).
 *                  Costs real OpenAI usage (~$0.006/minute of audio) and
 *                  takes a while (downloads + transcribes every clip) —
 *                  off by default, run explicitly when wanted.
 *
 * USAGE
 *   npx tsx prisma/audit-story-audio.ts                 # cheap checks only
 *   npx tsx prisma/audit-story-audio.ts -- --whisper     # + Whisper pass (costs money, slower)
 */
import "dotenv/config";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sanitizeTextForTTS } from "../src/lib/speech";
import { transcribeAudioWithWhisper } from "../src/lib/media/whisperTranscribe";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const KNOWN_VOICES = new Set(["onyx", "echo", "ash", "nova", "shimmer"]);
const NARRATOR_VOICE = "onyx";
const DIALOGUE_CUE = /[«»"“”'‘’—:]/;
const HEAD_CONCURRENCY = 8;
const OUTPUT_FILE = path.join(process.cwd(), "prisma", "audio-review-findings.json");

interface Issue {
  type: string;
  severity: number; // higher = more suspicious, sorted descending
  message: string;
}

interface Finding {
  storyId: string;
  storyTitle: string;
  storyLevel: string;
  itemKey: string;
  text: string;
  audioUrl: string;
  voice: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  issues: Issue[];
  maxSeverity: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Standard IQR-based outlier bounds (1.5x IQR beyond Q1/Q3). */
function computeOutlierBounds(values: number[]): { low: number; high: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
}

/**
 * Least-squares fit of duration ~ intercept + slope*charCount. A single
 * global ratio (seconds-per-character) badly overfits short clips: every
 * TTS clip has a roughly fixed lead-in/lead-out pause regardless of text
 * length, so a 5-character "Гм!.." legitimately takes ~2s (mostly
 * silence) while a 60-character sentence at the same "seconds per
 * character" would be absurd. Modeling duration as a fixed overhead PLUS
 * a per-character rate (basic linear regression) separates that fixed
 * cost from the actual speaking rate, so the residual (actual minus
 * predicted) is a much fairer "is this unusually slow/fast" signal,
 * confirmed against this corpus: without this, ~300 of ~320
 * duration-mismatch findings were just short interjections, not bugs.
 */
function fitLinear(points: { x: number; y: number }[]): { intercept: number; slope: number } {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { intercept, slope };
}

// One retry before calling a file "broken" — running ~4300 HEAD requests
// at once against a CDN produces the occasional transient blip
// (confirmed: a file flagged broken on the bulk pass came back perfectly
// fine, with a normal content-length, on an immediate manual re-check).
async function headCheckOnce(url: string): Promise<{ ok: boolean; bytes: number | null }> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    const bytes = len ? parseInt(len, 10) : null;
    return { ok: res.ok && bytes !== 0, bytes };
  } catch {
    return { ok: false, bytes: null };
  }
}

async function headCheck(url: string): Promise<{ ok: boolean; bytes: number | null }> {
  const first = await headCheckOnce(url);
  if (first.ok) return first;
  return headCheckOnce(url);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

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

async function main() {
  const runWhisper = process.argv.includes("--whisper");

  const stories = await db.story.findMany({ select: { id: true, title: true, level: true, text: true } });
  const titleById = new Map(stories.map((s) => [s.id, { title: s.title, level: s.level }]));

  const rows = await db.audioAsset.findMany({
    where: { contentType: "story" },
    select: { contentId: true, itemKey: true, text: true, voice: true, audioUrl: true, durationSeconds: true },
  });
  console.log(`Loaded ${rows.length} story AudioAsset rows across ${stories.length} stories.`);

  // Duplicate detection: same audioUrl used by more than one (contentId, itemKey).
  const urlUsage = new Map<string, string[]>();
  for (const r of rows) {
    const key = `${r.contentId}:${r.itemKey}`;
    if (!urlUsage.has(r.audioUrl)) urlUsage.set(r.audioUrl, []);
    urlUsage.get(r.audioUrl)!.push(key);
  }
  const duplicatedUrls = new Set([...urlUsage.entries()].filter(([, keys]) => keys.length > 1).map(([url]) => url));
  if (duplicatedUrls.size > 0) {
    console.log(`Found ${duplicatedUrls.size} audioUrl(s) reused across multiple sentences.`);
  }

  // Duration-vs-text-length model, fit once across the whole corpus (see
  // fitLinear's doc comment for why this is a regression, not a plain
  // ratio), then outlier bounds on the RESIDUALS (actual - predicted).
  const durationPoints = rows
    .filter((r) => r.durationSeconds && r.durationSeconds > 0 && r.text.length > 0)
    .map((r) => ({ x: r.text.length, y: r.durationSeconds! }));
  const { intercept, slope } = fitLinear(durationPoints);
  const residuals = durationPoints.map((p) => p.y - (intercept + slope * p.x));
  const { low: residualLow, high: residualHigh } = computeOutlierBounds(residuals);
  console.log(
    `Duration model: ${intercept.toFixed(2)}s fixed + ${slope.toFixed(3)}s/char. ` +
      `Residual median ${median(residuals).toFixed(2)}s, normal range [${residualLow.toFixed(2)}, ${residualHigh.toFixed(2)}]s.`
  );

  console.log(`Running HEAD checks on ${rows.length} files (concurrency ${HEAD_CONCURRENCY})...`);
  let headDone = 0;
  const headResults = await mapWithConcurrency(rows, HEAD_CONCURRENCY, async (r) => {
    const result = await headCheck(r.audioUrl);
    headDone++;
    if (headDone % 500 === 0) console.log(`  ... ${headDone}/${rows.length} checked`);
    return result;
  });

  const findings: Finding[] = [];

  for (const [i, r] of rows.entries()) {
    const issues: Issue[] = [];
    const head = headResults[i];
    const meta = titleById.get(r.contentId);

    if (!head.ok) {
      issues.push({ type: "broken", severity: 100, message: "Файл не открывается по ссылке (ошибка сети/404) — проверь доступность." });
    }
    if (r.durationSeconds === null || r.durationSeconds < 0.3) {
      issues.push({ type: "too-short", severity: 95, message: `Длительность подозрительно мала (${r.durationSeconds ?? "нет данных"} сек) — возможно, пустой или обрезанный файл.` });
    } else if (r.text.length > 0) {
      const predicted = intercept + slope * r.text.length;
      const residual = r.durationSeconds - predicted;
      if (residual < residualLow || residual > residualHigh) {
        issues.push({
          type: "duration-mismatch",
          severity: 70,
          message: `Длительность не соответствует длине текста (${r.durationSeconds.toFixed(1)} сек на ${r.text.length} символов, ожидалось около ${predicted.toFixed(1)} сек).`,
        });
      }
    }
    if (!KNOWN_VOICES.has(r.voice)) {
      issues.push({ type: "unknown-voice", severity: 90, message: `Голос "${r.voice}" не входит в список голосов, которые вообще использует система озвучки — вероятно, остаток от другого скрипта.` });
    } else if (r.voice !== NARRATOR_VOICE && !DIALOGUE_CUE.test(r.text)) {
      issues.push({
        type: "maybe-wrong-voice",
        severity: 50,
        message: `Текст выглядит как речь рассказчика (без кавычек/тире/двоеточия), но озвучен голосом персонажа ("${r.voice}") — стоит послушать.`,
      });
    }
    if (duplicatedUrls.has(r.audioUrl)) {
      issues.push({ type: "duplicate", severity: 80, message: "Этот же аудиофайл используется ещё в одном месте — возможно, перепутаны фрагменты." });
    }

    if (issues.length > 0) {
      findings.push({
        storyId: r.contentId,
        storyTitle: meta?.title ?? r.contentId,
        storyLevel: meta?.level ?? "?",
        itemKey: r.itemKey,
        text: r.text,
        audioUrl: r.audioUrl,
        voice: r.voice,
        durationSeconds: r.durationSeconds,
        fileSizeBytes: head.bytes,
        issues,
        maxSeverity: Math.max(...issues.map((iss) => iss.severity)),
      });
    }
  }

  if (runWhisper) {
    console.log(`\n--whisper passed: transcribing all ${rows.length} clips with OpenAI Whisper (this costs real money and takes a while)...`);
    const tmpDir = await mkdtemp(path.join(tmpdir(), "audio-audit-whisper-"));
    try {
      let done = 0;
      for (const r of rows) {
        done++;
        if (done % 200 === 0) console.log(`  ... ${done}/${rows.length} transcribed`);
        try {
          const res = await fetch(r.audioUrl);
          if (!res.ok) continue;
          const bytes = Buffer.from(await res.arrayBuffer());
          const tmpFile = path.join(tmpDir, `${done}.mp3`);
          await writeFile(tmpFile, bytes);
          const segments = await transcribeAudioWithWhisper(tmpFile);
          const transcript = segments.map((s) => s.text).join(" ");
          const similarity = wordSimilarity(sanitizeTextForTTS(r.text), transcript);
          if (similarity < 0.82) {
            const meta = titleById.get(r.contentId);
            const finding = findings.find((f) => f.storyId === r.contentId && f.itemKey === r.itemKey);
            const issue: Issue = {
              type: "whisper-mismatch",
              severity: 96,
              message: `Whisper распознал текст иначе (${(similarity * 100).toFixed(0)}% совпадения слов) — похоже, озвучено не то, что написано.`,
            };
            if (finding) {
              finding.issues.push(issue);
              finding.maxSeverity = Math.max(finding.maxSeverity, issue.severity);
            } else {
              findings.push({
                storyId: r.contentId,
                storyTitle: meta?.title ?? r.contentId,
                storyLevel: meta?.level ?? "?",
                itemKey: r.itemKey,
                text: r.text,
                audioUrl: r.audioUrl,
                voice: r.voice,
                durationSeconds: r.durationSeconds,
                fileSizeBytes: null,
                issues: [issue],
                maxSeverity: issue.severity,
              });
            }
          }
        } catch (error) {
          console.warn(`  Whisper check failed for ${r.contentId}/${r.itemKey}: ${(error as Error).message}`);
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  } else {
    console.log("\n(Skipping the Whisper-transcript check — pass --whisper to include it. Costs a small amount of real OpenAI usage.)");
  }

  findings.sort((a, b) => b.maxSeverity - a.maxSeverity);

  await writeFile(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), totalClips: rows.length, findings }, null, 2));
  console.log(`\n${findings.length} suspicious fragment(s) out of ${rows.length} total — written to ${OUTPUT_FILE}.`);

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
