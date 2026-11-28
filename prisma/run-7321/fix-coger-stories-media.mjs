/**
 * Заход 7.321 (задание владельца 28.11.2026): «coger» → «agarrar» в том, что
 * осталось после 7.319, — переводы рассказов и субтитры медиа в БАЗЕ.
 * В Мексике «coger» — грубое слово (правило 3.16, заход 7.317).
 *
 * ПРАВИЛО ЗАМЕНЫ (то же, что в 7.319/7.320): любая форма «coger» → та же
 * форма «agarrar», заглавная буква и местоимения на конце сохраняются
 * («coge» → «agarra», «Cojan» → «Agarren», «cógeme» → «agárrame»,
 * «cogido» → «agarrado»). recoger, escoger, encogerse, acoger, sobrecoger,
 * cojear не трогаются. Функция одна на проект — `replaceCoger` из
 * `src/lib/no-coger-filter.ts` (ею же фильтруется внешний переводчик);
 * «нашлось ли coger» — `findCoger` сторожа `check:no-coger`.
 *
 * ЧТО МЕНЯЕТСЯ — только эти поля:
 *   · Story.translationEs, description, titleEs — перевод рассказа (перепись
 *     7.317/7.319: 4 рассказа, по одному месту);
 *   · MediaOverride.subtitles (JSON строк субтитров), sourceNoteAppend —
 *     перепись 7.319: 11 строк, 16 мест.
 * Русский текст рассказа (`Story.text`) и русские строки субтитров (`ru`) не
 * трогаются: замена касается только латиницы. Озвучка не затронута: испанский
 * перевод не озвучен, ключ клипа — id строки (золотое правило).
 *
 * ПРЕДОХРАНИТЕЛИ — ОТКАЗ всего прогона, ничего не пишется:
 *   · после замены в поле осталась форма «coger» (`findCoger` ≠ 0);
 *   · найдено «cojo/coja/cojos/cojas» рядом с «хром…» в той же строке
 *     субтитров — это может быть прилагательное «хромой», а не глагол;
 *   · `subtitles` после замены не разбирается как JSON, сменилось число
 *     строк или поменялось что-то кроме поля `es` (время, id, `ru`).
 *
 * ПОРЯДОК (раздел 3.2 PROGRESS.md):
 *   1. без `--apply` — сухой прогон: каждое место «было → стало», ничего не пишет;
 *   2. `--apply` — снимок полных значений «до» и «после» в ~/rusofacil-backups/
 *      (вне репозитория), ОДНА транзакция, каждая UPDATE с условием
 *      id + старое значение поля, проверка rowsAffected = 1, сверка «после»
 *      повторным чтением. Повтор — «писать нечего, 0 строк».
 *   3. Откат — `--rollback=<снимок>` (сухо) и `--rollback=<снимок> --apply`:
 *      те же UPDATE в обратную сторону, только там, где значение всё ещё
 *      равно записанному этим скриптом (чужую правку после записи не тронет).
 *
 * База: `--local` — `dev.db` в корне; `--db=<файл>` — копия; без них — боевая
 * через `scripts/turso-env.mjs` (окружение или `--env=<файл вне папки
 * проекта>`; в zsh писать `--env=$HOME/…`: `~` после `=` не раскрывается).
 * Правило 264: после записи в прод — тем же вызовом с `--local`.
 *
 *   node prisma/run-7321/fix-coger-stories-media.mjs --local                     # сухой, dev.db
 *   node prisma/run-7321/fix-coger-stories-media.mjs --env=$HOME/.config/rusofacilapp/turso.env          # сухой, БОЕВАЯ
 *   node prisma/run-7321/fix-coger-stories-media.mjs --env=$HOME/.config/rusofacilapp/turso.env --apply  # запись, БОЕВАЯ
 *   node prisma/run-7321/fix-coger-stories-media.mjs --local --apply             # правило 264
 *
 * Цена чтения боевой базы — один проход по Story (325) и MediaOverride (≈275),
 * ≈600 строк; печатается до первого запроса.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { readTursoEnv } from "../../scripts/turso-env.mjs";
import { findCoger } from "../../scripts/check-no-coger.mjs";
import { replaceCoger } from "../../src/lib/no-coger-filter.ts";

export const TABLES = [
  { table: "Story", label: "title", fields: ["translationEs", "description", "titleEs"] },
  { table: "MediaOverride", label: "mediaId", fields: ["subtitles", "sourceNoteAppend"] },
];

const LAME = /(^|[^\p{L}])c[oó]j(?:o|a|os|as)(?!\p{L})/iu;

/** Строки субтитров: меняться может только `es`. */
function checkSubtitles(before, after, where) {
  const a = JSON.parse(before);
  const b = JSON.parse(after);
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) throw new Error(`ОТКАЗ: ${where} — субтитры сменили число строк`);
  a.forEach((line, i) => {
    const { es: e1, ...rest1 } = line;
    const { es: e2, ...rest2 } = b[i];
    if (JSON.stringify(rest1) !== JSON.stringify(rest2)) throw new Error(`ОТКАЗ: ${where} — строка ${i}: поменялось не только «es»`);
    if (e1 !== e2 && LAME.test(String(e1)) && /хром/i.test(String(line.ru ?? ""))) {
      throw new Error(`ОТКАЗ: ${where} — строка ${i}: «cojo/coja» рядом с «хром…» — возможно, прилагательное; решать руками`);
    }
  });
}

