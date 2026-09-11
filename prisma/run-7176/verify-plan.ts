/**
 * Заход 7.176, часть 1: сверка ДО записи — семь утверждений на каждый из
 * семи файлов, которые владелец прослушал в 7.175 и одобрил.
 *
 * Источник правды о том, ЧТО слушал владелец, — `список.txt` из папки
 * `~/rusofacil-listen/7.175/на-слух/`: в нём напечатан sha256 каждого
 * файла. План (`работа/папка.json`) сверяется С НИМ, а не наоборот.
 *
 * Решение владельца от 11.09.2026 передаётся списком номеров
 * (`--approved=`), а не зашито в код: забраковано 0, из подпапки `136`
 * одобрены все шесть мест (включая два, которых не принял аудит, — ухо
 * владельца решающее), из подпапки `стороны` на прод идёт ОДНА попытка.
 *
 * Семь утверждений, и ни одно не необязательное:
 *   1. sha256 файла на диске = sha256 из `список.txt` (на прод уезжают
 *      РОВНО прослушанные байты);
 *   2. ключ места из `список.txt` = ключу плана;
 *   3. `itemKey` пересчитан по тексту рассказа со СВЕЖЕГО снимка прода:
 *      токен по этому номеру равен нужному слову и это омограф, а текст
 *      предложения совпал знак в знак;
 *   4. голос файла = голосу каста ЭТОГО ЖЕ предложения (колонка
 *      `AudioAsset.voice` строки `contentType='story'`), а не ярлыку
 *      журнала — правило долга 136;
 *   5. параметры банка: mp3, 24 000 Гц, моно, 128 kbps;
 *   6. односторонний допуск длительности 0…96 мс против исходного WAV;
 *   7. ключ места на проде СВОБОДЕН — это вставка, а не перезапись.
 *
 * Подсадки, каждая обязана быть отвергнута и ни одна ничего не пишет на
 * диск: `--plant=место` (файлу подсовывается соседняя строка списка),
 * `--plant=байты` (к файлу дописывается байт в памяти), `--plant=голос`
 * (месту приписывается чужой голос каста).
 *
 *   npx tsx prisma/run-7176/verify-plan.ts --listen=<папка на-слух> \
 *     --folder=<папка.json> --wav=<папка работа> --approved=1,2,3,4,5,6,8 \
 *     --snapshot=prisma/snapshots/prod-7176.db --out=<plan.json> [--plant=…]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { storyWordItemKey, isHomograph } from "@/lib/story-word-pick";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const LISTEN = arg("listen")!;
const FOLDER = arg("folder")!;
const WAVDIR = arg("wav")!;
const SNAPSHOT = arg("snapshot") ?? "prisma/snapshots/prod-latest.db";
const APPROVED = new Set((arg("approved") ?? "").split(",").map((s) => Number(s.trim())).filter(Boolean));
const OUT = arg("out");
const PLANT = arg("plant") ?? "";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;
/** Четыре кадра MPEG-2 Layer III на 24 кГц = 96 мс (паспорт озвучки, раздел 6). */
const MAX_DELTA_MS = 96;

interface FolderRow {
  n: number; file: string; story: string; word: string; key: string;
  voice: string; role: string; metod: string; sha: string; sentence: string;
  rejected: boolean; why: string; seconds: number; delta_ms: number;
}

function probe(file: string) {
  const out = execFileSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "a:0",
     "-show_entries", "stream=codec_name,sample_rate,channels,bit_rate",
     "-show_entries", "format=duration", "-of", "default=nw=1", file],
    { encoding: "utf-8" },
  );
  const v: Record<string, string> = {};
  for (const line of out.trim().split("\n")) { const i = line.indexOf("="); v[line.slice(0, i)] = line.slice(i + 1); }
  return {
    codec: v.codec_name, sampleRate: Number(v.sample_rate), channels: Number(v.channels),
    bitRate: Number(v.bit_rate), seconds: Number(v.duration),
  };
}

/** Исходный WAV вырезки: метод А лежит в `работа/вырезки`, метод Б — в `работа/Б`. */
function wavFor(row: FolderRow, storyId: string): string | null {
  const dir = join(WAVDIR, row.metod === "Б" ? "Б" : "вырезки");
  if (!existsSync(dir)) return null;
  const hit = readdirSync(dir).filter((f) => f.startsWith(`cut_${storyId}_`) && f.endsWith(".wav"));
  return hit.length === 1 ? join(dir, hit[0]) : null;
}

function wavSeconds(path: string): number {
  const b = readFileSync(path);
  const rate = b.readUInt32LE(24), bits = b.readUInt16LE(34), ch = b.readUInt16LE(22);
  // ищем чанк data, а не верим смещению 44: у некоторых писателей есть LIST
  let off = 12;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "data") return size / (rate * ch * (bits / 8));
    off += 8 + size + (size % 2);
  }
  throw new Error(`нет чанка data в ${path}`);
}

