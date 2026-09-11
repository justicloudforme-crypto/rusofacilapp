/**
 * Заход 7.170: доказательство записи — пункты 5 и 6 паспорта озвучки.
 *
 *   1. отпечаток ПРЕЖНИХ строк (все, кроме 46 переведённых на mp3) до и
 *      после записи обязан совпасть знак в знак; исчезнувших — 0;
 *   2. у каждого нового адреса HTTP 200, `Content-Type: audio/mpeg` и
 *      размер ответа, совпавший с локальным файлом ДО БАЙТА.
 *
 * `--plant` портит одну строку снимка «после» и один ожидаемый размер и
 * ждёт, что обе половины покраснеют: проверка, которая не умеет находить
 * расхождение, результатом не считается (PROGRESS.md 4.1).
 *
 *   npx tsx prisma/run-7170/verify-write.ts --before=<…> --after=<…> \
 *     --journal=<written.jsonl> --mp3=<папка420> --mp3-46=<папка46> [--plant]
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = arg("before")!;
const AFTER = arg("after")!;
const JOURNAL = arg("journal")!;
const MP3 = arg("mp3")!;
const MP346 = arg("mp3-46")!;
const PLANT = process.argv.includes("--plant");

interface Row { id: string; contentType: string; contentId: string; itemKey: string; text: string; audioUrl: string }
interface JournalRow { op: string; file?: string; url?: string; id?: string; to?: string; bytes: number }

async function main(): Promise<number> {
  const before = JSON.parse(readFileSync(BEFORE, "utf-8")) as Row[];
  const after = JSON.parse(readFileSync(AFTER, "utf-8")) as Row[];
  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as JournalRow);

  const inserted = journal.filter((j) => j.op === "insert");
  const updated = journal.filter((j) => j.op === "update-url");
  const updatedIds = new Set(updated.map((j) => j.id!));

  // --- половина 1: прежние строки не сдвинулись --------------------
  const afterById = new Map(after.map((r) => [r.id, r]));
  if (PLANT) {
    const victim = before.find((r) => !updatedIds.has(r.id))!;
    afterById.set(victim.id, { ...afterById.get(victim.id)!, audioUrl: `${victim.audioUrl}?planted` });
  }
  const fpBefore = createHash("sha256");
  const fpAfter = createHash("sha256");
  let vanished = 0;
  let untouched = 0;
  for (const r of before) {
    if (updatedIds.has(r.id)) continue;
    const a = afterById.get(r.id);
    if (!a) { vanished++; continue; }
    fpBefore.update(`${r.id} ${r.audioUrl}\n`);
    fpAfter.update(`${a.id} ${a.audioUrl}\n`);
    untouched++;
  }
  const hb = fpBefore.digest("hex");
  const ha = fpAfter.digest("hex");
  console.log(`прежних строк, не задетых заходом: ${untouched} (из ${before.length}; 46 переведены на mp3 намеренно)`);
  console.log(`  отпечаток до:    ${hb}`);
  console.log(`  отпечаток после: ${ha}`);
  console.log(`  совпал знак в знак: ${hb === ha ? "ДА" : "НЕТ"}`);
  console.log(`  исчезнувших строк: ${vanished}`);
  console.log(`строк стало: ${after.length} (было ${before.length}, разница ${after.length - before.length})`);
  console.log(`строк story-word: ${after.filter((r) => r.contentType === "story-word").length}`);

  // --- половина 2: каждый новый адрес отдаётся ----------------------
  const targets: { url: string; localBytes: number; what: string }[] = [];
  for (const j of inserted) {
    const local = join(MP3, j.file!.replace(/\.wav$/i, ".mp3"));
    targets.push({ url: j.url!, localBytes: readFileSync(local).byteLength, what: j.file! });
  }
  for (const j of updated) {
    const row = before.find((r) => r.id === j.id)!;
    const local = join(MP346, `${row.audioUrl.split("/").pop()!.replace(/\.wav$/i, ".mp3")}`);
    if (!existsSync(local)) { console.log(`  нет локального файла для ${j.id}`); continue; }
    targets.push({ url: j.to!, localBytes: readFileSync(local).byteLength, what: `правка ${j.id}` });
  }
  if (PLANT && targets.length) targets[0].localBytes += 1;

  let ok200 = 0, okType = 0, okBytes = 0;
  const bad: string[] = [];
  const CONC = 12;
  let i = 0;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      for (;;) {
        const t = targets[i++];
        if (!t) return;
        const res = await fetch(t.url);
        const buf = Buffer.from(await res.arrayBuffer());
        if (res.status === 200) ok200++; else bad.push(`${t.what}: код ${res.status}`);
        if (res.headers.get("content-type") === "audio/mpeg") okType++;
        else bad.push(`${t.what}: Content-Type ${res.headers.get("content-type")}`);
        if (buf.byteLength === t.localBytes) okBytes++;
        else bad.push(`${t.what}: ${buf.byteLength} б ≠ ${t.localBytes} б`);
      }
    }),
  );
  console.log(`адресов проверено: ${targets.length}`);
  console.log(`  HTTP 200: ${ok200} из ${targets.length}`);
  console.log(`  Content-Type audio/mpeg: ${okType} из ${targets.length}`);
  console.log(`  размер совпал до байта: ${okBytes} из ${targets.length}`);
  if (bad.length) for (const b of bad.slice(0, 10)) console.log(`  ОТКАЗ ${b}`);

  const clean = hb === ha && vanished === 0 && bad.length === 0;
  if (PLANT) {
    const caughtFp = hb !== ha;
    const caughtSize = bad.some((b) => /≠/.test(b));
    console.log(`[плант] отпечаток: ${caughtFp ? "поймано" : "ПРОВАЛ"}; размер до байта: ${caughtSize ? "поймано" : "ПРОВАЛ"}`);
    return caughtFp && caughtSize ? 0 : 1;
  }
  console.log(clean ? "PASS" : "ОТКАЗ");
  return clean ? 0 : 1;
}

main().then((c) => process.exit(c));
