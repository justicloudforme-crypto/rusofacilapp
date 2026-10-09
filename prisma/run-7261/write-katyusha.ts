/**
 * Заход 7.261: три слова «Ключевой лексики» `song-katyusha` — «расцветать»,
 * «яблоня», «груша» — получают свои клипы. До 26.09 их держала заморозка,
 * потом — отсутствие разрешения на запись в прод.
 *
 * ПОРЯДОК — раздел 7 паспорта озвучки: снимок → `--dry-run` → запись.
 * Обкатка `--only=N` здесь не нужна: строк три, и пишутся они ОДНОЙ
 * транзакцией (поручение владельца), то есть «все или ни одной».
 *
 * ЧТО ЗАЛОЖЕНО В КОД, А НЕ В НАМЕРЕНИЕ.
 *
 * 1. **На прод уезжают ровно те байты, которые принял аудит.** sha256
 *    каждого файла сверяется с планом ниже; не совпал — отказ до сети.
 * 2. **Только вставка.** Ключ `(media, song-katyusha, vocab-<i>)` обязан
 *    быть свободен; занят — отказ, а не тихая замена.
 * 3. **Перезаписанных объектов Blob — 0.** Префикс свой
 *    (`audio/media-7261/`), `allowOverwrite: false`; путь, отвечающий не
 *    404 ещё до загрузки, — отказ. `--force` не предусмотрен.
 * 4. **Файл проверен до строки.** После загрузки каждый адрес обязан
 *    ответить 200, `audio/mpeg` и размером, совпавшим с файлом до байта; и
 *    только потом — транзакция в базу.
 *
 * Форма строки — как у 758 строк `media` захода 7.164: `itemKey` —
 * `vocab-<номер слова в mediaData.json>`, `text` — слово, уже
 * пропущенное через `sanitizeTextForTTS` (у этих трёх оно не меняется),
 * `textHash` — sha256 текста, голос `onyx`, модель `gpt-4o-mini-tts`.
 *
 * Синтеза здесь нет: скрипт не умеет обращаться ни к какой модели.
 *
 *   npx tsx prisma/run-7261/write-katyusha.ts --listen=<папка «принято»> \
 *     --journal=<written.jsonl> [--dry-run]
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";
import { sanitizeTextForTTS } from "@/lib/speech";
import mediaData from "@/lib/media/mediaData.json";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const LISTEN = arg("listen");
const JOURNAL = arg("journal");
const DRY = process.argv.includes("--dry-run");

const MEDIA_ID = "song-katyusha";
const BLOB_BASE = "https://0xvmk87qe017z4ei.public.blob.vercel-storage.com/";

/** Файлы, принятые аудитом 7.261 (Whisper, 19 из 19 контроля). */
export const PLAN = [
  { word: "расцветать", file: "расцветать.mp3", sha256: "15895a7c50d241e05322e43e42e6f15bb935f8b2de6e1f35736049f2ebb16898", seconds: 2.256 },
  { word: "яблоня", file: "яблоня.mp3", sha256: "7e9fa5543e8424e0cf79a156888bde5a6764ab980d4f5cf159bdc61bfba54ca8", seconds: 2.856 },
  { word: "груша", file: "груша.mp3", sha256: "871a31af4b76cc954cecd66cda3e7b44770d1c0b9c388cce08d8b526dadea136", seconds: 1.512 },
] as const;

export const blobPathFor = (itemKey: string) => `audio/media-7261/${MEDIA_ID}-${itemKey}.mp3`;

