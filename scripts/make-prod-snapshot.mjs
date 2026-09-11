/**
 * ОДИН снимок боевой базы на диск — чтобы тяжёлые переписи работали
 * по нему и боевых чтений не тратили вовсе (долг 135, заход 7.172).
 *
 * Цена снимка называется ДО первого запроса и равна числу строк в базе:
 * одна строка читается один раз. Это ЕДИНСТВЕННЫЙ сплошной проход по
 * боевой базе, который заход имеет право сделать, и делает он его один
 * раз на все переписи, а не по разу на каждую.
 *
 * ЛОВУШКА, ЗАПЛАЧЕННАЯ 11.09.2026. Первый снимок 7.172 листался через
 * `LIMIT ? OFFSET ?` — и обошёлся в 278 984 просмотренные строки вместо
 * названных 47 287, то есть в 5,9 раза дороже. Причина не в размере
 * базы: SQLite при `OFFSET n` ЧИТАЕТ и выбрасывает эти n строк, поэтому
 * десять страниц по 4000 строк стоят 0+4000+8000+… Здесь листание
 * идёт по КЛЮЧУ (`where id > ? order by id`), и каждая строка читается
 * ровно один раз. Цена, названная заранее, обязана сходиться с
 * заплаченной — иначе правило «называй цену» ничего не стоит.
 *
 *   npm run snapshot:prod                       # в prisma/snapshots/prod-latest.db
 *   node scripts/make-prod-snapshot.mjs --out=… --dry-run
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_SNAPSHOT, SNAPSHOT_DIR } from "./prod-read-budget.mjs";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const OUT = arg("out", DEFAULT_SNAPSHOT);
const DRY = argv.includes("--dry-run");

async function main() {
  const raw = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(raw) || !process.env.TURSO_AUTH_TOKEN) {
    console.error("нужен боевой TURSO_DATABASE_URL и TURSO_AUTH_TOKEN (в .env.turso, только чтение)");
    process.exit(1);
  }
  const host = raw.replace(/^libsql:\/\//, "https://");

  let rowsRead = 0;
  async function sql(stmts) {
    const list = Array.isArray(stmts) ? stmts : [stmts];
    const res = await fetch(`${host}/v2/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [...list.map((s) => ({ type: "execute", stmt: typeof s === "string" ? { sql: s } : s })), { type: "close" }],
      }),
    });
    const json = await res.json();
    const out = [];
    for (const r of json.results) {
      if (r.type === "error") throw new Error(JSON.stringify(r.error));
      if (r.response?.type !== "execute") continue;
      const R = r.response.result;
      rowsRead += R.rows_read ?? 0;
      if ((R.rows_written ?? 0) > 0) throw new Error("снимок обязан быть ТОЛЬКО чтением, а база сообщила о записи");
      out.push({ cols: R.cols.map((c) => c.name), rows: R.rows.map((row) => row.map((v) => (v.type === "null" ? null : v.value))) });
    }
    return Array.isArray(stmts) ? out : out[0];
  }

  const master = await sql("select type, name, sql from sqlite_master where sql is not null order by case type when 'table' then 0 else 1 end");
  const ddl = master.rows.filter((r) => !String(r[1]).startsWith("sqlite_"));
  const tables = ddl.filter((r) => r[0] === "table").map((r) => r[1]);

  const counts = await sql(tables.map((t) => `select count(*) from "${t}"`));
  const perTable = Object.fromEntries(tables.map((t, i) => [t, Number(counts[i].rows[0][0])]));
  const total = Object.values(perTable).reduce((a, b) => a + b, 0);
  console.log(`ЦЕНА СНИМКА, названная до первого запроса данных: ${total.toLocaleString("ru-RU")} просмотренных строк (по строке на строку).`);
  for (const t of tables) if (perTable[t]) console.log(`  ${t.padEnd(24)} ${String(perTable[t]).padStart(8)}`);
  if (DRY) {
    console.log(`--dry-run: данные не снимались. Служебные чтения (sqlite_master + count): ${rowsRead.toLocaleString("ru-RU")} строк.`);
    process.exit(0);
  }

  const lit = (v) => (v === null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
  const lines = ["PRAGMA journal_mode=OFF;", "BEGIN;"];
  for (const [type, , s] of ddl) if (type === "table") lines.push(s + ";");

  const PAGE = 4000;
  for (const t of tables) {
    // Листаем ПО КЛЮЧУ, а не по OFFSET: строка читается ровно один раз.
    const keyCol = (await sql(`select name from pragma_table_info('${t}') where pk = 1`)).rows.map((r) => r[0])[0];
    let after = null;
    let got = 0;
    for (;;) {
      const stmt = keyCol
        ? after === null
          ? { sql: `select * from "${t}" order by "${keyCol}" limit ${PAGE}` }
          : { sql: `select * from "${t}" where "${keyCol}" > ? order by "${keyCol}" limit ${PAGE}`, args: [{ type: "text", value: String(after) }] }
        : { sql: `select * from "${t}"` };
      const r = await sql(stmt);
      if (r.rows.length === 0) break;
      const cols = r.cols.map((c) => `"${c}"`).join(",");
      for (const row of r.rows) lines.push(`INSERT INTO "${t}" (${cols}) VALUES (${row.map(lit).join(",")});`);
      got += r.rows.length;
      if (!keyCol || r.rows.length < PAGE) break;
      after = r.rows[r.rows.length - 1][r.cols.indexOf(keyCol)];
    }
    if (got !== perTable[t]) {
      console.error(`ОТКАЗ: в "${t}" снято ${got} строк из ${perTable[t]} — снимок неполный, на диск не кладётся`);
      process.exit(1);
    }
  }
  for (const [type, , s] of ddl) if (type === "index") lines.push(s + ";");
  lines.push("COMMIT;");

  mkdirSync(path.dirname(OUT) || SNAPSHOT_DIR, { recursive: true });
  if (existsSync(OUT)) rmSync(OUT);
  const sqlPath = OUT + ".sql";
  writeFileSync(sqlPath, lines.join("\n"));
  execFileSync("sqlite3", [OUT], { input: lines.join("\n") });
  rmSync(sqlPath);
  console.log(`снимок: ${OUT}, ${statSync(OUT).size.toLocaleString("ru-RU")} байт, ${total.toLocaleString("ru-RU")} строк`);
  console.log(`ЗАПЛАЧЕНО: ${rowsRead.toLocaleString("ru-RU")} просмотренных строк (названо было ${total.toLocaleString("ru-RU")}).`);

}

// Импорт ничего не запускает: скрипт читает боевую базу, и импортировать
// его «за функцией» значило бы сходить в прод молча. См. src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
