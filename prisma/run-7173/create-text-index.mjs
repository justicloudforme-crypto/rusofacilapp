/**
 * Единственная запись в боевую базу, которую заход 7.173 имеет право
 * сделать: `CREATE INDEX IF NOT EXISTS "AudioAsset_text_idx"` (долг 135).
 *
 * Ни строки данных, ни удаления, ни другой правки схемы — список
 * операторов взят из `prisma/ensure-schema-sync.ts`
 * (`CREATE_INDEX_STATEMENTS`), а не написан здесь заново, и проверяется
 * перед отправкой: всё, кроме `CREATE INDEX IF NOT EXISTS`, — отказ.
 *
 * Порядок обязателен и заложен в сам скрипт: сначала `--dry-run` печатает
 * SQL и цену, и только отдельный запуск с `--apply` его отправляет.
 *
 *   node prisma/run-7173/create-text-index.mjs --dry-run
 *   node prisma/run-7173/create-text-index.mjs --apply
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const DRY = process.argv.includes("--dry-run");

function env() {
  for (const line of readFileSync(".env.turso", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

/** Операторы берутся ТЕКСТОМ из ensure-schema-sync: один список на прод и
 * на каждую будущую сборку, чтобы эти два пути не разошлись. */
function statements() {
  const src = readFileSync("prisma/ensure-schema-sync.ts", "utf8");
  const block = src.slice(src.indexOf("const CREATE_INDEX_STATEMENTS"), src.indexOf("/** Индексы, которые на проде БЫЛИ"));
  const found = [...block.matchAll(/statement:\s*`([^`]+)`/g)].map((m) => m[1].trim());
  if (found.length === 0) throw new Error("в CREATE_INDEX_STATEMENTS не найдено ни одного оператора");
  for (const s of found) {
    if (!/^CREATE INDEX IF NOT EXISTS "[A-Za-z_]+" ON "[A-Za-z_]+"\("[A-Za-z_]+"\)$/.test(s)) {
      throw new Error(`ОТКАЗ: оператор не похож на безопасный CREATE INDEX IF NOT EXISTS — «${s}»`);
    }
  }
  return found;
}

async function pipeline(host, token, requests) {
  const res = await fetch(`${host}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [...requests, { type: "close" }] }),
  });
  const json = await res.json();
  const out = [];
  for (const r of json.results) {
    if (r.type === "error") throw new Error(JSON.stringify(r.error));
    if (r.response?.type === "execute") out.push(r.response.result);
  }
  return out;
}

async function main() {
  const list = statements();
  env();
  const url = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN) throw new Error("нужны боевые ключи в .env.turso");
  const host = url.replace(/^libsql:\/\//, "https://");
  const token = process.env.TURSO_AUTH_TOKEN;

  console.log("SQL, который будет отправлен в боевую базу:");
  for (const s of list) console.log(`  ${s};`);
  console.log(
    "\nЦЕНА, названная ДО отправки: построение индекса по 36 316 строкам `AudioAsset` —\n" +
      "  прочитано около 36 316 строк, записано 36 316 элементов индекса, на диске +2,31 МБ\n" +
      "  (замерено на копии снимка: 42 221 568 → 44 646 400 байт). Операция — чистое\n" +
      "  добавление: ни одной строки данных не правится, ни одной не удаляется."
  );

  if (!APPLY) {
    console.log(`\n--dry-run: ничего не отправлено. Для записи — ${DRY ? "тот же запуск с --apply" : "--apply"}.`);
    return;
  }

  const before = await pipeline(host, token, [
    { type: "execute", stmt: { sql: "select name from sqlite_master where type='index' and tbl_name='AudioAsset' order by name" } },
  ]);
  console.log(`\nиндексы AudioAsset ДО: ${before[0].rows.map((r) => r[0].value).join(", ")}`);

  const t0 = new Date().toISOString();
  const results = await pipeline(host, token, list.map((sql) => ({ type: "execute", stmt: { sql } })));
  const t1 = new Date().toISOString();
  let read = 0;
  let written = 0;
  for (const r of results) {
    read += r.rows_read ?? 0;
    written += r.rows_written ?? 0;
  }
  console.log(`ОТПРАВЛЕНО. ${t0} → ${t1}; ЗАПЛАЧЕНО: прочитано ${read.toLocaleString("ru-RU")}, записано ${written.toLocaleString("ru-RU")}.`);

  const after = await pipeline(host, token, [
    { type: "execute", stmt: { sql: "select name, sql from sqlite_master where type='index' and tbl_name='AudioAsset' order by name" } },
    { type: "execute", stmt: { sql: "explain query plan select id, contentType, contentId, itemKey, text, audioUrl from AudioAsset where (text in ('космонавт','полёт','космос','ракета','старт','Земля') and (not contentType = 'story')) order by contentType, contentId, itemKey" } },
    { type: "execute", stmt: { sql: "explain query plan select id, contentType, contentId, itemKey, text, audioUrl from AudioAsset where (voice = 'onyx' and (not contentType = 'story') and (text = 'Москва' or text = 'москва')) order by contentType, contentId, itemKey" } },
    { type: "execute", stmt: { sql: "select * from pragma_index_xinfo('AudioAsset_text_idx')" } },
  ]);
  console.log("\nиндексы AudioAsset ПОСЛЕ:");
  for (const row of after[0].rows) console.log(`  ${row[0].value}  ${row[1].type === "null" ? "(автоиндекс)" : row[1].value}`);
  console.log("\nEXPLAIN QUERY PLAN на ПРОДЕ, clipsByText:");
  for (const row of after[1].rows) console.log(`  ${row.map((v) => (v.type === "null" ? "" : v.value)).join(" | ")}`);
  console.log("EXPLAIN QUERY PLAN на ПРОДЕ, /api/word-audio:");
  for (const row of after[2].rows) console.log(`  ${row.map((v) => (v.type === "null" ? "" : v.value)).join(" | ")}`);
  console.log("сортировка колонок индекса (обязана быть BINARY — как у колонки):");
  for (const row of after[3].rows) console.log(`  ${row.map((v) => (v.type === "null" ? "-" : v.value)).join(" | ")}`);
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().catch((e) => { console.error(String(e)); process.exitCode = 1; });
