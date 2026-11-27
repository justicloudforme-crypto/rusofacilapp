/**
 * Заход 7.317 (задача 2, решение владельца 27.11.2026): убрать «coger» из
 * того, что ученик заучивает и что лежит ТОЛЬКО В БАЗЕ. В Мексике «coger» —
 * грубое слово. Файлы репозитория (content.json уроков и экзаменов,
 * картинка слайда, копии для ботов) поправлены в том же PR; сторож —
 * `npm run check:no-coger`.
 *
 * ЧТО МЕНЯЕТСЯ — только точные куски текста из таблицы REPLACEMENTS ниже, и
 * только в этих полях:
 *   · FlashcardCard.translationEs, exampleEs   — карточки «брать», «взять»
 *     (перевод), «корзина», «больничный», «примерочная кабина» (пример);
 *   · Idiom.spanishEquivalent, explanation, contextExampleEs — «На кривой
 *     козе не подъедешь», «Взять на буксир»;
 *   · WordGamePuzzle.words — ТОЛЬКО подсказки (`clue`) у «брать» и «взять»
 *     (подсказка скопирована из карточки при создании игры; правка
 *     карточки её не меняет); UPDATE строго по id (правило 7.4: удаление
 *     каскадом стёрло бы прогресс);
 *   · Lesson.contentJson — уроки b1-15 и b2-14, перекрытые в базе (страница
 *     берёт строку базы раньше content.json, поэтому правки файла мало);
 *   · Exam.contentJson — если экзамен B1 перекрыт в базе (локально таблица
 *     пуста; на проде — что найдётся).
 * Переводы рассказов и субтитры медиа НЕ трогаются (решение владельца —
 * отдельно). Озвучка не затронута: испанский текст не озвучен, ключ клипа —
 * id строки, а не текст (золотое правило).
 *
 * ПРЕДОХРАНИТЕЛИ.
 *   · После замен в каждом изменённом поле не должно остаться ни одной формы
 *     «coger» (`findCoger` из сторожа). Осталась — значит, на проде есть
 *     место, которого не было в переписи 7.316: ОТКАЗ всего прогона, ничего
 *     не пишется, место печатается — дописать замену по смыслу руками.
 *   · Найдена форма «coger» в поле, к которому ни одна замена не подошла, —
 *     тот же ОТКАЗ.
 *   · JSON (`words`, `contentJson`) после замен обязан разбираться, и в
 *     `words` у каждой записи меняется только `clue`.
 *
 * ПОРЯДОК (раздел 3.2 PROGRESS.md):
 *   1. без флага — сухой прогон: печатает каждое место «было → стало»;
 *   2. `--apply` — снимок всех затронутых строк «до» в ~/rusofacil-backups/
 *      (вне репозитория), ОДНА транзакция, каждая UPDATE с условием
 *      id + старое значение поля (чужую или уже поправленную строку не
 *      тронет), проверка rowsAffected = 1 на каждой, сверка «после»
 *      (повторное чтение тех же id: «coger» 0). Повторный запуск —
 *      «писать нечего, 0 строк».
 *
 * База: `--local` — `dev.db` в корне; `--db=<файл>` — любая копия (так скрипт
 * проверялся на копии dev.db до/после); без них — боевая через
 * `scripts/turso-env.mjs` (ключ в окружении той же строки или
 * `--env=<файл вне папки проекта>`). Правило 264: после записи в прод — тем
 * же вызовом с `--local`.
 *
 *   node prisma/run-7317/fix-coger.mjs --local                    # сухой прогон, dev.db
 *   node prisma/run-7317/fix-coger.mjs --env=~/.config/rusofacilapp/turso.env            # сухой, БОЕВАЯ
 *   node prisma/run-7317/fix-coger.mjs --env=~/.config/rusofacilapp/turso.env --apply    # запись, БОЕВАЯ
 *   node prisma/run-7317/fix-coger.mjs --local --apply            # правило 264
 *
 * Цена чтения боевой базы — один полный проход по пяти таблицам, ≈10 000
 * строк (FlashcardCard 5771, WordGamePuzzle 3277, Idiom 771, Lesson 120,
 * Exam ≈12); печатается до первого запроса.
 * Кеши: карточки и поиск — до 5 минут, уроки и экзамены — до 1 минуты.
 * Откат: снимок «до» — те же UPDATE в обратную сторону.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { readTursoEnv } from "../../scripts/turso-env.mjs";
import { findCoger } from "../../scripts/check-no-coger.mjs";

/** Было → стало. Порядок важен только для читателя: куски не пересекаются. */
export const REPLACEMENTS = [
  // карточки «брать» и «взять», их подсказки в играх, урок b1-15 (словарь,
  // сопоставление), экзамен B1 (сопоставление)
  ["tomar, coger", "tomar, agarrar"],
  // урок b1-15, абзац грамматики
  ["tomar/coger", "tomar/agarrar"],
  // урок b1-15, «ловить / поймать»: «cachar» — «поймать на лету» по-мексикански;
  // не «agarrar», чтобы в сопоставлении не было двух ответов с одним глаголом
  ["atrapar, coger (al vuelo)", "atrapar, cachar (al vuelo)"],
  // урок b2-14 «Не бери зонт…» — по смыслу «не бери с собой»
  ["No cojas el paraguas", "No te lleves el paraguas"],
  // примеры карточек
  ["Coge una cesta", "Toma una cesta"],
  ["Se cogió la baja", "Se tomó la baja"],
  ["Cogió tres vestidos", "Agarró tres vestidos"],
  // идиомы
  ["por dónde cogerlo", "por dónde agarrarlo"],
  ["para que coja el ritmo", "para que agarre el ritmo"],
];

