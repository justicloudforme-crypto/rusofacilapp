/**
 * ПОЛНЫЙ БАНК ФИЛВОРДОВ ФИКСТУРОЙ — долг 64, вариант А (решение владельца
 * 17.10.2026, заход 7.272).
 *
 * Зачем. `check:word-search` (солвер + координаты + геометрия по каждому
 * WORD_SEARCH) стоял исключением из CI: в базе CI восемь строк фикстуры
 * e2e, и прогон по ним был бы вакуумно зелёным (правило 4.1). Боевого
 * ключа в CI нет и не будет (раздел 3.19 п. 4). Поэтому банк прода лежит в
 * репозитории снимком `prisma/fixtures/word-search-bank.json.gz`, и CI
 * поднимает из него ОТДЕЛЬНУЮ локальную базу — не ту, что у e2e.
 *
 * Три режима:
 *
 *   --export [--out=…]      снять банк с прода (только SELECT, ключ из
 *                           окружения или --env=<файл вне проекта>);
 *                           пишет фикстуру. Это и есть команда обновления
 *                           после любой записи пазлов в прод:
 *     TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:word-search-fixture:export
 *
 *   --seed --db=<файл>      поднять из фикстуры новую SQLite-базу (файла не
 *                           должно быть) с таблицей WordGamePuzzle по
 *                           schema.prisma; отпечаток и хэш содержимого
 *                           сверяются ДО записи — битая фикстура = отказ.
 *
 *   --check [--plant]       засев во временную папку + `prisma/check-word-search.ts`
 *                           по ней. С --plant — двусторонний контроль:
 *                           чистая фикстура обязана дать зелёный, фикстура с
 *                           подсаженной поломкой (буква в сетке одного пазла
 *                           подменена) — красный, и красный именно по этому
 *                           пазлу. Команда зелёная, только если оба исхода
 *                           такие.
 *
 * Ни один режим ничего не делает при импорте (`isEntryPoint`).
 */
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { createClient } from "@libsql/client";
import { bankFingerprint } from "../src/lib/word-games/bank-fingerprint";
import { isEntryPoint } from "../src/lib/entry-point";
import { PROJECT_ROOT, readTursoEnv } from "./turso-env.mjs";

export const FIXTURE_PATH = "prisma/fixtures/word-search-bank.json.gz";
export const COLUMNS = ["id", "type", "level", "sequence", "curved", "premiumOnly", "topic", "gridData", "words", "createdAt", "updatedAt"];
const TABLE = "WordGamePuzzle";

/** Хэш содержимого: строки по id, все колонки. Ловит правку фикстуры в
 *  обход `--export` (отпечаток банка смотрит только на id). */
