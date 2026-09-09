// Базу прогона e2e трогает ровно один процесс — сервер.
//
// 08.09.2026, заход 7.148. Правило не новое: его вывели числами ещё в 7.134
// (долг 58), когда `e2e/search-demand-log.spec.ts` читала таблицу СВОИМ
// соединением поверх того же файла. Механизм там измерен и повторён здесь:
// база в форме CI живёт в журнальном режиме `delete` (`prisma db push` не
// включает WAL), а в нём любое второе соединение исключает пишущего; libSQL
// под Prisma при этом не ждёт вовсе и на столкновении «писатель против
// писателя» НЕ откатывает начатую транзакцию — файл остаётся заблокированным,
// и следующие запросы сервера отвечают `P1008 / SocketTimeout`.
//
// Цена нарушения названа не рассуждением: 7.147 завела код доступа отдельным
// процессом (`scripts/e2e-access-code.ts` под `tsx`), и полный прогон в форме
// CI дал на этой ветке 41 падение из 403 локально и 2 падения + 2 flaky в CI —
// причём НИ ОДНО из падений не было в том тесте, который писал. Правило жило
// только в комментарии одного маршрута, и поэтому его хватило ровно на один
// заход. Теперь оно стоит на пути мержа.
//
// ЧТО ИМЕННО ЗАПРЕЩЕНО файлам в `e2e/`:
//
//   1. своё соединение к базе — `better-sqlite3`, `node:sqlite`,
//      `DatabaseSync`, `@prisma/adapter-libsql`, сгенерированный клиент
//      Prisma, `@/lib/db`;
//   2. запуск дочернего процесса — `node:child_process` и его функции: именно
//      так второе соединение и заводилось, в обход первого запрета.
//
// Всё, что спеке нужно от базы, она спрашивает у сервера: `/api/test/*`
// (`search-log`, `access-code`, `grant-subscription`).
//
//   node scripts/check-e2e-single-writer.mjs
//   node scripts/check-e2e-single-writer.mjs --plant
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROOT = join(process.cwd(), "e2e");

/** Признак → что это значит человеку. Ищется в исходнике БЕЗ комментариев:
 * `search-demand-log.spec.ts` объясняет в шапке, почему `node:sqlite` оттуда
 * убран, и сторож не должен краснеть от объяснения. */
const CONNECTIONS = [
  ["better-sqlite3", "своё соединение к файлу базы"],
  ["node:sqlite", "своё соединение к файлу базы"],
  ["DatabaseSync", "своё соединение к файлу базы"],
  ["@prisma/adapter-libsql", "свой клиент Prisma"],
  ["generated/prisma", "свой клиент Prisma"],
  ["@/lib/db", "клиент базы приложения внутри спеки"],
];

const CHILD_PROCESSES = [
  ["node:child_process", "запуск дочернего процесса"],
  ['"child_process"', "запуск дочернего процесса"],
  ["execFileSync", "запуск дочернего процесса"],
  ["execSync", "запуск дочернего процесса"],
  ["spawnSync", "запуск дочернего процесса"],
];

/** Убирает `/* … *\/` и `//…`, сохраняя нумерацию строк. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

function files() {
  return walk(ROOT)
    .map((f) => relative(ROOT, f).split("\\").join("/"))
    .sort();
}

function audit(list, read) {
  const hits = [];
  for (const file of list) {
    const source = stripComments(read(file));
    source.split("\n").forEach((line, i) => {
      for (const [needle, why] of [...CONNECTIONS, ...CHILD_PROCESSES]) {
        if (line.includes(needle)) hits.push({ file, line: i + 1, needle, why });
      }
    });
  }
  return hits;
}

function main() {
  const list = files();
  const read = (file) => readFileSync(join(ROOT, file), "utf-8");

  if (PLANT) {
    console.log("check:e2e-single-writer --plant");
    let caught = 0;
    const plants = [
      ['import Database from "better-sqlite3";', "спека завела своё соединение к файлу базы"],
      ['import { DatabaseSync } from "node:sqlite";', "спека читает базу через node:sqlite"],
      ['import { PrismaClient } from "../src/generated/prisma/client";', "спека подняла свой клиент Prisma"],
      ['import { execFileSync } from "node:child_process";', "спека зовёт отдельный процесс"],
    ];
    for (const [line, name] of plants) {
      const plantedRead = (file) => (file === list[0] ? `${line}\n${read(file)}` : read(file));
      const hit = audit(list, plantedRead).length > 0;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}`);
      if (hit) caught += 1;
    }
    const quiet = audit(list, read).length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: без подсадки чисто" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — сначала почини настоящее нарушение"}`
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const hits = audit(list, read);
  if (hits.length === 0) {
    console.log(
      `check:e2e-single-writer — ${list.length} файлов в e2e/, своих соединений к базе 0, ` +
        `запусков дочерних процессов 0. Базу прогона пишет только сервер.`
    );
    process.exit(0);
  }
  for (const hit of hits) {
    console.error(
      `ВТОРОЙ ПИСАТЕЛЬ: e2e/${hit.file}:${hit.line} — ${hit.why} (${hit.needle}). ` +
        `Спроси это у сервера через /api/test/*; см. PROGRESS.md 7.134 и 7.148.`
    );
  }
  process.exit(1);
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) main();