const TABLES = [
  { table: "FlashcardCard", label: "russian", fields: ["translationEs", "exampleEs"] },
  { table: "Idiom", label: "phrase", fields: ["spanishEquivalent", "explanation", "contextExampleEs"] },
  { table: "Lesson", label: "level || '-' || lessonSlug", fields: ["contentJson"], json: true },
  { table: "Exam", label: "level || '/' || examSlug", fields: ["contentJson"], json: true },
  { table: "WordGamePuzzle", label: "type || ' ' || level", fields: ["words"], json: true, cluesOnly: true },
];

export function applyReplacements(text) {
  let out = text;
  const used = [];
  for (const [from, to] of REPLACEMENTS) {
    if (out.includes(from)) {
      used.push([from, to, out.split(from).length - 1]);
      out = out.split(from).join(to);
    }
  }
  return { out, used };
}

function checkWords(before, after, id) {
  const a = JSON.parse(before);
  const b = JSON.parse(after);
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) throw new Error(`ОТКАЗ: ${id} — words сменил форму`);
  a.forEach((x, i) => {
    const { clue: c1, ...rest1 } = x;
    const { clue: c2, ...rest2 } = b[i];
    if (JSON.stringify(rest1) !== JSON.stringify(rest2)) throw new Error(`ОТКАЗ: ${id} — замена задела не только подсказку (запись ${i})`);
    if (c1 !== c2 && !["брать", "взять"].includes(x.word)) throw new Error(`ОТКАЗ: ${id} — менялась подсказка слова «${x.word}», ожидались только «брать»/«взять»`);
  });
}