export function contentSha256(rows) {
  const sorted = [...rows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

function rowObjects(fixture) {
  return fixture.rows.map((r) => Object.fromEntries(fixture.columns.map((c, i) => [c, r[i]])));
}

export function readFixture(file = path.join(PROJECT_ROOT, FIXTURE_PATH)) {
  const fixture = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const problems = [];
  if (JSON.stringify(fixture.columns) !== JSON.stringify(COLUMNS)) problems.push(`колонки ${JSON.stringify(fixture.columns)} ≠ ${JSON.stringify(COLUMNS)}`);
  if (!Array.isArray(fixture.rows) || fixture.rows.length === 0) problems.push("в фикстуре 0 строк — это не «0 проблем»");
  else {
    const objs = rowObjects(fixture);
    if (objs.some((o) => o.type !== "WORD_SEARCH")) problems.push("в фикстуре есть строки не WORD_SEARCH");
    const fp = bankFingerprint(objs);
    if (fp.puzzles !== fixture.fingerprint?.puzzles || fp.idsSha256 !== fixture.fingerprint?.idsSha256) {
      problems.push(`отпечаток банка не сходится с записанным (${fp.puzzles} строк, ${fp.idsSha256.slice(0, 12)}…)`);
    }
    if (contentSha256(fixture.rows) !== fixture.contentSha256) problems.push("хэш содержимого не сходится — фикстуру правили в обход --export");
  }
  return { fixture, problems };
}

/** Подсадка: в первом по id прямом (не ★) пазле вторая буква первого слова
 *  в сетке подменяется. Слово больше не читается по записанным координатам. */
export function plantDefect(fixture) {
  const col = (name) => fixture.columns.indexOf(name);
  const rows = fixture.rows.map((r) => [...r]);
  const order = rows.map((r, i) => [r[col("id")], i]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const STEP = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1], NE: [-1, 1], NW: [-1, -1], SE: [1, 1], SW: [1, -1] };
  for (const [, i] of order) {
    const r = rows[i];
    if (r[col("curved")] === true || r[col("curved")] === 1) continue;
    const grid = JSON.parse(r[col("gridData")]);
    const word = JSON.parse(r[col("words")])[0];
    const step = STEP[word?.direction];
    if (!step || !word.word || word.word.length < 2) continue;
    const y = word.row + step[0];
    const x = word.col + step[1];
    const was = grid.grid[y][x];
    grid.grid[y][x] = was === "ъ" ? "ы" : "ъ";
    r[col("gridData")] = JSON.stringify(grid);
    return { rows, key: `WORD_SEARCH/${r[col("level")]}/${r[col("sequence")]}`, id: r[col("id")], cell: `${y},${x} «${was}»→«${grid.grid[y][x]}»` };
  }
  throw new Error("подсадить некуда: в фикстуре нет прямого пазла");
}

/** DDL таблицы и её индексов — из schema.prisma, а не переписанный руками. */
function tableDdl() {
  const script = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const create = script.match(new RegExp(`CREATE TABLE "${TABLE}" \\([\\s\\S]*?\\n\\);`))?.[0];
  if (!create) throw new Error(`в выводе prisma migrate diff нет CREATE TABLE "${TABLE}"`);
  const indexes = [...script.matchAll(new RegExp(`CREATE (?:UNIQUE )?INDEX [^\\n]* ON "${TABLE}"[^\\n]*;`, "g"))].map((m) => m[0]);
  return [create, ...indexes];
}

export async function seed(dbFile, rows) {
  if (existsSync(dbFile)) throw new Error(`ОТКАЗ: ${dbFile} уже существует — засев только в новую базу`);
  const db = createClient({ url: `file:${dbFile}` });
  try {
    for (const stmt of tableDdl()) await db.execute(stmt);
    const placeholders = COLUMNS.map(() => "?").join(", ");
    const sql = `INSERT INTO "${TABLE}" (${COLUMNS.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
    const curved = COLUMNS.indexOf("curved");
    const premium = COLUMNS.indexOf("premiumOnly");
    const args = rows.map((r) => r.map((v, i) => (i === curved || i === premium ? (v === true || v === 1 || v === "1" ? 1 : 0) : v)));
    await db.batch(args.map((a) => ({ sql, args: a })), "write");
    const n = Number((await db.execute(`SELECT count(*) AS n FROM "${TABLE}"`)).rows[0].n);
    if (n !== rows.length) throw new Error(`засеяно ${n} строк из ${rows.length}`);
    return n;
  } finally {
    db.close();
  }
}

async function exportFromProd(out) {
  const { url, authToken } = readTursoEnv();
  const host = url.replace(/^libsql:\/\//, "https://");
  let rowsRead = 0;
  async function select(sql, args = []) {
    if (!/^SELECT /.test(sql)) throw new Error("выгрузка делает только SELECT");
    const res = await fetch(`${host}/v2/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ type: "execute", stmt: { sql, args: args.map((v) => ({ type: "text", value: String(v) })) } }, { type: "close" }],
      }),
    });
    const r = (await res.json()).results[0];
    if (r.type === "error") throw new Error(JSON.stringify(r.error));
    const R = r.response.result;
    rowsRead += R.rows_read ?? 0;
    if ((R.rows_written ?? 0) > 0) throw new Error("выгрузка обязана быть только чтением, а база сообщила о записи");
    return R.rows.map((row) => row.map((v) => (v.type === "null" ? null : v.type === "integer" ? Number(v.value) : v.value)));
  }
  const total = Number((await select(`SELECT count(*) FROM "${TABLE}" WHERE type = 'WORD_SEARCH'`))[0][0]);
  console.log(`На проде WORD_SEARCH: ${total}. Листаю по id страницами по 500.`);
  const rows = [];
  let after = "";
  for (;;) {
    const page = await select(
      `SELECT ${COLUMNS.map((c) => `"${c}"`).join(", ")} FROM "${TABLE}" WHERE type = 'WORD_SEARCH' AND id > ? ORDER BY id LIMIT 500`,
      [after],
    );
    if (page.length === 0) break;
    rows.push(...page);
    after = page[page.length - 1][0];
  }
  if (rows.length !== total) throw new Error(`выгружено ${rows.length} из ${total}`);
  const curved = COLUMNS.indexOf("curved");
  const premium = COLUMNS.indexOf("premiumOnly");
  for (const r of rows) {
    r[curved] = r[curved] === 1;
    r[premium] = r[premium] === 1;
  }
  const objs = rows.map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])));
  const fixture = {
    about: "Банк WORD_SEARCH прода для check:word-search в CI (долг 64). Обновлять только npm run db:word-search-fixture:export.",
    source: "prod",
    takenAt: new Date().toISOString().slice(0, 10),
    columns: COLUMNS,
    fingerprint: bankFingerprint(objs),
    contentSha256: contentSha256(rows),
    rows,
  };
  const gz = gzipSync(Buffer.from(JSON.stringify(fixture)), { level: 9 });
  writeFileSync(out, gz);
  console.log(`Записано ${out}: ${rows.length} строк, ${gz.length.toLocaleString("ru-RU")} байт gzip; прочитано строк базой ${rowsRead}.`);
}

