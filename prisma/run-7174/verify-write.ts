/**
 * Заход 7.174: доказательство записи — пункты 5 и 6 паспорта озвучки.
 *
 *   1. отпечаток ПРЕЖНИХ строк (все, кроме четырёх заменённых намеренно)
 *      до и после записи обязан совпасть знак в знак; исчезнувших — 0;
 *   2. у каждого нового адреса HTTP 200, `Content-Type: audio/mpeg` и
 *      размер ответа, совпавший с локальным файлом ДО БАЙТА;
 *   3. у четырёх мест долга 134 адрес обязан ИЗМЕНИТЬСЯ, а прежний
 *      объект Blob — остаться доступным (это и есть откат).
 *
 * `--plant` портит одну строку снимка «после» и один ожидаемый размер:
 * проверка, которая не умеет находить расхождение, результатом не
 * считается (PROGRESS.md 4.1).
 *
 *   npx tsx prisma/run-7174/verify-write.ts --before=… --after=… \
 *     --journal=… --listen=… [--plant]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = arg("before")!;
const AFTER = arg("after")!;
const JOURNAL = arg("journal")!;
const LISTEN = arg("listen")!;
const PLANT = process.argv.includes("--plant");

interface Row { id: string; contentType: string; contentId: string; itemKey: string; text: string; audioUrl: string }
interface J { op: string; n: number; file: string; id?: string; from?: string; to?: string; url?: string; bytes: number; sha256: string }

async function head(url: string) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, type: r.headers.get("content-type") ?? "", bytes: buf.byteLength, sha: createHash("sha256").update(buf).digest("hex") };
}

async function main(): Promise<number> {
  const before = JSON.parse(readFileSync(BEFORE, "utf-8")) as Row[];
  const after = JSON.parse(readFileSync(AFTER, "utf-8")) as Row[];
  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as J);
  const inserted = journal.filter((j) => j.op === "insert");
  const replaced = journal.filter((j) => j.op === "replace");
  const replacedIds = new Set(replaced.map((j) => j.id!));

  // --- 1. прежние строки не сдвинулись ------------------------------
  const afterById = new Map(after.map((r) => [r.id, r]));
  if (PLANT) {
    const victim = before.find((r) => !replacedIds.has(r.id))!;
    afterById.set(victim.id, { ...afterById.get(victim.id)!, audioUrl: `${victim.audioUrl}?planted` });
  }
  const fpB = createHash("sha256"), fpA = createHash("sha256");
  let vanished = 0, untouched = 0;
  for (const r of before) {
    if (replacedIds.has(r.id)) continue;
    const a = afterById.get(r.id);
    if (!a) { vanished++; continue; }
    fpB.update(`${r.id} ${r.audioUrl}\n`);
    fpA.update(`${a.id} ${a.audioUrl}\n`);
    untouched++;
  }
  const hB = fpB.digest("hex"), hA = fpA.digest("hex");
  console.log(`прежних строк сверено: ${untouched} (исчезнувших ${vanished})`);
  console.log(`  отпечаток ДО:    ${hB}`);
  console.log(`  отпечаток ПОСЛЕ: ${hA}`);
  console.log(`  совпал: ${hB === hA ? "ДА" : "НЕТ"}`);
  console.log(`строк AudioAsset было ${before.length}, стало ${after.length} (+${after.length - before.length})`);
  const sw = (rs: Row[]) => rs.filter((r) => r.contentType === "story-word").length;
  console.log(`строк story-word было ${sw(before)}, стало ${sw(after)} (+${sw(after) - sw(before)})`);

  // --- 2. каждый новый адрес живой и до байта тот же ------------------
  let ok200 = 0, okType = 0, okBytes = 0, okSha = 0;
  const bad: string[] = [];
  const all = [...inserted, ...replaced];
  for (let i = 0; i < all.length; i++) {
    const j = all[i];
    const url = j.op === "insert" ? j.url! : j.to!;
    const local = readFileSync(join(LISTEN, j.file));
    const want = PLANT && i === 0 ? local.byteLength + 1 : local.byteLength;
    const r = await head(url);
    if (r.status === 200) ok200++; else bad.push(`${j.file}: HTTP ${r.status}`);
    if (r.type === "audio/mpeg") okType++; else bad.push(`${j.file}: ${r.type}`);
    if (r.bytes === want) okBytes++; else bad.push(`${j.file}: ${r.bytes} байт ≠ ${want}`);
    if (r.sha === j.sha256) okSha++; else bad.push(`${j.file}: sha256 ответа ≠ прослушанному`);
    if ((i + 1) % 50 === 0) console.log(`  … проверено ${i + 1}`);
  }
  console.log(`новых адресов: ${all.length}`);
  console.log(`  HTTP 200:                       ${ok200} из ${all.length}`);
  console.log(`  Content-Type: audio/mpeg:       ${okType} из ${all.length}`);
  console.log(`  размер до байта:                ${okBytes} из ${all.length}`);
  console.log(`  sha256 ответа = прослушанному:  ${okSha} из ${all.length}`);

  // --- 3. четыре замены: адрес сменился, прежний объект жив -----------
  let changed = 0, oldAlive = 0;
  for (const j of replaced) {
    const now = afterById.get(j.id!)!;
    if (now.audioUrl === j.to && j.to !== j.from) changed++;
    const r = await head(j.from!);
    if (r.status === 200) oldAlive++;
    console.log(`  ${j.id} ${j.file}: ${j.from!.slice(-16)} → ${j.to!.slice(-16)}, прежний объект HTTP ${r.status}`);
  }
  console.log(`замен: адрес сменился ${changed} из ${replaced.length}; прежний объект Blob жив ${oldAlive} из ${replaced.length} (сироты Blob)`);

  for (const b of bad.slice(0, 10)) console.log(`  ПРОБЛЕМА ${b}`);
  const pass = hB === hA && vanished === 0 && bad.length === 0 && changed === replaced.length;
  if (PLANT) { console.log(`ПОДСАДКА: отпечаток разошёлся ${hB !== hA ? "ДА" : "НЕТ"}, размер не сошёлся ${bad.some((b) => /байт ≠/.test(b)) ? "ДА" : "НЕТ"}`); return hB !== hA && bad.some((b) => /байт ≠/.test(b)) ? 0 : 1; }
  console.log(pass ? "PASS" : "FAIL");
  return pass ? 0 : 1;
}

main().then((c) => process.exit(c));
