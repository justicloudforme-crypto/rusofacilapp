/**
 * Заход 7.170, часть 3 (долг 130) и часть 2 (долг 132): запись 420
 * одобренных владельцем вырезок омографов на прод + перевод 46 уже
 * записанных вырезок с WAV на mp3.
 *
 * ПОРЯДОК — раздел 7 паспорта озвучки, от него не отступают:
 *   1. снимок строк `AudioAsset` и отпечаток пар (id, audioUrl) —
 *      `prisma/run-7170/snapshot-audio.ts`;
 *   2. `--dry-run`: план, занятые ключи, занятые пути Blob;
 *   3. `--only=5`: обкатка;
 *   4. запись. `allowOverwrite: false` — занятый путь это ОТКАЗ, а не
 *      тихая перезапись; `--force` не предусмотрен вовсе.
 *
 * НОВОГО СИНТЕЗА ЗДЕСЬ НЕТ И БЫТЬ НЕ МОЖЕТ: скрипт не умеет обращаться
 * ни к какой модели. Он берёт mp3, полученные перекодировкой уже
 * оплаченного звука (`encode-mp3.ts`), и кладёт их в Blob.
 *
 * ПУТЬ В BLOB. `audio/story-words/<24 шестнадцатеричных>.mp3`, где число —
 * начало sha256 от `storyId|itemKey|text|sha256(файла)`. Место входит в
 * ключ намеренно: у двух вхождений одного слова в одном предложении звук
 * может совпасть байт в байт (наследство 7.166), и без места они получили
 * бы ОДИН путь, то есть второй стал бы отказом.
 *
 * `textHash` у вырезки — sha256 от `storyId|itemKey|text`, а не от одного
 * текста: текст вырезки («года») повторяется в сотне мест, а строка
 * обязана быть своей у каждого места. На выбор клипа `textHash` не
 * влияет — `pickStoryWordClip` его не читает вовсе.
 *
 *   npx tsx prisma/run-7170/write-cuts.ts --plan=<plan.json> --mp3=<папка> \
 *     --rows46=<rows-46-before.json> --mp3-46=<папка> --journal=<written.jsonl> \
 *     [--dry-run] [--only=N]
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const PLAN = arg("plan");
const MP3 = arg("mp3");
const ROWS46 = arg("rows46");
const MP346 = arg("mp3-46");
const JOURNAL = arg("journal");
const DRY = process.argv.includes("--dry-run");
const ONLY = Number(arg("only") ?? 0);
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

interface PlanRow {
  file: string; word: string; storyId: string; itemKey: string; tokenText: string; sha256: string;
  paragraphIndex: number; sentenceIndex: number;
}
interface Row46 {
  id: string; contentId: string; itemKey: string; text: string; audioUrl: string; file: string;
}

function durationOf(file: string): number {
  const out = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf-8" });
  return Math.round(Number(out.trim()) * 1000) / 1000;
}

async function main(): Promise<number> {
  if (!PLAN || !MP3 || !ROWS46 || !MP346) {
    console.error("нужны --plan=, --mp3=, --rows46=, --mp3-46=");
    return 2;
  }
  const plan = (JSON.parse(readFileSync(PLAN, "utf-8")) as { rows: PlanRow[] }).rows;
  const rows46 = JSON.parse(readFileSync(ROWS46, "utf-8")) as Row46[];

  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  // Голос вырезки — голос КАСТА того самого предложения, а не «onyx по
  // умолчанию»: рассказы читаются пятью голосами, и вырезка обязана
  // называться тем голосом, из которого она вырезана.
  const voiceOfSentence = new Map<string, string>();
  for (const r of await db.audioAsset.findMany({ where: { contentType: "story" }, select: { contentId: true, itemKey: true, voice: true } })) {
    voiceOfSentence.set(`${r.contentId}|${r.itemKey}`, r.voice);
  }

  const taken = new Set(
    (await db.audioAsset.findMany({ where: { contentType: "story-word" }, select: { contentId: true, itemKey: true } }))
      .map((r) => `${r.contentId}|${r.itemKey}`),
  );

  // ---- план вставок -------------------------------------------------
  type Insert = { row: PlanRow; mp3Path: string; blobPath: string; textHash: string; duration: number; bytes: number; voice: string };
  const inserts: Insert[] = [];
  const refusedKey: string[] = [];
  const missing: string[] = [];
  const blobPaths = new Map<string, string>();
  const dupBlob: string[] = [];
  const noVoice: string[] = [];

  for (const row of plan) {
    const mp3Path = join(MP3, row.file.replace(/\.wav$/i, ".mp3"));
    if (!existsSync(mp3Path)) { missing.push(row.file); continue; }
    if (taken.has(`${row.storyId}|${row.itemKey}`)) { refusedKey.push(`${row.storyId}|${row.itemKey} (${row.file})`); continue; }
    const voice = voiceOfSentence.get(`${row.storyId}|${row.paragraphIndex}-${row.sentenceIndex}`);
    if (!voice) { noVoice.push(`${row.storyId} ${row.paragraphIndex}-${row.sentenceIndex} (${row.file})`); continue; }
    const bytes = readFileSync(mp3Path);
    const fileSha = createHash("sha256").update(bytes).digest("hex");
    const key = createHash("sha256").update(`${row.storyId}|${row.itemKey}|${row.tokenText}|${fileSha}`).digest("hex").slice(0, 24);
    const blobPath = `audio/story-words/${key}.mp3`;
    if (blobPaths.has(blobPath)) { dupBlob.push(`${blobPath}: ${blobPaths.get(blobPath)} и ${row.file}`); continue; }
    blobPaths.set(blobPath, row.file);
    inserts.push({
      row, mp3Path, blobPath, bytes: bytes.byteLength, voice,
      textHash: createHash("sha256").update(`${row.storyId}|${row.itemKey}|${row.tokenText}`).digest("hex"),
      duration: durationOf(mp3Path),
    });
  }

  // ---- план правки 46 ------------------------------------------------
  type Update = { id: string; from: string; to: string; blobPath: string; mp3Path: string; duration: number; bytes: number };
  const updates: Update[] = [];
  for (const r of rows46) {
    const mp3Path = join(MP346, r.file.replace(/\.wav$/i, ".mp3"));
    if (!existsSync(mp3Path)) { missing.push(r.file); continue; }
    const bytes = readFileSync(mp3Path);
    const fileSha = createHash("sha256").update(bytes).digest("hex");
    const key = createHash("sha256").update(`${r.contentId}|${r.itemKey}|${r.text}|${fileSha}`).digest("hex").slice(0, 24);
    const blobPath = `audio/story-words/${key}.mp3`;
    if (blobPaths.has(blobPath)) { dupBlob.push(`${blobPath}: ${blobPaths.get(blobPath)} и ${r.file}`); continue; }
    blobPaths.set(blobPath, r.file);
    updates.push({ id: r.id, from: r.audioUrl, to: "", blobPath, mp3Path, duration: durationOf(mp3Path), bytes: bytes.byteLength });
  }

  console.log(`ПЛАН`);
  console.log(`  вставок (новые вырезки): ${inserts.length} из ${plan.length}`);
  console.log(`  правок audioUrl (WAV → mp3, долг 132): ${updates.length} из ${rows46.length}`);
  console.log(`  занятых ключей (contentType, contentId, itemKey): ${refusedKey.length}`);
  for (const k of refusedKey) console.log(`    ${k}`);
  console.log(`  занятых/повторных путей Blob внутри плана: ${dupBlob.length}`);
  for (const k of dupBlob) console.log(`    ${k}`);
  console.log(`  предложений без записанного голоса каста: ${noVoice.length}`);
  for (const k of noVoice) console.log(`    ${k}`);
  console.log(`  голоса вставок: ${[...new Map([...inserts.reduce((m, i) => m.set(i.voice, (m.get(i.voice) ?? 0) + 1), new Map<string, number>())].sort()).entries()].map(([v, n]) => `${v} ${n}`).join(", ")}`);
  console.log(`  файлов mp3 не найдено: ${missing.length}`);
  for (const k of missing) console.log(`    ${k}`);
  console.log(`  различных путей Blob: ${blobPaths.size}`);

  if (DRY) { await db.$disconnect(); return refusedKey.length + dupBlob.length + missing.length + noVoice.length === 0 ? 0 : 1; }

  const { put } = await import("@vercel/blob");
  const token = process.env.AUDIO_BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.AUDIO_BLOB_STORE_ID;
  if (!token || !storeId) { console.error("нет AUDIO_BLOB_READ_WRITE_TOKEN / AUDIO_BLOB_STORE_ID"); return 2; }

  const journal = (obj: unknown) => { if (JOURNAL) appendFileSync(JOURNAL, `${JSON.stringify(obj)}\n`, "utf-8"); };

  let done = 0, failed = 0;
  const limit = ONLY > 0 ? ONLY : Infinity;

  for (const ins of inserts) {
    if (done >= limit) break;
    try {
      const blob = await put(ins.blobPath, readFileSync(ins.mp3Path), {
        access: "public", addRandomSuffix: false, allowOverwrite: false,
        contentType: "audio/mpeg", token, storeId,
      });
      await db.audioAsset.create({
        data: {
          contentType: "story-word", contentId: ins.row.storyId, itemKey: ins.row.itemKey,
          textHash: ins.textHash, text: ins.row.tokenText,
          voice: ins.voice, model: "cut-from-story-audio",
          audioUrl: blob.url, durationSeconds: ins.duration,
        },
      });
      journal({ op: "insert", file: ins.row.file, storyId: ins.row.storyId, itemKey: ins.row.itemKey, text: ins.row.tokenText, url: blob.url, bytes: ins.bytes, duration: ins.duration });
      done++;
      if (done % 50 === 0) console.log(`  … записано ${done}`);
    } catch (e) {
      failed++;
      console.error(`ОТКАЗ ${ins.row.file}: ${(e as Error).message}`);
      journal({ op: "insert-failed", file: ins.row.file, error: (e as Error).message });
    }
  }

  let done46 = 0;
  if (ONLY <= 0) {
    for (const up of updates) {
      try {
        const blob = await put(up.blobPath, readFileSync(up.mp3Path), {
          access: "public", addRandomSuffix: false, allowOverwrite: false,
          contentType: "audio/mpeg", token, storeId,
        });
        await db.audioAsset.update({ where: { id: up.id }, data: { audioUrl: blob.url, durationSeconds: up.duration } });
        journal({ op: "update-url", id: up.id, from: up.from, to: blob.url, bytes: up.bytes, duration: up.duration });
        done46++;
      } catch (e) {
        failed++;
        console.error(`ОТКАЗ правки ${up.id}: ${(e as Error).message}`);
        journal({ op: "update-failed", id: up.id, error: (e as Error).message });
      }
    }
  }

  console.log(`ЗАПИСАНО: вставок ${done}, правок audioUrl ${done46}, отказов ${failed}`);
  await db.$disconnect();
  return failed === 0 ? 0 : 1;
}

main().then((c) => process.exit(c));