/** План правки: что и где поменяется. Бросает ОТКАЗ при любом сомнении. */
export async function buildPlan(db) {
  const plan = [];
  const problems = [];
  for (const t of TABLES) {
    const cols = t.fields.map((f) => `"${f}"`).join(", ");
    const res = await db.execute(`SELECT id, ${t.label} AS label, ${cols} FROM "${t.table}"`);
    for (const row of res.rows) {
      for (const field of t.fields) {
        const before = row[field];
        if (typeof before !== "string" || findCoger(before).length === 0) continue;
        const { out, used } = applyReplacements(before);
        const left = findCoger(out);
        if (used.length === 0 || left.length > 0) {
          problems.push(`${t.table} ${row.id} «${row.label}» .${field}: осталось ${left.join(", ") || findCoger(before).join(", ")} — нет замены по смыслу`);
          continue;
        }
        if (t.json) JSON.parse(out);
        if (t.cluesOnly) checkWords(before, out, row.id);
        plan.push({ table: t.table, id: String(row.id), label: String(row.label), field, before, after: out, used });
      }
    }
  }
  return { plan, problems };
}

function snippet(text, from) {
  const i = text.indexOf(from);
  if (i < 0) return text.slice(0, 120);
  const s = Math.max(0, i - 40);
  return `${s > 0 ? "…" : ""}${text.slice(s, i + from.length + 40)}${i + from.length + 40 < text.length ? "…" : ""}`;
}

function printPlan(plan) {
  const byTable = {};
  for (const p of plan) {
    byTable[p.table] = (byTable[p.table] ?? 0) + 1;
    for (const [from, to, n] of p.used) console.log(`  ${p.table} ${p.id} «${p.label}» .${p.field}: «${from}» → «${to}»${n > 1 ? ` ×${n}` : ""}\n      было: ${snippet(p.before, from)}`);
  }
  const rows = new Set(plan.map((p) => `${p.table}:${p.id}`)).size;
  console.log(`полей к правке: ${plan.length}, строк: ${rows} (полей по таблицам: ${Object.entries(byTable).map(([k, n]) => `${k} ${n}`).join(", ") || "—"})`);
}

async function connect() {
  const dbArg = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
  if (dbArg) return { conn: { url: pathToFileURL(path.resolve(dbArg)).href }, where: `копия ${dbArg}`, prod: false };
  if (process.argv.includes("--local")) return { conn: { url: "file:./dev.db" }, where: "локальная dev.db", prod: false };
  const e = readTursoEnv();
  return { conn: { url: e.url, authToken: e.authToken }, where: "БОЕВАЯ база", prod: true };
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  const { conn, where, prod } = await connect();
  if (prod) console.log("БОЕВАЯ база: чтение — один проход по FlashcardCard, Idiom, Lesson, Exam, WordGamePuzzle, ≈10 000 просмотренных строк");
  const db = createClient(conn);
  try {
    const { plan, problems } = await buildPlan(db);
    console.log(`${where}.`);
    printPlan(plan);
    if (problems.length > 0) {
      console.log(`\nОТКАЗ: ${problems.length} мест(а) с «coger», для которых нет замены, — ничего не записано:`);
      for (const p of problems) console.log(`  ${p}`);
      return 1;
    }
    if (plan.length === 0) { console.log("«coger» нет — писать нечего (0 строк)"); return 0; }
    if (!APPLY) { console.log("сухой прогон — ничего не записано (запись: --apply)"); return 0; }

    const dir = path.join(os.homedir(), "rusofacil-backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `7317-coger-${prod ? "prod" : "local"}-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), where, rows: plan.map(({ table, id, field, before }) => ({ table, id, field, before })) }, null, 2));
    console.log(`снимок «до»: ${file}`);

    const tx = await db.transaction("write");
    try {
      for (const p of plan) {
        const res = await tx.execute({ sql: `UPDATE "${p.table}" SET "${p.field}" = ? WHERE id = ? AND "${p.field}" = ?`, args: [p.after, p.id, p.before] });
        if (res.rowsAffected !== 1) throw new Error(`ОТКАЗ: ${p.table} ${p.id}.${p.field} — rowsAffected = ${res.rowsAffected}, ожидалась 1 (строку правили между чтением и записью?)`);
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
    console.log(`записано строк: ${plan.length}, транзакция закрыта`);

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