/** План: что и где поменяется. Бросает ОТКАЗ при любом сомнении. */
export async function buildPlan(db) {
  const plan = [];
  for (const t of TABLES) {
    const cols = t.fields.map((f) => `"${f}"`).join(", ");
    const res = await db.execute(`SELECT id, "${t.label}" AS label, ${cols} FROM "${t.table}"`);
    for (const row of res.rows) {
      for (const field of t.fields) {
        const before = row[field];
        if (typeof before !== "string") continue;
        const forms = findCoger(before);
        if (forms.length === 0) continue;
        const after = replaceCoger(before);
        const where = `${t.table} ${row.id} «${row.label}» .${field}`;
        const left = findCoger(after);
        if (left.length > 0) throw new Error(`ОТКАЗ: ${where} — после замены осталось ${left.join(", ")}`);
        if (field === "subtitles") checkSubtitles(before, after, where);
        plan.push({ table: t.table, id: String(row.id), label: String(row.label), field, before, after, forms });
      }
    }
  }
  return plan;
}

/** Пары «было → стало» по словам — для печати и отчёта. */
export function changedWords(before, after) {
  const a = before.match(/\p{L}+|[^\p{L}]+/gu) ?? [];
  const b = after.match(/\p{L}+|[^\p{L}]+/gu) ?? [];
  const out = [];
  if (a.length !== b.length) return [["(не сопоставить по словам)", ""]];
  a.forEach((w, i) => { if (w !== b[i]) out.push([w, b[i], before.slice(0, a.slice(0, i).join("").length)]); });
  return out;
}

function printPlan(plan) {
  let places = 0;
  for (const p of plan) {
    for (const [from, to, head] of changedWords(p.before, p.after)) {
      places++;
      const ctx = (head ?? "").slice(-50).replace(/\s+/g, " ");
      console.log(`  ${p.table} «${p.label}» .${p.field}: «${from}» → «${to}»   …${ctx}${from}…`);
    }
  }
  const rows = new Set(plan.map((p) => `${p.table}:${p.id}`));
  const byTable = {};
  for (const r of rows) byTable[r.split(":")[0]] = (byTable[r.split(":")[0]] ?? 0) + 1;
  console.log(`мест: ${places}, полей: ${plan.length}, строк: ${rows.size} (${Object.entries(byTable).map(([k, n]) => `${k} ${n}`).join(", ") || "—"})`);
}

async function connect() {
  const dbArg = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
  if (dbArg) return { conn: { url: pathToFileURL(path.resolve(dbArg)).href }, where: `копия ${dbArg}`, prod: false };
  if (process.argv.includes("--local")) return { conn: { url: "file:./dev.db" }, where: "локальная dev.db", prod: false };
  const e = readTursoEnv();
  return { conn: { url: e.url, authToken: e.authToken }, where: "БОЕВАЯ база", prod: true };
}