async function main(): Promise<number> {
  if (!LISTEN) { console.error("нужен --listen=<папка>"); return 2; }
  const vocab = (mediaData as Record<string, { vocabulary?: { word: string }[] }>)[MEDIA_ID]?.vocabulary ?? [];

  type Job = { word: string; itemKey: string; text: string; textHash: string; bytes: Buffer; blobPath: string; seconds: number };
  const jobs: Job[] = [];
  const problems: string[] = [];
  for (const p of PLAN) {
    const i = vocab.findIndex((v) => v.word === p.word);
    if (i < 0) { problems.push(`«${p.word}» нет в словаре ${MEDIA_ID}`); continue; }
    const text = sanitizeTextForTTS(p.word);
    if (text !== p.word) problems.push(`«${p.word}»: санитайзер меняет текст («${text}») — кнопка его не найдёт`);
    const path = join(LISTEN, p.file);
    if (!existsSync(path)) { problems.push(`нет файла ${path}`); continue; }
    const bytes = readFileSync(path);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== p.sha256) { problems.push(`${p.file}: sha256 ${sha.slice(0, 12)}… ≠ принятому ${p.sha256.slice(0, 12)}…`); continue; }
    const itemKey = `vocab-${i}`;
    jobs.push({ word: p.word, itemKey, text, textHash: createHash("sha256").update(text).digest("hex"), bytes, blobPath: blobPathFor(itemKey), seconds: p.seconds });
  }

  // Объекты, уже загруженные ЭТИМ заходом (по журналу), второй раз не
  // грузятся: `allowOverwrite: false` сделал бы повтор отказом. Так и
  // случилось 09.10: первый запуск загрузил vocab-0, а проверка сразу после
  // загрузки получила 404 (CDN ещё не видел объект) и честно остановилась
  // до базы.
  const uploaded = new Set<string>();
  if (JOURNAL && existsSync(JOURNAL)) {
    for (const line of readFileSync(JOURNAL, "utf-8").trim().split("\n").filter(Boolean)) {
      const j = JSON.parse(line) as { op: string; itemKey: string };
      if (j.op === "blob") uploaded.add(j.itemKey);
    }
  }
  if (uploaded.size) console.log(`  уже загружено этим заходом (по журналу): ${[...uploaded].join(", ")} — повторно не грузится`);

  // Свободны ли пути Blob — до любой записи (чтение публичного адреса).
  for (const j of jobs) {
    if (uploaded.has(j.itemKey)) continue;
    const res = await fetch(BLOB_BASE + j.blobPath, { method: "HEAD" });
    if (res.status !== 404) problems.push(`путь Blob ${j.blobPath} уже отвечает ${res.status}`);
  }

  console.log("ПЛАН (строки AudioAsset, которые появятся):");
  for (const j of jobs) {
    console.log(`  + contentType=media contentId=${MEDIA_ID} itemKey=${j.itemKey} text=«${j.text}» voice=onyx model=gpt-4o-mini-tts durationSeconds=${j.seconds}`);
    console.log(`      textHash=${j.textHash}`);
    console.log(`      audioUrl=${BLOB_BASE}${j.blobPath} (${j.bytes.byteLength} байт)`);
  }
  console.log(`  препятствий: ${problems.length}`);
  for (const p of problems) console.log(`    ${p}`);
  if (problems.length || jobs.length !== PLAN.length) { console.error("ОТКАЗ: план не чист."); return 1; }
  // Сухой прогон в боевую базу не ходит вовсе: занятость ключей и счёт
  // строк до записи снимаются отдельно, обёрткой только-чтения.
  if (DRY) { console.log("--dry-run: в Blob и в базу не отправлено ничего."); return 0; }

  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const url = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(url)) { console.error(`ОТКАЗ: TURSO_DATABASE_URL не боевой`); return 2; }
  const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });

  const taken = await db.audioAsset.findMany({
    where: { contentType: "media", contentId: MEDIA_ID, itemKey: { in: jobs.map((j) => j.itemKey) } },
    select: { itemKey: true },
  });
  const before = await db.audioAsset.count();
  console.log(`  занятых ключей: ${taken.length}; строк AudioAsset сейчас: ${before}`);
  if (taken.length) { console.error("ОТКАЗ: ключ занят."); await db.$disconnect(); return 1; }

  const token = process.env.AUDIO_BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.AUDIO_BLOB_STORE_ID;
  if (!token || !storeId) { console.error("ОТКАЗ: нет AUDIO_BLOB_READ_WRITE_TOKEN / AUDIO_BLOB_STORE_ID"); return 2; }
  const { put } = await import("@vercel/blob");
  const journal = (obj: unknown) => { if (JOURNAL) appendFileSync(JOURNAL, `${JSON.stringify(obj)}\n`, "utf-8"); };

  const urls = new Map<string, string>();
  for (const j of jobs) {
    let blobUrl = BLOB_BASE + j.blobPath;
    if (!uploaded.has(j.itemKey)) {
      const blob = await put(j.blobPath, j.bytes, {
        access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "audio/mpeg", token, storeId,
      });
      blobUrl = blob.url;
    }
    // Сразу после загрузки CDN может ещё отвечать 404 — повтор до ~30 с.
    let res: Response | undefined;
    let body = Buffer.alloc(0);
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 3000));
      res = await fetch(blobUrl, { cache: "no-store" });
      body = Buffer.from(await res.arrayBuffer());
      if (res.status === 200 && body.equals(j.bytes)) break;
    }
    const ok = res!.status === 200 && /audio\/mpeg/.test(res!.headers.get("content-type") ?? "") && body.equals(j.bytes);
    journal({ op: "blob", itemKey: j.itemKey, url: blobUrl, status: res!.status, bytes: body.byteLength, sameBytes: body.equals(j.bytes) });
    if (blobUrl !== BLOB_BASE + j.blobPath) { console.error(`ОТКАЗ: адрес ${blobUrl} не тот, что в плане`); await db.$disconnect(); return 1; }
    console.log(`  Blob ${j.blobPath}: ${res!.status}, ${res!.headers.get("content-type")}, ${body.byteLength} байт, совпал с файлом: ${body.equals(j.bytes)}`);
    if (!ok) { console.error("ОТКАЗ: файл в Blob не совпал — в базу не пишем."); await db.$disconnect(); return 1; }
    urls.set(j.itemKey, blobUrl);
  }

  const created = await db.$transaction(
    jobs.map((j) =>
      db.audioAsset.create({
        data: {
          contentType: "media", contentId: MEDIA_ID, itemKey: j.itemKey, textHash: j.textHash, text: j.text,
          voice: "onyx", model: "gpt-4o-mini-tts", audioUrl: urls.get(j.itemKey)!, durationSeconds: j.seconds,
        },
        select: { id: true, itemKey: true, audioUrl: true },
      }),
    ),
  );
  for (const c of created) journal({ op: "insert", ...c });
  const after = await db.audioAsset.count();
  console.log(`ЗАПИСАНО одной транзакцией: ${created.length} строк; AudioAsset ${before} → ${after}`);
  for (const c of created) console.log(`  ${c.itemKey} → ${c.id}`);
  await db.$disconnect();
  return after === before + jobs.length ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) main().then((c) => process.exit(c));