function main(): number {
  // --- что слушал владелец -------------------------------------------
  const listText = readFileSync(join(LISTEN, "список.txt"), "utf-8").split("\n");
  const listed = listText.filter((l) => /^\d+\t/.test(l)).map((l) => {
    const [n, file, story, stressed, key, role, method, sha, sentence] = l.split("\t");
    const [storyId, itemKey] = key.split(" ");
    return { n: Number(n), file, story, stressed, storyId, itemKey, role, method, sha256: sha, sentence };
  });
  const all = JSON.parse(readFileSync(FOLDER, "utf-8")) as FolderRow[];
  const plan = all.filter((r) => APPROVED.has(r.n));

  // --- тексты рассказов и озвучка со СВЕЖЕГО снимка прода ------------
  const db = new Database(SNAPSHOT, { readonly: true });
  const stories = new Map<string, { title: string; text: string }>();
  for (const r of db.prepare("select id, title, text from Story").all() as { id: string; title: string; text: string }[]) {
    stories.set(r.id, { title: r.title, text: r.text });
  }
  const castVoice = new Map<string, string>();
  for (const r of db.prepare("select contentId, itemKey, voice from AudioAsset where contentType='story'").all() as
    { contentId: string; itemKey: string; voice: string }[]) castVoice.set(`${r.contentId}|${r.itemKey}`, r.voice);
  const taken = new Map<string, string>();
  for (const r of db.prepare("select id, contentId, itemKey from AudioAsset where contentType='story-word'").all() as
    { id: string; contentId: string; itemKey: string }[]) taken.set(`${r.contentId}|${r.itemKey}`, r.id);
  db.close();

  const problems: string[] = [];
  const ok: Record<string, unknown>[] = [];
  const counters = { sha: 0, key: 0, token: 0, voice: 0, mp3: 0, duration: 0, free: 0 };
  let trailingSpaceOnly = 0;

  console.log(`в папке файлов: ${all.length}; одобрено владельцем и идёт на прод: ${plan.length} (${[...APPROVED].sort((a, b) => a - b).join(", ")})`);
  const dropped = all.filter((r) => !APPROVED.has(r.n));
  for (const d of dropped) console.log(`  НЕ идёт на прод: №${d.n} ${d.file} — решение владельца`);

  for (const row of plan) {
    const say = (m: string) => problems.push(`№${row.n} ${row.file}: ${m}`);
    const [storyId, itemKey0] = row.key.split(" ");

    // подсадка «место»: строке списка подсовывается СОСЕДНЯЯ
    const listedRow = PLANT === "место"
      ? listed[(listed.findIndex((l) => l.n === row.n) + 1) % listed.length]
      : listed.find((l) => l.n === row.n);
    if (!listedRow) { say("нет строки в список.txt"); continue; }

    // 1. те ли это байты
    const path = join(LISTEN, row.file);
    if (!existsSync(path)) { say("файла нет на диске"); continue; }
    let bytes = readFileSync(path);
    if (PLANT === "байты") bytes = Buffer.concat([bytes, Buffer.from([0])]);   // только в памяти
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== listedRow.sha256) { say(`sha256 файла ${sha.slice(0, 12)}… ≠ ${listedRow.sha256.slice(0, 12)}… из список.txt`); continue; }
    counters.sha++;

    // 2. то же ли это место
    if (`${listedRow.storyId} ${listedRow.itemKey}` !== row.key) {
      say(`ключ списка «${listedRow.storyId} ${listedRow.itemKey}» ≠ ключу плана «${row.key}»`); continue;
    }
    if (sha !== row.sha) { say("sha256 плана разошёлся со списком"); continue; }
    counters.key++;

    // 3. место по тексту рассказа со снимка прода
    const story = stories.get(storyId);
    if (!story) { say(`нет рассказа ${storyId} на проде`); continue; }
    const [pIdx, sIdx, tIdx] = itemKey0.split("-").map(Number);
    const item = buildStoryQueue(splitStoryParagraphs(story.text))
      .find((q) => q.paragraphIndex === pIdx && q.sentenceIndex === sIdx);
    if (!item) { say(`нет предложения ${pIdx}-${sIdx}`); continue; }
    const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
    const tokenText = tokens[tIdx];
    if (!tokenText || !CYRILLIC_WORD_REGEX.test(tokenText)) { say(`токен №${tIdx} не слово`); continue; }
    if (tokenText.toLowerCase() !== row.word.toLowerCase()) { say(`токен «${tokenText}» ≠ слову «${row.word}»`); continue; }
    if (storyWordItemKey({ paragraphIndex: pIdx, sentenceIndex: sIdx, tokenIndex: tIdx }) !== itemKey0) { say("itemKey не пересчитался"); continue; }
    // Текст предложения сверяется БЕЗ хвостовых пробелов, и это названо, а
    // не спрятано: очередь рассказа отдаёт предложение с пробелом-разделителем
    // на конце, а `folder.py` 7.175 клал в папку уже `strip()`нутый текст.
    // Расхождение ровно в этом пробеле — не расхождение текста; любое
    // другое отличие остаётся отказом.
    if (item.text.trimEnd() !== row.sentence.trimEnd()) { say("текст предложения на проде разошёлся с планом"); continue; }
    if (item.text !== row.sentence) trailingSpaceOnly++;
    if (!isHomograph(tokenText)) { say(`слово «${tokenText}» не омограф`); continue; }
    counters.token++;

    // 4. голос — каста своего предложения, из КОЛОНКИ, а не из журнала
    let cast = castVoice.get(`${storyId}|${pIdx}-${sIdx}`);
    if (PLANT === "голос") cast = cast === "onyx" ? "shimmer" : "onyx";
    if (!cast) { say("у предложения нет записанного голоса каста"); continue; }
    if (row.voice !== cast) { say(`голос файла «${row.voice}» ≠ голосу каста «${cast}»`); continue; }
    counters.voice++;

    // 5. параметры банка
    const p = probe(path);
    if (p.codec !== "mp3" || p.sampleRate !== 24000 || p.channels !== 1 || p.bitRate !== 128000) {
      say(`параметры ${p.codec} ${p.sampleRate} Гц ${p.channels} кан. ${p.bitRate} бит/с ≠ параметрам банка`); continue;
    }
    counters.mp3++;

    // 6. односторонний допуск длительности против исходного WAV
    const wav = wavFor(row, storyId);
    if (!wav) { say("исходный WAV вырезки не найден однозначно"); continue; }
    const deltaMs = Math.round((p.seconds - wavSeconds(wav)) * 1000);
    if (deltaMs < 0 || deltaMs > MAX_DELTA_MS) { say(`длительность mp3 − WAV = ${deltaMs} мс вне допуска 0…${MAX_DELTA_MS}`); continue; }
    counters.duration++;

    // 7. ключ на проде свободен
    const busy = taken.get(`${storyId}|${itemKey0}`);
    if (busy) { say(`ключ уже занят строкой ${busy} — вставка отказана`); continue; }
    counters.free++;

    ok.push({
      n: row.n, op: "insert", file: row.file, storyId, title: story.title,
      paragraphIndex: pIdx, sentenceIndex: sIdx, tokenIndex: tIdx, itemKey: itemKey0,
      word: tokenText, voice: cast, method: row.metod, auditRejected: row.rejected,
      sha256: sha, bytes: bytes.byteLength, seconds: Math.round(p.seconds * 1000) / 1000, deltaMs,
      model: row.metod === "Б" ? "cut-from-story-audio" : "gpt-4o-mini-tts-cut",
    });
  }

  console.log(`  1. sha256 = прослушанным байтам       ${counters.sha} из ${plan.length}`);
  console.log(`  2. ключ места списка = ключу плана    ${counters.key} из ${plan.length}`);
  console.log(`  3. место по тексту с прода, омограф   ${counters.token} из ${plan.length}`);
  console.log(`  4. голос = касту своего предложения   ${counters.voice} из ${plan.length}`);
  console.log(`  5. параметры банка (mp3/24k/моно/128) ${counters.mp3} из ${plan.length}`);
  console.log(`  6. допуск длительности 0…96 мс        ${counters.duration} из ${plan.length}`);
  console.log(`  7. ключ на проде свободен             ${counters.free} из ${plan.length}`);
  console.log(`     из них текст предложения совпал только после снятия хвостового пробела: ${trailingSpaceOnly}`);
  console.log(`ИТОГ: к записи ${ok.length}, проблем ${problems.length}`);
  for (const p of problems) console.log(`  ${p}`);

  const deltas = ok.map((r) => r.deltaMs as number);
  if (deltas.length) console.log(`расхождение длительности: от +${Math.min(...deltas)} до +${Math.max(...deltas)} мс`);
  console.log(`различных sha256: ${new Set(ok.map((r) => r.sha256)).size} из ${ok.length}`);
  console.log(`различных мест: ${new Set(ok.map((r) => `${r.storyId}|${r.itemKey}`)).size} из ${ok.length}`);
  const voices = ok.reduce((m, r) => m.set(r.voice as string, (m.get(r.voice as string) ?? 0) + 1), new Map<string, number>());
  console.log(`голоса: ${[...voices].sort().map(([v, n]) => `${v} ${n}`).join(", ")}`);

  if (PLANT) {
    console.log(`ПОДСАДКА «${PLANT}»: отвергнуто ${problems.length} из ${plan.length}, принято ${ok.length}`);
    return ok.length === 0 ? 0 : 1;
  }
  if (OUT && problems.length === 0) {
    writeFileSync(OUT, JSON.stringify(ok, null, 1), "utf-8");
    console.log(`план записан: ${OUT}`);
  }
  return problems.length === 0 && ok.length === APPROVED.size ? 0 : 1;
}

process.exit(main());
