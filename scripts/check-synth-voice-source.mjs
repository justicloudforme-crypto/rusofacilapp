/**
 * Сторож долга 136: СКРИПТЫ СИНТЕЗА БЕРУТ ГОЛОС ТОЛЬКО ИЗ КОЛОНКИ
 * `AudioAsset.voice` ПРЕДЛОЖЕНИЯ. Журнальный ярлык голоса входом не
 * принимается.
 *
 * ЧТО СЛУЧИЛОСЬ 11.09.2026 (7.171 → 7.174). `part3_metodA.py` заказывал
 * запись голосом `p["voice"]`, где `p` — место, собранное из ЖУРНАЛА
 * повторной вырезки 7.168. Ярлык журнала — снимок каста на момент его
 * написания, а не истина: у 16 предложений из 904 он разошёлся с
 * колонкой. Шесть записей вышли не тем голосом, каким читается само
 * предложение, и на прод не поехали. Голос слова обязан совпадать с
 * голосом предложения, иначе в рассказе, который читает женщина, одно
 * слово скажет мужчина.
 *
 * ДВА УТВЕРЖДЕНИЯ, оба статические:
 *  1. у каждого вызова синтеза (`asr.tts(`, `.tts(`) второй аргумент —
 *     ГОЛОС — не читается из записи журнала (`X["voice"]`, `X.voice`,
 *     `X['voice']`), кроме случая, когда значение получено из базы
 *     (`cast_voice(`, `castVoice`, `voiceFromDb`);
 *  2. скрипт, который читает журнал вырезки (`homo*.jsonl`,
 *     `places-217.json`, `*-настоящий.jsonl`) И синтезирует, обязан
 *     нести пометку-источник голоса `ГОЛОС ИЗ БАЗЫ` — чтобы разъехаться
 *     молча было нельзя.
 *
 * ИСКЛЮЧЕНИЕ РОВНО ОДНО И ЗАКРЕПЛЕНО ИМЕНЕМ: `prisma/run-7171/part3_metodA.py`
 * — тот самый скрипт, которым долг 136 и заведён. Он оставлен как есть
 * (история захода не переписывается), но обязан нести пометку
 * `ДОЛГ 136: ГОЛОС ОТСЮДА БРАТЬ НЕЛЬЗЯ`, иначе сторож ругается. Любой
 * НОВЫЙ скрипт исключением не является.
 *
 *   node scripts/check-synth-voice-source.mjs [--plant]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROOTS = ["prisma", "scripts"];
const KNOWN_BAD = "prisma/run-7171/part3_metodA.py";
const BAD_MARK = "ДОЛГ 136: ГОЛОС ОТСЮДА БРАТЬ НЕЛЬЗЯ";
const DB_SOURCES = /cast_voice\(|castVoice|voiceFromDb|voiceByCast/;
const JOURNAL_FILES = /homo\d*\.jsonl|places-217\.json|-настоящий\.jsonl|written-\d+\.jsonl/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === "snapshots" || e.startsWith(".")) continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(py|ts|mjs|js)$/.test(e)) out.push(p);
  }
  return out;
}

const SELF = "scripts/check-synth-voice-source.mjs";
// Сам сторож несёт образцы обоих написаний (в подсадке и в тексте правила)
// и потому себя не проверяет: иначе он падал бы на собственном примере.
function main() {
const files = ROOTS.flatMap((r) => walk(r)).filter((f) => f.replace(/\\/g, "/") !== SELF);
const problems = [];
let synthFiles = 0, calls = 0;

for (const f of files) {
  let src = readFileSync(f, "utf-8");
  const rel = f.replace(/\\/g, "/");
  // Определение самого синтезатора (asr.py) проверять незачем: там голос — параметр.
  const isDefinition = /def tts\(/.test(src) && !/\basr\.tts\(/.test(src);
  if (PLANT && rel.endsWith("prisma/run-7175/synth_cut.py")) {
    src = src.replace("asr.tts(marked, used, mp3raw)", 'asr.tts(marked, p["voice"], mp3raw)');
  }
  const hits = [...src.matchAll(/(?:asr\.)?\btts\(\s*([^)]*?)\)/g)].filter(() => !isDefinition);
  if (!hits.length) continue;
  synthFiles += 1;
  for (const h of hits) {
    calls += 1;
    const args = h[1].split(",").map((s) => s.trim());
    const voiceArg = args[1] ?? "";
    const fromJournal = /\[["']voice["']\]|\.voice\b/.test(voiceArg);
    if (fromJournal && !DB_SOURCES.test(voiceArg)) {
      if (rel === KNOWN_BAD) continue; // известный источник долга 136, см. ниже
      problems.push(`${rel}: голос синтеза берётся из записи журнала — «${voiceArg}». Источник голоса один: колонка AudioAsset.voice предложения.`);
    }
  }
  if (JOURNAL_FILES.test(src) && rel !== KNOWN_BAD && !DB_SOURCES.test(src)) {
    problems.push(`${rel}: скрипт читает журнал вырезки и синтезирует, но нигде не берёт голос из базы (нет ${DB_SOURCES}).`);
  }
}

// Известный источник долга 136 обязан быть подписан.
const bad = readFileSync(KNOWN_BAD, "utf-8");
if (!bad.includes(BAD_MARK)) {
  problems.push(`${KNOWN_BAD}: нет пометки «${BAD_MARK}» — скрипт, которым заведён долг 136, обязан сам о себе это говорить.`);
}

console.log(`[check:synth-voice-source] файлов просмотрено ${files.length}, синтезирующих ${synthFiles}, вызовов синтеза ${calls}`);
console.log(`[check:synth-voice-source] исключение ровно одно и закреплено именем: ${KNOWN_BAD}`);
if (PLANT) {
  const ok = problems.some((p) => p.includes("run-7175/synth_cut.py"));
  console.log(ok
    ? `ПОДСАДКА ПОЙМАНА: ${problems.find((p) => p.includes("run-7175/synth_cut.py"))}`
    : "ПОДСАДКА НЕ ПОЙМАНА — сторож бесполезен");
  return ok ? 0 : 1;
}
if (problems.length) {
  console.log(`НАРУШЕНИЙ ${problems.length}:`);
  for (const p of problems) console.log(`  ${p}`);
  return 1;
}
console.log("PASS — голос синтеза берётся только из колонки AudioAsset.voice (контроль — --plant)");
return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts и инцидент 29.08.2026).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
