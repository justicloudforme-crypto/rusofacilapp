/**
 * «COGER» НЕТ В ТОМ, ЧТО УЧЕНИК ЗАУЧИВАЕТ — СТОРОЖ (решение владельца
 * 27.11.2026, заход 7.317).
 *
 * ПОЧЕМУ. Ученики — в Мексике, а там «coger» — грубое слово. Перевод
 * «tomar, coger» в карточке «брать», в уроке b1-15 и в экзамене B1
 * заучивается дословно, и ученик понесёт его в живую речь. Замена — по
 * смыслу, на мексиканском испанском: «agarrar», «tomar», а где «взять с
 * собой» — «llevar» («No te lleves el paraguas»). Перепись всех мест —
 * заход 7.316; правка — 7.317 (`prisma/run-7317/fix-coger.mjs` для того, что
 * лежит только в базе).
 *
 * ЧТО СМОТРИТ.
 *   Файлы под git (всегда):
 *     · уроки        — src/lib/lessons/content.json (все строки);
 *     · картинки слайдов уроков — src/lib/lessons/slideIcons.ts;
 *     · экзамены     — src/lib/exams/content.json (все строки);
 *     · свой банк переводов — src/lib/word-bank-batches/batch-*.json
 *       (только поле `translation`: в `source` записана история, откуда
 *       слово, — там старый перевод карточки упомянут намеренно);
 *     · копии для ботов — bots/data/{vocabulary,idioms,exam_questions,glossary}.json.
 *   База (`--db=<файл>`, по умолчанию `dev.db` в корне, если есть):
 *     · карточки     — FlashcardCard.translationEs, exampleEs;
 *     · идиомы       — Idiom.literalTranslation, spanishEquivalent,
 *                      explanation, contextExampleEs;
 *     · подсказки игр — WordGamePuzzle.words[].clue;
 *     · уроки и экзамены, перекрытые в базе, — Lesson.contentJson,
 *       Exam.contentJson (страница берёт строку базы раньше content.json).
 *   Боевую базу сторож не читает; её сверяет скрипт правки после записи.
 *
 * ЧЕГО НЕ СМОТРИТ (решение владельца — отдельно): переводы рассказов
 * (`Story.translationEs`, prisma/stories-data.ts) и субтитры медиа
 * (src/lib/media/mediaData.json, MediaOverride).
 *
 * ФОРМЫ. Всё, что начинается с «cog-»/«cóg-» (coger, coge, cogió, cogí,
 * cogerlo, cógelo, cogida…), и «coj-» с окончаниями глагола (cojo, coja,
 * cojas, cojan, cojamos, cojáis). НЕ формы: recoger, escoger, acoger,
 * encoger (перед «co» стоит буква), cojear/cojeaba/cojeó («хромать»),
 * cognitivo/cognado, cogote, cogollo.
 *
 *   node scripts/check-no-coger.mjs              # файлы + dev.db
 *   node scripts/check-no-coger.mjs --db=/путь/к/копии.db
 *   node scripts/check-no-coger.mjs --plant      # позитивный контроль
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Одно написание правила на весь проект: им же пользуется скрипт правки. */
export const COGER_RE = /(^|[^\p{L}])(c[oó]g(?!n|oll|ot|ul)\p{L}*|c[oó]j(?:o|a|as|an|amos|áis)(?!\p{L}))/giu;

/** Все найденные формы в строке (пустой массив — чисто). */
export function findCoger(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  return [...text.matchAll(COGER_RE)].map((m) => m[2]);
}

const JSON_ALL = [
  ["уроки", "src/lib/lessons/content.json"],
  ["экзамены", "src/lib/exams/content.json"],
  ["бот: карточки", "bots/data/vocabulary.json"],
  ["бот: идиомы", "bots/data/idioms.json"],
  ["бот: экзамены", "bots/data/exam_questions.json"],
  ["бот: глоссарий", "bots/data/glossary.json"],
];
const RAW = [["картинки слайдов", "src/lib/lessons/slideIcons.ts"]];
const BATCH_DIR = "src/lib/word-bank-batches";

