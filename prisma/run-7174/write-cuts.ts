/**
 * Заход 7.174: запись 214 прослушанных владельцем вырезок омографов на
 * прод — 210 новыми строками (долг 131) и 4 заменой `audioUrl` у уже
 * существующих строк (долг 134).
 *
 * ПОРЯДОК — раздел 7 паспорта озвучки, от него не отступают: снимок →
 * `--dry-run` → `--only=5` → запись.
 *
 * ТРИ ПРАВИЛА ЗАХОДА, И ВСЕ ТРИ ЗАЛОЖЕНЫ В КОД, А НЕ В НАМЕРЕНИЕ.
 *
 * 1. **На прод уезжают ровно те байты, которые слушал владелец.** Перед
 *    каждой загрузкой sha256 файла сверяется с sha256 из плана (а тот, в
 *    свою очередь, сверен с `список.txt` шагом `verify-plan.ts`).
 *    Не совпал — файл НЕ пишется, место попадает в отчёт.
 * 2. **Перезаписанных объектов Blob — 0.** `allowOverwrite: false` у
 *    всего; `--force` не предусмотрен вовсе. Все 214 путей новые, включая
 *    четыре замены: у замены прежний объект Blob остаётся лежать (это и
 *    есть откат), а строка получает НОВЫЙ адрес.
 * 3. **Замена — по поимённому списку ключей, а не общим флагом.** Скрипт
 *    правит `audioUrl` ТОЛЬКО у строк, чей `id` назван в `--replace-ids=`
 *    и чей ключ совпал с планом. Любая другая строка — отказ до
 *    соединения.
 *
 * Синтеза здесь нет и быть не может: скрипт не умеет обращаться ни к
 * какой модели.
 *
 *   npx tsx prisma/run-7174/write-cuts.ts --plan=<plan.json> --listen=<папка> \
 *     --replace-ids=<id,id,id,id> --journal=<written.jsonl> [--dry-run] [--only=N]
 */
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const PLAN = arg("plan")!;
const LISTEN = arg("listen")!;
const REPLACE_IDS = (arg("replace-ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const JOURNAL = arg("journal");
const DRY = process.argv.includes("--dry-run");
const ONLY = Number(arg("only") ?? 0);

interface PlanRow {
  n: number; op: "insert" | "replace"; rowId: string | null; wasUrl: string | null;
  folder: string; file: string; storyId: string; title: string;
  paragraphIndex: number; sentenceIndex: number; tokenIndex: number; itemKey: string;
  word: string; voice: string; sha256: string; bytes: number; seconds: number;
}

async function main(): Promise<number> {
  const plan = JSON.parse(readFileSync(PLAN, "utf-8")) as PlanRow[];
  const inserts = plan.filter((r) => r.op === "insert");
  const replaces = plan.filter((r) => r.op === "replace");

  // ---- правило 3: поимённый список ключей, а не общий флаг ----------
  const named = new Set(REPLACE_IDS);
  const badReplace: string[] = [];
  for (const r of replaces) if (!r.rowId || !named.has(r.rowId)) badReplace.push(`№${r.n} ${r.file}: строка ${r.rowId} не названа в --replace-ids`);
  for (const id of named) if (!replaces.some((r) => r.rowId === id)) badReplace.push(`--replace-ids называет ${id}, которого нет в плане замен`);

  // ---- уже записанное (обкатка --only=5) не пишется второй раз ------
  // Путь в Blob занят с первой попытки, и `allowOverwrite: false` сделал
  // бы повтор ОТКАЗОМ. Поэтому продолжение читает свой журнал и
  // пропускает то, что уже уехало; журнал — единственный источник этого
  // знания, второй перепиской базы за него не платим.
  const doneN = new Set<number>();
  if (JOURNAL && existsSync(JOURNAL)) {
    for (const line of readFileSync(JOURNAL, "utf-8").trim().split("\n").filter(Boolean)) {
      const j = JSON.parse(line) as { op: string; n: number };
      if (j.op === "insert" || j.op === "replace") doneN.add(j.n);
    }
  }
  if (doneN.size) console.log(`  уже записано прежним запуском (по журналу): ${doneN.size} — пропускается`);

  // ---- правило 1: те ли это байты ----------------------------------
  type Job = { row: PlanRow; path: string; bytes: Buffer; blobPath: string; textHash: string };
  const jobs: Job[] = [];
  const refusedSha: string[] = [];
  const missing: string[] = [];
  const blobPaths = new Map<string, string>();
  const dupBlob: string[] = [];

  for (const row of plan) {
    if (doneN.has(row.n)) continue;
    const path = join(LISTEN, row.file);
    if (!existsSync(path)) { missing.push(row.file); continue; }
    const bytes = readFileSync(path);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== row.sha256) { refusedSha.push(`№${row.n} ${row.file}: sha256 ${sha.slice(0, 12)}… ≠ прослушанному ${row.sha256.slice(0, 12)}…`); continue; }
    // Путь в Blob — как в 7.170: место входит в ключ намеренно, иначе два
    // вхождения с совпавшим звуком получили бы один путь.
    const key = createHash("sha256").update(`${row.storyId}|${row.itemKey}|${row.word}|${sha}`).digest("hex").slice(0, 24);
    const blobPath = `audio/story-words/${key}.mp3`;
    if (blobPaths.has(blobPath)) { dupBlob.push(`${blobPath}: ${blobPaths.get(blobPath)} и ${row.file}`); continue; }
    blobPaths.set(blobPath, row.file);
    jobs.push({ row, path, bytes, blobPath, textHash: createHash("sha256").update(`${row.storyId}|${row.itemKey}|${row.word}`).digest("hex") });
  }

  console.log("ПЛАН");
  console.log(`  вставок (долг 131): ${jobs.filter((j) => j.row.op === "insert").length} из ${inserts.length}`);
  console.log(`  замен audioUrl (долг 134): ${jobs.filter((j) => j.row.op === "replace").length} из ${replaces.length}`);
  console.log(`  поимённый список ключей замены: ${REPLACE_IDS.length}, расхождений ${badReplace.length}`);
  for (const b of badReplace) console.log(`    ${b}`);
  console.log(`  файлов с разошедшимся sha256 (НЕ пишутся): ${refusedSha.length}`);
  for (const b of refusedSha) console.log(`    ${b}`);
  console.log(`  файлов не найдено: ${missing.length}`);
  for (const b of missing) console.log(`    ${b}`);
  console.log(`  повторных путей Blob внутри плана: ${dupBlob.length}`);
  for (const b of dupBlob) console.log(`    ${b}`);
  console.log(`  различных путей Blob: ${blobPaths.size}`);
  const voices = jobs.reduce((m, j) => m.set(j.row.voice, (m.get(j.row.voice) ?? 0) + 1), new Map<string, number>());
  console.log(`  голоса: ${[...voices].sort().map(([v, n]) => `${v} ${n}`).join(", ")}`);

  const blocked = badReplace.length + refusedSha.length + missing.length + dupBlob.length;
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

  let ins = 0, rep = 0, failed = 0;
  const limit = ONLY > 0 ? ONLY : Infinity;
  for (const j of jobs) {
    if (ins + rep >= limit) break;
    try {
      const blob = await put(j.blobPath, j.bytes, {
        access: "public", addRandomSuffix: false, allowOverwrite: false,
        contentType: "audio/mpeg", token, storeId,
      });
      if (j.row.op === "insert") {
        await db.audioAsset.create({
          data: {
            contentType: "story-word", contentId: j.row.storyId, itemKey: j.row.itemKey,
            textHash: j.textHash, text: j.row.word,
            voice: j.row.voice, model: j.row.folder === "А" ? "gpt-4o-mini-tts-cut" : "cut-from-story-audio",
            audioUrl: blob.url, durationSeconds: j.row.seconds,
          },
        });
        journal({ op: "insert", n: j.row.n, file: j.row.file, storyId: j.row.storyId, itemKey: j.row.itemKey,
          text: j.row.word, url: blob.url, blobPath: j.blobPath, bytes: j.bytes.byteLength, duration: j.row.seconds, sha256: j.row.sha256 });
        ins++;
      } else {
        // замена только у поимённо названной строки и только если её ключ тот же
        const cur = await db.audioAsset.findUnique({ where: { id: j.row.rowId! }, select: { contentType: true, contentId: true, itemKey: true, audioUrl: true } });
        if (!cur || cur.contentType !== "story-word" || cur.contentId !== j.row.storyId || cur.itemKey !== j.row.itemKey) {
          throw new Error(`строка ${j.row.rowId} не та: ${JSON.stringify(cur)}`);
        }
        await db.audioAsset.update({ where: { id: j.row.rowId! }, data: { audioUrl: blob.url, durationSeconds: j.row.seconds, voice: j.row.voice } });
        journal({ op: "replace", n: j.row.n, file: j.row.file, id: j.row.rowId, storyId: j.row.storyId, itemKey: j.row.itemKey,
          from: cur.audioUrl, to: blob.url, blobPath: j.blobPath, bytes: j.bytes.byteLength, duration: j.row.seconds, sha256: j.row.sha256 });
        rep++;
      }
      if ((ins + rep) % 50 === 0) console.log(`  … записано ${ins + rep}`);
    } catch (e) {
      failed++;
      console.error(`ОТКАЗ ${j.row.file}: ${(e as Error).message}`);
      journal({ op: "failed", n: j.row.n, file: j.row.file, error: (e as Error).message });
    }
  }
  console.log(`ЗАПИСАНО: вставок ${ins}, замен audioUrl ${rep}, отказов ${failed}`);
  await db.$disconnect();
  return failed === 0 ? 0 : 1;
}

main().then((c) => process.exit(c));
