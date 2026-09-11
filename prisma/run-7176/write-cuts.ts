/**
 * Заход 7.176: запись семи одобренных владельцем вырезок омографов на
 * прод — шесть мест долга 136 и «стороны» (попытка Б).
 *
 * ПОРЯДОК — раздел 7 паспорта озвучки, от него не отступают: снимок →
 * `--dry-run` → обкатка `--only=N` → запись.
 *
 * ТРИ ПРАВИЛА ЗАХОДА, И ВСЕ ТРИ ЗАЛОЖЕНЫ В КОД, А НЕ В НАМЕРЕНИЕ.
 *
 * 1. **На прод уезжают ровно те байты, которые слушал владелец.** Перед
 *    каждой загрузкой sha256 файла сверяется с sha256 из плана (а тот —
 *    с `список.txt` шагом `verify-plan.ts`). Не совпал — файл НЕ пишется.
 * 2. **Перезаписанных объектов Blob — 0.** `allowOverwrite: false` у
 *    всего; `--force` не предусмотрен вовсе. Префикс у этого захода СВОЙ
 *    (`audio/story-words-7176/`), поэтому ни один прежний объект не может
 *    оказаться на пути новой загрузки даже случайно.
 * 3. **Только вставка.** Замен `audioUrl` заход не делает вовсе: занятый
 *    ключ — отказ, а не тихая правка. Долг 137 правится отдельным
 *    скриптом и одним `UPDATE` колонки `voice`.
 *
 * Синтеза здесь нет и быть не может: скрипт не умеет обращаться ни к
 * какой модели.
 *
 *   npx tsx prisma/run-7176/write-cuts.ts --plan=<plan.json> --listen=<папка> \
 *     --journal=<written.jsonl> [--dry-run] [--only=N]
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const PLAN = arg("plan")!;
const LISTEN = arg("listen")!;
const JOURNAL = arg("journal");
const DRY = process.argv.includes("--dry-run");
const ONLY = Number(arg("only") ?? 0);

export interface PlanRow {
  n: number; op: "insert"; file: string; storyId: string; title: string;
  paragraphIndex: number; sentenceIndex: number; tokenIndex: number; itemKey: string;
  word: string; voice: string; method: string; model: string;
  sha256: string; bytes: number; seconds: number;
}

/** Путь в Blob: место входит в ключ намеренно (7.170) — иначе два
 *  вхождения с совпавшим звуком получили бы один путь. Префикс свой у
 *  каждого захода записи, чтобы `allowOverwrite: false` не мог упереться
 *  в объект прошлого захода. */
export const blobPathFor = (r: PlanRow, sha: string) =>
  `audio/story-words-7176/${createHash("sha256").update(`${r.storyId}|${r.itemKey}|${r.word}|${sha}`).digest("hex").slice(0, 24)}.mp3`;
export const textHashFor = (r: PlanRow) =>
  createHash("sha256").update(`${r.storyId}|${r.itemKey}|${r.word}`).digest("hex");

