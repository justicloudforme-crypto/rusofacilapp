/**
 * Цена поверхности в ПРОСМОТРЕННЫХ СТРОКАХ боевой базы — замером, а не
 * моделью (заход 7.173, долг 135).
 *
 * Вход — журнал SQL одного ХОЛОДНОГО рендера, снятый локально по снимку
 * прода (`PRISMA_QUERY_LOG`, сервер поднимался заново под каждую
 * поверхность, боевая база при съёме не читалась вовсе). Здесь тот же SQL
 * с теми же параметрами повторяется по одному разу, и цена берётся из
 * `rows_read` ответа. Так 7.172 и измерял 36 328 строк у медиа-страницы;
 * модель по `EXPLAIN` занижала цену в 1,4 раза.
 *
 * ПРАВИЛА, которые здесь не декоративные:
 *   * только `SELECT`. Любое другое слово в начале запроса — отказ до
 *     соединения: заходу запрещено писать в боевую базу что-либо, кроме
 *     индексов части 1.
 *   * против прода — только с `--against-prod`, и цена называется ДО
 *     первого запроса (правило 7.172, `scripts/prod-read-budget.mjs`).
 *   * `rows_written` у каждого ответа обязан быть нулём, иначе прогон
 *     падает на месте.
 *
 *   node prisma/run-7173/replay-surface-cost.mjs --sql=<каталог> --against-prod
 *   node prisma/run-7173/replay-surface-cost.mjs --sql=<каталог> --db=file:…/snapshot.db
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SQL_DIR = arg("sql");
const OUT = arg("out");
const LOCAL_DB = arg("db");
const AGAINST_PROD = argv.includes("--against-prod");

function loadEnvTurso() {
  for (const line of readFileSync(".env.turso", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

function typed(v) {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "number") return Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v };
  if (typeof v === "boolean") return { type: "integer", value: v ? "1" : "0" };
  return { type: "text", value: String(v) };
}

function statements(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const { query, params } = JSON.parse(line);
      if (!/^\s*SELECT\b/i.test(query)) {
        throw new Error(`ОТКАЗ: в журнале не SELECT — «${query.slice(0, 60)}…». Заходу запрещено писать в боевую базу.`);
      }
      return { sql: query, args: JSON.parse(params).map(typed) };
    });
}

async function main() {
  if (!SQL_DIR) throw new Error("нужен --sql=<каталог с *.jsonl>");
  const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".jsonl")).sort();
  const plan = files.map((f) => ({ name: path.basename(f, ".jsonl"), stmts: statements(path.join(SQL_DIR, f)) }));
  const totalStatements = plan.reduce((a, p) => a + p.stmts.length, 0);

  if (AGAINST_PROD) {
    loadEnvTurso();
    if (!/^libsql:\/\//.test(process.env.TURSO_DATABASE_URL ?? "")) throw new Error("нет боевого TURSO_DATABASE_URL");
    console.log(
      `ПРОТИВ БОЕВОЙ БАЗЫ. Поверхностей ${plan.length}, запросов ${totalStatements}. Ожидаемая цена названа ДО первого запроса:\n` +
        `  до индекса — порядка 250 000 просмотренных строк (сумма замеров 7.172 по этим же поверхностям);\n` +
        `  после индекса — порядка 30 000 (полные проходы по AudioAsset уходят).`
    );
  } else if (!LOCAL_DB) {
    throw new Error(`ОТКАЗ: нет ни --against-prod, ни --db=file:… — в прод молча не ходим`);
  }

  const host = AGAINST_PROD ? process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, "https://") : null;
  let client = null;
  if (!AGAINST_PROD) {
    const { createClient } = await import("@libsql/client");
    client = createClient({ url: LOCAL_DB });
  }

  const rows = [];
  let grand = 0;
  let wrote = 0;
  for (const { name, stmts } of plan) {
    let read = 0;
    const perQuery = [];
    for (const stmt of stmts) {
      if (AGAINST_PROD) {
        const res = await fetch(`${host}/v2/pipeline`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests: [{ type: "execute", stmt }, { type: "close" }] }),
        });
        const json = await res.json();
        const r = json.results[0];
        if (r.type === "error") throw new Error(JSON.stringify(r.error));
        const R = r.response.result;
        wrote += R.rows_written ?? 0;
        read += R.rows_read ?? 0;
        perQuery.push(R.rows_read ?? 0);
      } else {
        await client.execute({ sql: stmt.sql, args: stmt.args.map((a) => (a.type === "null" ? null : a.value)) });
        perQuery.push(null);
      }
    }
    grand += read;
    rows.push({ surface: name, queries: stmts.length, rowsRead: read, perQuery });
    console.log(`  ${name.padEnd(22)} запросов ${String(stmts.length).padStart(2)}  строк ${String(read).padStart(7)}  самый дорогой ${String(Math.max(0, ...perQuery)).padStart(7)}`);
  }
  console.log(`ИТОГО прочитано ${grand.toLocaleString("ru-RU")} строк; записано ${wrote}`);
  if (wrote !== 0) {
    console.error("ОТКАЗ: база сообщила о записи — этого не должно было случиться");
    process.exitCode = 1;
  }
  if (OUT) writeFileSync(OUT, JSON.stringify({ rows, grand, wrote }, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