function walkStrings(value, at, out) {
  if (typeof value === "string") out.push([at, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${at}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walkStrings(v, `${at}.${k}`, out);
  return out;
}

function scanFiles(root) {
  const hits = [];
  let scanned = 0;
  for (const [kind, rel] of JSON_ALL) {
    const file = path.join(root, rel);
    if (!existsSync(file)) throw new Error(`ОТКАЗ: нет файла ${rel} — сторож смотрел бы мимо`);
    for (const [at, s] of walkStrings(JSON.parse(readFileSync(file, "utf-8")), "", [])) {
      scanned++;
      for (const form of findCoger(s)) hits.push({ kind, where: `${rel}${at}`, form, text: s });
    }
  }
  for (const [kind, rel] of RAW) {
    const file = path.join(root, rel);
    if (!existsSync(file)) throw new Error(`ОТКАЗ: нет файла ${rel}`);
    readFileSync(file, "utf-8").split("\n").forEach((line, i) => {
      scanned++;
      for (const form of findCoger(line)) hits.push({ kind, where: `${rel}:${i + 1}`, form, text: line.trim() });
    });
  }
  const batches = readdirSync(path.join(root, BATCH_DIR)).filter((f) => /^batch-\d+\.json$/.test(f));
  if (batches.length === 0) throw new Error(`ОТКАЗ: в ${BATCH_DIR} нет партий`);
  for (const f of batches) {
    const rel = `${BATCH_DIR}/${f}`;
    for (const e of JSON.parse(readFileSync(path.join(root, rel), "utf-8")).entries) {
      scanned++;
      for (const form of findCoger(e.translation)) hits.push({ kind: "свой банк", where: `${rel} «${e.word}»`, form, text: e.translation });
    }
  }
  return { hits, scanned };
}

const DB_FIELDS = [
  ["карточки", `SELECT id, russian AS label, translationEs, exampleEs FROM "FlashcardCard"`, ["translationEs", "exampleEs"]],
  ["идиомы", `SELECT id, phrase AS label, literalTranslation, spanishEquivalent, explanation, contextExampleEs FROM "Idiom"`, ["literalTranslation", "spanishEquivalent", "explanation", "contextExampleEs"]],
  ["уроки в базе", `SELECT id, level || '-' || lessonSlug AS label, contentJson FROM "Lesson"`, ["contentJson"]],
  ["экзамены в базе", `SELECT id, level || '/' || examSlug AS label, contentJson FROM "Exam"`, ["contentJson"]],
];

async function scanDb(dbFile) {
  const db = createClient({ url: pathToFileURL(dbFile).href });
  const hits = [];
  const rows = {};
  try {
    for (const [kind, sql, fields] of DB_FIELDS) {
      const res = await db.execute(sql);
      rows[kind] = res.rows.length;
      for (const r of res.rows) for (const f of fields) for (const form of findCoger(r[f])) hits.push({ kind, where: `${r.id} «${r.label}» .${f}`, form, text: String(r[f]) });
    }
    const puzzles = await db.execute(`SELECT id, type, words FROM "WordGamePuzzle"`);
    rows["подсказки игр"] = puzzles.rows.length;
    for (const p of puzzles.rows) {
      let words;
      try { words = JSON.parse(String(p.words)); } catch { throw new Error(`ОТКАЗ: WordGamePuzzle ${p.id} — words не JSON`); }
      for (const w of words) for (const form of findCoger(w.clue)) hits.push({ kind: "подсказки игр", where: `${p.id} (${p.type}) «${w.word}»`, form, text: w.clue });
    }
  } finally {
    db.close();
  }
  return { hits, rows };
}

export async function runCheck({ root = ROOT, dbFile } = {}) {
  const files = scanFiles(root);
  const defaultDb = path.join(root, "dev.db");
  const target = dbFile ?? (existsSync(defaultDb) ? defaultDb : null);
  const db = target ? await scanDb(target) : null;
  return { files, db, target, hits: [...files.hits, ...(db?.hits ?? [])] };
}

function report(result) {
  console.log(`файлы: строк просмотрено ${result.files.scanned}`);
  if (result.db) console.log(`база ${path.relative(process.cwd(), result.target) || result.target}: ${Object.entries(result.db.rows).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  else console.log("база: dev.db нет — проверены только файлы");
  for (const h of result.hits) console.log(`  «${h.form}» — ${h.kind}: ${h.where}\n      ${h.text.slice(0, 160)}`);
}

// ---------------------------------------------------------------- подмены
const SCHEMA = [
  `CREATE TABLE "FlashcardCard" (id TEXT, russian TEXT, translationEs TEXT, exampleEs TEXT)`,
  `CREATE TABLE "Idiom" (id TEXT, phrase TEXT, literalTranslation TEXT, spanishEquivalent TEXT, explanation TEXT, contextExampleEs TEXT)`,
  `CREATE TABLE "Lesson" (id TEXT, level TEXT, lessonSlug TEXT, contentJson TEXT)`,
  `CREATE TABLE "Exam" (id TEXT, level TEXT, examSlug TEXT, contentJson TEXT)`,
  `CREATE TABLE "WordGamePuzzle" (id TEXT, type TEXT, words TEXT)`,
];
const CLEAN_ROWS = [
  [`INSERT INTO "FlashcardCard" VALUES ('c1','брать','tomar, agarrar (imperfectivo)','Ella siempre lleva un paraguas consigo.')`],
  [`INSERT INTO "FlashcardCard" VALUES ('c2','ковылять','cojear / andar renqueando','El anciano cojeaba y luego cojeó hasta el banco.')`],
  [`INSERT INTO "FlashcardCard" VALUES ('c3','выбрать','elegir, escoger','Recoge, acoge, encoge; terapia cognitiva; el cogote.')`],
  [`INSERT INTO "Idiom" VALUES ('i1','x','y','No hay por dónde agarrarlo','para que agarre el ritmo','Hoy no hay por dónde agarrarlo al jefe.')`],
  [`INSERT INTO "Lesson" VALUES ('l1','b1','15','{"translation":"tomar, agarrar"}')`],
  [`INSERT INTO "Exam" VALUES ('e1','b1','b1-exam-2','{"right":"tomar, agarrar"}')`],
  [`INSERT INTO "WordGamePuzzle" VALUES ('p1','CROSSWORD','[{"word":"взять","clue":"tomar, agarrar (una vez, perfectivo)"}]')`],
];

async function makeDb(dir, extra) {
  const file = path.join(dir, "plant.db");
  rmSync(file, { force: true });
  const db = createClient({ url: pathToFileURL(file).href });
  for (const s of SCHEMA) await db.execute(s);
  for (const [s] of CLEAN_ROWS) await db.execute(s);
  if (extra) await db.execute(extra);
  db.close();
  return file;
}

function copyTree(dir) {
  for (const [, rel] of [...JSON_ALL, ...RAW]) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    cpSync(path.join(ROOT, rel), path.join(dir, rel));
  }
  cpSync(path.join(ROOT, BATCH_DIR), path.join(dir, BATCH_DIR), { recursive: true });
}

function editJson(dir, rel, fn) {
  const file = path.join(dir, rel);
  const data = JSON.parse(readFileSync(file, "utf-8"));
  fn(data);
  writeFileSync(file, JSON.stringify(data));
}

function editRaw(dir, rel, from, to) {
  const file = path.join(dir, rel);
  const s = readFileSync(file, "utf-8");
  if (!s.includes(from)) throw new Error(`подмена не легла: в ${rel} нет «${from}»`);
  writeFileSync(file, s.replace(from, to));
}

/** Первая строка, где есть `needle`, — заменить (по живому файлу, не по выдуманному). */
function replaceFirstString(value, needle, to) {
  let done = false;
  const visit = (v) => {
    if (done) return v;
    if (typeof v === "string" && v.includes(needle)) { done = true; return v.replace(needle, to); }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = visit(v[k]); return v; }
    return v;
  };
  const out = visit(value);
  if (!done) throw new Error(`подмена не легла: нет строки с «${needle}»`);
  return out;
}

const PLANTS = [
  ["урок b1-15: «tomar, coger» вернулось", (d) => editJson(d, "src/lib/lessons/content.json", (j) => replaceFirstString(j, "tomar, agarrar", "tomar, coger"))],
  ["урок b2-14: «No cojas el paraguas» вернулось", (d) => editJson(d, "src/lib/lessons/content.json", (j) => replaceFirstString(j, "No te lleves el paraguas", "No cojas el paraguas"))],
  ["урок: «Cógelo» с заглавной и ударением", (d) => editJson(d, "src/lib/lessons/content.json", (j) => replaceFirstString(j, "atrapar, cachar", "atrapar, Cógelo"))],
  ["картинка слайда: «tomar / coger»", (d) => editRaw(d, "src/lib/lessons/slideIcons.ts", `content: "tomar / agarrar"`, `content: "tomar / coger"`)],
  ["экзамен B1: «tomar, cogió»", (d) => editJson(d, "src/lib/exams/content.json", (j) => replaceFirstString(j, "tomar, agarrar", "tomar, cogió"))],
  ["свой банк: перевод «toma, coge»", (d) => editJson(d, `${BATCH_DIR}/batch-03.json`, (j) => { const e = j.entries.find((x) => x.word === "берёт"); if (!e) throw new Error("нет «берёт»"); e.translation = "toma, coge"; })],
  ["бот: пример карточки «Coge una cesta»", (d) => editJson(d, "bots/data/vocabulary.json", (j) => replaceFirstString(j, "Toma una cesta", "Coge una cesta"))],
  ["бот: идиома «cogerlo»", (d) => editJson(d, "bots/data/idioms.json", (j) => replaceFirstString(j, "por dónde agarrarlo", "por dónde cogerlo"))],
];
const DB_PLANTS = [
  ["база: перевод карточки «tomar, coger»", `INSERT INTO "FlashcardCard" VALUES ('x','взять','tomar, coger (una vez, perfectivo)','Tomó el libro.')`],
  ["база: пример карточки «Se cogió la baja»", `INSERT INTO "FlashcardCard" VALUES ('x','больничный','baja por enfermedad','Se cogió la baja por enfermedad.')`],
  ["база: идиома «coja el ritmo»", `INSERT INTO "Idiom" VALUES ('x','y','z','w','para que coja el ritmo','v')`],
  ["база: подсказка игры «tomar, coger»", `INSERT INTO "WordGamePuzzle" VALUES ('x','WORD_SEARCH','[{"word":"брать","clue":"tomar, coger (imperfectivo)"}]')`],
  ["база: урок, перекрытый в базе, «cojan»", `INSERT INTO "Lesson" VALUES ('x','b2','14','{"t":"No cojan el paraguas"}')`],
  ["база: экзамен в базе «cogí»", `INSERT INTO "Exam" VALUES ('x','b1','b1-exam-2','{"right":"cogí"}')`],
];

async function plant() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "no-coger-"));
  let failed = 0;
  try {
    copyTree(dir);
    const cleanDb = await makeDb(dir);
    const base = await runCheck({ root: dir, dbFile: cleanDb });
    if (base.hits.length !== 0) { console.log(`ОТКАЗ: чистая копия уже красная (${base.hits.length}) — подмены ничего не докажут`); report(base); return 1; }
    console.log("чистая копия (с recoger/escoger/cojear/cognitiva/cogote в базе): зелёная");
    for (const [name, fn] of PLANTS) {
      copyTree(dir);
      fn(dir);
      const r = await runCheck({ root: dir, dbFile: cleanDb });
      const ok = r.hits.length > 0;
      if (!ok) failed++;
      console.log(`${ok ? "красный, как надо" : "ПРОПУЩЕНО"} — ${name}${ok ? ` («${r.hits[0].form}»)` : ""}`);
    }
    copyTree(dir);
    for (const [name, sql] of DB_PLANTS) {
      const file = await makeDb(dir, sql);
      const r = await runCheck({ root: dir, dbFile: file });
      const ok = r.hits.length > 0;
      if (!ok) failed++;
      console.log(`${ok ? "красный, как надо" : "ПРОПУЩЕНО"} — ${name}${ok ? ` («${r.hits[0].form}»)` : ""}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const total = PLANTS.length + DB_PLANTS.length;
  console.log(`подмен красных: ${total - failed} из ${total}`);
  return failed === 0 ? 0 : 1;
}

async function main() {
  if (process.argv.includes("--plant")) return plant();
  const dbArg = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
  const result = await runCheck({ dbFile: dbArg ? path.resolve(dbArg) : undefined });
  report(result);
  if (result.hits.length > 0) {
    console.log(`\nНАЙДЕНО «coger» в учебном содержимом: ${result.hits.length}. В Мексике это грубое слово — заменить по смыслу (agarrar, tomar, llevar), решение владельца 27.11.2026 (PROGRESS.md 3.16).`);
    return 1;
  }
  console.log("«coger» в учебном содержимом нет");
  return 0;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