function runCheck(dbFile) {
  const env = { ...process.env, DATABASE_URL: `file:${dbFile}` };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  const tsx = path.join(PROJECT_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const r = spawnSync(process.execPath, [tsx, "prisma/check-word-search.ts"], { cwd: PROJECT_ROOT, env, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

async function check(plant) {
  const { fixture, problems } = readFixture();
  if (problems.length) {
    for (const p of problems) console.error(`ФИКСТУРА: ${p}`);
    return 1;
  }
  console.log(`Фикстура ${FIXTURE_PATH}: ${fixture.rows.length} пазлов, снята ${fixture.takenAt} с ${fixture.source}, ${statSync(path.join(PROJECT_ROOT, FIXTURE_PATH)).size.toLocaleString("ru-RU")} байт.`);
  const dir = mkdtempSync(path.join(os.tmpdir(), "rf-word-search-"));
  try {
    const cleanDb = path.join(dir, "clean.db");
    await seed(cleanDb, fixture.rows);
    const clean = runCheck(cleanDb);
    if (!plant) {
      process.stdout.write(clean.out);
      return clean.code ?? 1;
    }
    const planted = plantDefect(fixture);
    const plantedDb = path.join(dir, "planted.db");
    await seed(plantedDb, planted.rows);
    const red = runCheck(plantedDb);
    const named = red.out.includes(`${planted.key}:`);
    console.log(`чистая фикстура: код ${clean.code} (обязан 0)`);
    console.log(`подсадка ${planted.key} (${planted.id}), клетка ${planted.cell}: код ${red.code} (обязан ≠0), пазл назван в отчёте: ${named ? "да" : "НЕТ"}`);
    if (clean.code !== 0) {
      process.stdout.write(clean.out);
      console.error("ПРОВАЛ: чистая фикстура не зелёная.");
      return 1;
    }
    if (red.code === 0 || !named) {
      process.stdout.write(red.out);
      console.error("ПРОВАЛ: подсаженная поломка не поймана.");
      return 1;
    }
    console.log("Контроль пройден: чистая — зелёная, с поломкой — красная по подсаженному пазлу.");
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  if (argv.includes("--export")) return exportFromProd(arg("out") ?? path.join(PROJECT_ROOT, FIXTURE_PATH)).then(() => 0);
  if (argv.includes("--seed")) {
    const db = arg("db");
    if (!db) throw new Error("нужен --db=<новый файл>");
    const { fixture, problems } = readFixture();
    if (problems.length) throw new Error(`ФИКСТУРА: ${problems.join("; ")}`);
    const n = await seed(path.resolve(db), fixture.rows);
    console.log(`Засеяно ${n} пазлов WORD_SEARCH в ${db} (фикстура от ${fixture.takenAt}).`);
    return 0;
  }
  if (argv.includes("--check")) return check(argv.includes("--plant"));
  console.error("режим: --export | --seed --db=<файл> | --check [--plant]");
  return 1;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message ?? error);
      process.exitCode = 1;
    });
}
