/**
 * Заход 7.174, часть 1: сверка ДО записи.
 *
 * Отвечает на один вопрос: можно ли записывать на прод ровно те 220
 * файлов, которые слушал владелец, — и каждое ли из них ляжет на СВОЁ
 * место.
 *
 * Источник правды о том, ЧТО слушал владелец, — `список.txt` из папки
 * `~/rusofacil-listen/7.171/на-слух/`, а не наш план: в нём напечатан
 * sha256 каждого файла, и владелец слушал ровно эти байты. План
 * (`listen-folder.json`) сверяется С НИМ, а не наоборот.
 *
 * Семь утверждений на каждую строку, и ни одно не необязательное:
 *   1. sha256 файла на диске равен sha256 из `список.txt` (правило
 *      захода: на прод уезжают РОВНО прослушанные байты);
 *   2. ключ места из `список.txt` совпадает с ключом плана;
 *   3. `itemKey` пересчитан из номера СЛОВА в номер ТОКЕНА по тексту
 *      рассказа со свежего снимка прода, и токен по этому номеру равен
 *      нужному слову (класс долга 104 — номер слова и номер токена
 *      смешивать нельзя);
 *   4. голос файла — голос каста ЭТОГО ЖЕ предложения (строка
 *      `AudioAsset` `contentType='story'`, `itemKey='<абзац>-<предложение>'`);
 *   5. параметры mp3 — параметры банка: mp3, 24 000 Гц, моно, 128 kbps;
 *   6. допуск длительности односторонний, как в 7.170:
 *      0 мс ≤ (mp3 − WAV) ≤ 96 мс (четыре кадра MPEG-2 Layer III);
 *   7. занятость ключа на проде: у 216 мест долга 131 ключ обязан быть
 *      СВОБОДЕН (вставка), у 4 мест долга 134 — ЗАНЯТ (замена `audioUrl`).
 *
 * Подсадки (`--plant=место` и `--plant=байты`) — обязательная половина:
 *   * «место» отдаёт файлу СОСЕДНЮЮ строку списка (чужое место);
 *   * «байты» дописывает один байт к файлу, не трогая список.
 * Обе обязаны быть отвергнуты; ни одна не пишет ничего на диск.
 *
 *   npx tsx prisma/run-7174/verify-plan.ts --listen=<папка> --folder=<listen-folder.json> \
 *     --snapshot=prisma/snapshots/prod-latest.db --out=<plan.json> [--plant=место|байты]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { storyWordItemKey, isHomograph } from "@/lib/story-word-pick";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const LISTEN = arg("listen")!;
const FOLDER = arg("folder")!;
const SNAPSHOT = arg("snapshot") ?? "prisma/snapshots/prod-latest.db";
const OUT = arg("out");
const PLANT = arg("plant") ?? "";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;
/** Четыре кадра MPEG-2 Layer III на 24 кГц = 96 мс (паспорт озвучки, раздел 6). */
const MAX_DELTA_MS = 96;