async function rollback(db, file, apply) {
  const snap = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`откат по снимку ${file} (снят ${snap.takenAt}, ${snap.where}), полей: ${snap.rows.length}`);
  const todo = [];
  for (const r of snap.rows) {
    const cur = (await db.execute({ sql: `SELECT "${r.field}" AS v FROM "${r.table}" WHERE id = ?`, args: [r.id] })).rows[0];
    if (!cur) console.log(`  строки нет: ${r.table} ${r.id}`);
    else if (cur.v === r.before) console.log(`  уже как было: ${r.table} ${r.id}.${r.field}`);
    else if (cur.v !== r.after) console.log(`  ПРАВИЛИ ПОСЛЕ ЗАПИСИ — не трогаю: ${r.table} ${r.id}.${r.field}`);
    else todo.push(r);
  }
  console.log(`к откату: ${todo.length}`);
  if (!apply || todo.length === 0) { if (!apply) console.log("сухой откат — ничего не записано (запись: --apply)"); return 0; }
  const tx = await db.transaction("write");
  try {
    for (const r of todo) {
      const res = await tx.execute({ sql: `UPDATE "${r.table}" SET "${r.field}" = ? WHERE id = ? AND "${r.field}" = ?`, args: [r.before, r.id, r.after] });
      if (res.rowsAffected !== 1) throw new Error(`ОТКАЗ отката: ${r.table} ${r.id}.${r.field} — rowsAffected ${res.rowsAffected}`);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  console.log(`откачено полей: ${todo.length}, транзакция закрыта`);
  return 0;
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  const rollbackFile = process.argv.find((a) => a.startsWith("--rollback="))?.slice(11);
  const { conn, where, prod } = await connect();
  if (prod) console.log("БОЕВАЯ база: чтение — один проход по Story (325) и MediaOverride (≈275), ≈600 строк");
  const db = createClient(conn);
  try {
    if (rollbackFile) return await rollback(db, rollbackFile, APPLY);
    const plan = await buildPlan(db);
    console.log(`${where}.`);
    printPlan(plan);
    if (plan.length === 0) { console.log("«coger» в рассказах и субтитрах нет — писать нечего (0 строк)"); return 0; }
    if (!APPLY) { console.log("сухой прогон — ничего не записано (запись: --apply)"); return 0; }

    const dir = path.join(os.homedir(), "rusofacil-backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `7321-coger-stories-media-${prod ? "prod" : "local"}-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), where, rows: plan.map(({ table, id, label, field, before, after }) => ({ table, id, label, field, before, after })) }, null, 2), { mode: 0o600 });
    console.log(`снимок «до» (и откат по нему): ${file}`);

    const tx = await db.transaction("write");
    try {
      for (const p of plan) {
        const res = await tx.execute({ sql: `UPDATE "${p.table}" SET "${p.field}" = ? WHERE id = ? AND "${p.field}" = ?`, args: [p.after, p.id, p.before] });
        if (res.rowsAffected !== 1) throw new Error(`ОТКАЗ: ${p.table} ${p.id}.${p.field} — rowsAffected = ${res.rowsAffected}, ожидалась 1`);
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    console.log(`записано полей: ${plan.length}, транзакция закрыта`);

    let bad = 0;
    for (const p of plan) {
      const r = (await db.execute({ sql: `SELECT "${p.field}" AS v FROM "${p.table}" WHERE id = ?`, args: [p.id] })).rows[0];
      if (!r || r.v !== p.after || findCoger(String(r.v)).length > 0) { bad++; console.log(`  СВЕРКА НЕ СОШЛАСЬ: ${p.table} ${p.id}.${p.field}`); }
    }
    console.log(bad === 0 ? `сверка «после»: ${plan.length} из ${plan.length} — новое значение, «coger» 0` : `сверка «после»: расхождений ${bad}`);
    return bad === 0 ? 0 : 1;
  } finally {
    db.close();
  }
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