async function main(): Promise<number> {
  const plan = JSON.parse(readFileSync(PLAN, "utf-8")) as PlanRow[];

  // Уже записанное обкаткой не пишется второй раз: путь в Blob занят с
  // первой попытки, и `allowOverwrite: false` сделал бы повтор ОТКАЗОМ.
  const doneN = new Set<number>();
  if (JOURNAL && existsSync(JOURNAL)) {
    for (const line of readFileSync(JOURNAL, "utf-8").trim().split("\n").filter(Boolean)) {
      const j = JSON.parse(line) as { op: string; n: number };
      if (j.op === "insert") doneN.add(j.n);
    }
  }
  if (doneN.size) console.log(`  уже записано прежним запуском (по журналу): ${doneN.size} — пропускается`);

  type Job = { row: PlanRow; bytes: Buffer; blobPath: string; textHash: string };
  const jobs: Job[] = [];
  const refusedSha: string[] = [];
  const missing: string[] = [];
  const blobPaths = new Map<string, string>();
  const dupBlob: string[] = [];

  for (const row of plan) {
    if (row.op !== "insert") { refusedSha.push(`№${row.n}: заход умеет только вставку`); continue; }
    if (doneN.has(row.n)) continue;
    const path = join(LISTEN, row.file);
    if (!existsSync(path)) { missing.push(row.file); continue; }
    const bytes = readFileSync(path);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== row.sha256) { refusedSha.push(`№${row.n} ${row.file}: sha256 ${sha.slice(0, 12)}… ≠ прослушанному ${row.sha256.slice(0, 12)}…`); continue; }
    const blobPath = blobPathFor(row, sha);
    if (blobPaths.has(blobPath)) { dupBlob.push(`${blobPath}: ${blobPaths.get(blobPath)} и ${row.file}`); continue; }
    blobPaths.set(blobPath, row.file);
    jobs.push({ row, bytes, blobPath, textHash: textHashFor(row) });
  }

  console.log("ПЛАН");
  console.log(`  вставок: ${jobs.length} из ${plan.length}`);
  for (const j of jobs) console.log(`    №${j.row.n} ${j.row.file} → ${j.row.storyId} ${j.row.itemKey} «${j.row.word}» голос ${j.row.voice} метод ${j.row.method} → ${j.blobPath}`);
  console.log(`  файлов с разошедшимся sha256 (НЕ пишутся): ${refusedSha.length}`);
  for (const b of refusedSha) console.log(`    ${b}`);
  console.log(`  файлов не найдено: ${missing.length}`);
  for (const b of missing) console.log(`    ${b}`);
  console.log(`  повторных путей Blob внутри плана: ${dupBlob.length}`);
  console.log(`  различных путей Blob: ${blobPaths.size}`);
  const voices = jobs.reduce((m, j) => m.set(j.row.voice, (m.get(j.row.voice) ?? 0) + 1), new Map<string, number>());
  console.log(`  голоса: ${[...voices].sort().map(([v, n]) => `${v} ${n}`).join(", ")}`);

  const blocked = refusedSha.length + missing.length + dupBlob.length;
  if (DRY) { console.log(`--dry-run: на прод не отправлено ничего. Препятствий: ${blocked}.`); return blocked === 0 ? 0 : 1; }
  if (blocked > 0) { console.error("ОТКАЗ: план не чист, запись не начиналась."); return 1; }

  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const url = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(url)) { console.error(`ОТКАЗ: TURSO_DATABASE_URL не боевой (${url})`); return 2; }
  const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });

  const { put } = await import("@vercel/blob");
  const token = process.env.AUDIO_BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.AUDIO_BLOB_STORE_ID;
  if (!token || !storeId) { console.error("ОТКАЗ: нет AUDIO_BLOB_READ_WRITE_TOKEN / AUDIO_BLOB_STORE_ID"); return 2; }

  const journal = (obj: unknown) => { if (JOURNAL) appendFileSync(JOURNAL, `${JSON.stringify(obj)}\n`, "utf-8"); };

  let ins = 0, failed = 0;
  const limit = ONLY > 0 ? ONLY : Infinity;
  for (const j of jobs) {
    if (ins >= limit) break;
    try {
      const blob = await put(j.blobPath, j.bytes, {
        access: "public", addRandomSuffix: false, allowOverwrite: false,
        contentType: "audio/mpeg", token, storeId,
      });
      const created = await db.audioAsset.create({
        data: {
          contentType: "story-word", contentId: j.row.storyId, itemKey: j.row.itemKey,
          textHash: j.textHash, text: j.row.word,
          voice: j.row.voice, model: j.row.model,
          audioUrl: blob.url, durationSeconds: j.row.seconds,
        },
        select: { id: true },
      });
      journal({ op: "insert", n: j.row.n, file: j.row.file, id: created.id, storyId: j.row.storyId,
        itemKey: j.row.itemKey, text: j.row.word, voice: j.row.voice, model: j.row.model,
        url: blob.url, blobPath: j.blobPath, bytes: j.bytes.byteLength, duration: j.row.seconds, sha256: j.row.sha256 });
      console.log(`  записано №${j.row.n} ${j.row.file} → строка ${created.id}`);
      ins++;
    } catch (e) {
      failed++;
      console.error(`ОТКАЗ ${j.row.file}: ${(e as Error).message}`);
      journal({ op: "failed", n: j.row.n, file: j.row.file, error: (e as Error).message });
    }
  }
  console.log(`ЗАПИСАНО: вставок ${ins}, отказов ${failed}`);
  await db.$disconnect();
  return failed === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) main().then((c) => process.exit(c));