interface FolderRow {
  n: number; folder: string; storyId: string; title: string;
  paragraphIndex: number; sentenceIndex: number; wordIndex: number; tokenIndex: number;
  itemKey: string; word: string; sentence: string; voice: string;
  method: string; auditRejected: boolean; file: string; sha256: string;
  bytes: number; mp3Seconds: number; wavSeconds: number; deltaMs: number;
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

function main(): number {
  // --- что слушал владелец -------------------------------------------
  const listText = readFileSync(join(LISTEN, "список.txt"), "utf-8").split("\n");
  const listed = listText.filter((l) => /^\d+\t/.test(l)).map((l) => {
    const [n, file, story, stressed, key, method, sha, sentence] = l.split("\t");
    const [storyId, itemKey] = key.split(" ");
    return { n: Number(n), file, story, stressed, storyId, itemKey, method, sha256: sha, sentence };
  });
  const plan = JSON.parse(readFileSync(FOLDER, "utf-8")) as FolderRow[];

  // --- тексты рассказов и озвучка со СВЕЖЕГО снимка прода ------------
  const db = new Database(SNAPSHOT, { readonly: true });
  const stories = new Map<string, { title: string; text: string }>();
  for (const r of db.prepare("select id, title, text from Story").all() as { id: string; title: string; text: string }[]) {
    stories.set(r.id, { title: r.title, text: r.text });
  }
  const castVoice = new Map<string, string>();
  for (const r of db.prepare("select contentId, itemKey, voice from AudioAsset where contentType='story'").all() as
    { contentId: string; itemKey: string; voice: string }[]) castVoice.set(`${r.contentId}|${r.itemKey}`, r.voice);
  const taken = new Map<string, { id: string; audioUrl: string; durationSeconds: number | null }>();
  for (const r of db.prepare("select id, contentId, itemKey, audioUrl, durationSeconds from AudioAsset where contentType='story-word'").all() as
    { id: string; contentId: string; itemKey: string; audioUrl: string; durationSeconds: number | null }[]) {
    taken.set(`${r.contentId}|${r.itemKey}`, { id: r.id, audioUrl: r.audioUrl, durationSeconds: r.durationSeconds });
  }
  db.close();

  const problems: string[] = [];
  /** Места, ПРИДЕРЖАННЫЕ до решения владельца: файл годен, но нарушает
   *  инвариант «голос вырезки = голос каста предложения». Не проблема
   *  сверки и не отказ — отдельное число в отчёте. */
  const held: { n: number; file: string; storyId: string; itemKey: string; word: string; why: string }[] = [];
  /** Расхождения ЯРЛЫКА журнала с кастом там, где звук вырезан из того же файла. */
  const labelOnly: string[] = [];
  const ok: Record<string, unknown>[] = [];
  const counters = { sha: 0, key: 0, token: 0, voice: 0, mp3: 0, duration: 0, insert: 0, replace: 0 };

  for (const row of plan) {
    const say = (m: string) => problems.push(`№${row.n} ${row.file}: ${m}`);

    // подсадка «место»: строке списка подсовывается СОСЕДНЯЯ (чужое место)
    const listedRow = PLANT === "место"
      ? listed[(row.n - 1 + 1) % listed.length]
      : listed.find((l) => l.n === row.n);
    if (!listedRow) { say("нет строки в список.txt"); continue; }

    // 1. те ли это байты, которые слушал владелец
    const path = join(LISTEN, row.file);
    if (!existsSync(path)) { say("файла нет на диске"); continue; }
    let bytes = readFileSync(path);
    if (PLANT === "байты") bytes = Buffer.concat([bytes, Buffer.from([0])]);   // подсадка — только в памяти
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== listedRow.sha256) { say(`sha256 файла ${sha.slice(0, 12)}… ≠ ${listedRow.sha256.slice(0, 12)}… из список.txt`); continue; }
    counters.sha++;

    // 2. то же ли это место
    if (listedRow.storyId !== row.storyId || listedRow.itemKey !== row.itemKey) {
      say(`ключ списка ${listedRow.storyId} ${listedRow.itemKey} ≠ ключу плана ${row.storyId} ${row.itemKey}`); continue;
    }
    if (sha !== row.sha256) { say("sha256 плана разошёлся со списком"); continue; }
    counters.key++;

    // 3. номер СЛОВА → номер ТОКЕНА по тексту рассказа с прода
    const story = stories.get(row.storyId);
    if (!story) { say(`нет рассказа ${row.storyId} на проде`); continue; }
    const item = buildStoryQueue(splitStoryParagraphs(story.text))
      .find((q) => q.paragraphIndex === row.paragraphIndex && q.sentenceIndex === row.sentenceIndex);
    if (!item) { say(`нет предложения ${row.paragraphIndex}-${row.sentenceIndex}`); continue; }
    const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
    const wordPositions: number[] = [];
    tokens.forEach((t, i) => { if (CYRILLIC_WORD_REGEX.test(t)) wordPositions.push(i); });
    const tokenIndex = wordPositions[row.wordIndex];
    if (tokenIndex === undefined) { say(`нет слова №${row.wordIndex} в предложении`); continue; }
    if (tokenIndex !== row.tokenIndex) { say(`номер токена ${tokenIndex} ≠ плановому ${row.tokenIndex}`); continue; }
    const tokenText = tokens[tokenIndex];
    if (tokenText.toLowerCase() !== row.word.toLowerCase()) { say(`токен «${tokenText}» ≠ слову «${row.word}»`); continue; }
    const itemKey = storyWordItemKey({ paragraphIndex: row.paragraphIndex, sentenceIndex: row.sentenceIndex, tokenIndex });
    if (itemKey !== row.itemKey) { say(`itemKey «${itemKey}» ≠ плановому «${row.itemKey}»`); continue; }
    if (item.text !== row.sentence) { say("текст предложения на проде разошёлся с планом"); continue; }
    if (!isHomograph(tokenText)) { say(`слово «${tokenText}» не омограф`); continue; }
    counters.token++;

    // 4. голос — каста своего предложения
    //
    // Для вырезок (`134` и `Б`) голос НЕ сверяется с ярлыком журнала, а
    // берётся у самой строки `AudioAsset` предложения: звук вырезан из
    // того же файла, значит голос у него тот же по построению, а ярлык в
    // журнале 7.168 — просто подпись. Для метода `А` наоборот: ярлык
    // журнала — это то, чем запись была ЗАКАЗАНА синтезатору, то есть
    // настоящий голос файла; расхождение с кастом там — дефект файла, и
    // такое место придерживается, а не пишется (правило паспорта: клип
    // рассказа не имеет права звучать чужим голосом).
    const voice = castVoice.get(`${row.storyId}|${row.paragraphIndex}-${row.sentenceIndex}`);
    if (!voice) { say("у предложения нет записанного голоса каста"); continue; }
    if (row.folder === "А" && row.voice && row.voice !== voice) {
      held.push({ n: row.n, file: row.file, storyId: row.storyId, itemKey: row.itemKey, word: row.word,
        why: `записана голосом «${row.voice}», а каст предложения — «${voice}»` });
      continue;
    }
    if (row.folder !== "А" && row.voice && row.voice !== voice) labelOnly.push(`№${row.n} ${row.file}: ярлык журнала «${row.voice}», каст «${voice}» — вырезка из того же файла, голос тот же`);
    counters.voice++;

    // 5. параметры банка
    const p = probe(path);
    if (p.codec !== "mp3" || p.sampleRate !== 24000 || p.channels !== 1 || p.bitRate !== 128000) {
      say(`параметры ${p.codec} ${p.sampleRate} Гц ${p.channels} кан. ${p.bitRate} бит/с ≠ параметрам банка`); continue;
    }
    counters.mp3++;

    // 6. односторонний допуск длительности
    const deltaMs = Math.round((p.seconds - row.wavSeconds) * 1000);
    if (deltaMs < 0 || deltaMs > MAX_DELTA_MS) { say(`длительность mp3 − WAV = ${deltaMs} мс вне допуска 0…${MAX_DELTA_MS}`); continue; }
    counters.duration++;

    // 7. занятость ключа на проде
    const prod = taken.get(`${row.storyId}|${row.itemKey}`);
    const wantReplace = row.folder === "134";
    if (wantReplace && !prod) { say("замена долга 134, а строки на проде нет"); continue; }
    if (!wantReplace && prod) { say(`ключ уже занят строкой ${prod.id} — вставка отказана`); continue; }
    if (wantReplace) counters.replace++; else counters.insert++;

    ok.push({
      n: row.n, op: wantReplace ? "replace" : "insert", rowId: prod?.id ?? null, wasUrl: prod?.audioUrl ?? null,
      folder: row.folder, file: row.file, storyId: row.storyId, title: story.title,
      paragraphIndex: row.paragraphIndex, sentenceIndex: row.sentenceIndex,
      tokenIndex, itemKey, word: tokenText, voice, sha256: sha, bytes: bytes.byteLength,
      seconds: Math.round(p.seconds * 1000) / 1000, deltaMs, method: row.method, auditRejected: row.auditRejected,
    });
  }

  console.log(`строк в список.txt: ${listed.length}; строк в плане: ${plan.length}`);
  console.log(`  1. sha256 = прослушанным байтам      ${counters.sha} из ${plan.length}`);
  console.log(`  2. ключ места списка = ключу плана   ${counters.key} из ${plan.length}`);
  console.log(`  3. слово↔токен по тексту с прода     ${counters.token} из ${plan.length}`);
  console.log(`  4. голос каста своего предложения    ${counters.voice} из ${plan.length}`);
  console.log(`  5. параметры банка (mp3/24k/моно/128) ${counters.mp3} из ${plan.length}`);
  console.log(`  6. допуск длительности 0…96 мс       ${counters.duration} из ${plan.length}`);
  console.log(`ИТОГ: вставок ${counters.insert}, замен audioUrl ${counters.replace}, придержано ${held.length}, проблем ${problems.length}`);
  if (labelOnly.length) {
    console.log(`ярлык журнала 7.168 разошёлся с кастом там, где звук ВЫРЕЗАН из того же файла (голос от этого не меняется): ${labelOnly.length}`);
    for (const l of labelOnly) console.log(`  ${l}`);
  }
  if (held.length) {
    console.log(`ПРИДЕРЖАНО (метод А записан чужим голосом, на прод не пойдёт):`);
    for (const h of held) console.log(`  №${h.n} ${h.file} — ${h.storyId} ${h.itemKey} «${h.word}»: ${h.why}`);
  }
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
  if (problems.length > 10) console.log(`  … и ещё ${problems.length - 10}`);

  const deltas = ok.map((r) => r.deltaMs as number);
  if (deltas.length) console.log(`расхождение длительности: от +${Math.min(...deltas)} до +${Math.max(...deltas)} мс`);
  console.log(`различных sha256: ${new Set(ok.map((r) => r.sha256)).size} из ${ok.length}`);
  console.log(`различных мест: ${new Set(ok.map((r) => `${r.storyId}|${r.itemKey}`)).size} из ${ok.length}`);

  if (PLANT) {
    const caught = problems.length;
    console.log(`ПОДСАДКА «${PLANT}»: отвергнуто ${caught} из ${plan.length}, принято ${ok.length}`);
    return ok.length === 0 ? 0 : 1;
  }
  if (OUT && problems.length === 0) {
    writeFileSync(OUT, JSON.stringify(ok, null, 1), "utf-8");
    writeFileSync(OUT.replace(/\.json$/, "-held.json"), JSON.stringify(held, null, 1), "utf-8");
    console.log(`план записан: ${OUT}`);
  }
  return problems.length === 0 && counters.insert + held.length === 216 && counters.replace === 4 ? 0 : 1;
}

process.exit(main());
