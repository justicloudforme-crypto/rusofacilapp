/**
 * Индекс на `FlashcardCard.russian` ОБЯЗАН БРАТЬСЯ — план запроса, а не
 * строчка в схеме (заход 7.272, одобрено владельцем 17.10.2026).
 *
 * Что стережём. Перевод слова по тапу в рассказе (`lookupWordBank`,
 * `src/lib/word-bank.ts`; `/api/dictionary/translate` и `/bank`) — самый
 * частый тяжёлый запрос сайта: `russian IN (…)`. До 7.272 индекса не было,
 * и каждый промах кеша читал всю таблицу — замер на проде 17.10.2026:
 * `SCAN main.FlashcardCard`, 5771 прочитанная строка на 2 найденные. С
 * индексом — поиск по нему.
 *
 * Тот же приём и те же три способа потерять индекс молча, что у
 * `check:text-index` (см. его заголовок): чужая сортировка (`COLLATE
 * NOCASE`), форма запроса и доставка — `@@index` у давно живущей модели
 * до прода сам не доезжает, его везёт `CREATE_INDEX_STATEMENTS` в
 * `prisma/ensure-schema-sync.ts`. База строится из схемы
 * (`prisma migrate diff --from-empty`), запрос — снятый из журнала Prisma
 * 17.10.2026, параметры подставлены литералами.
 *
 *   node scripts/check-russian-index.mjs          # проверка
 *   node scripts/check-russian-index.mjs --plant  # позитивный контроль
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NAME = "check:russian-index";
const INDEX = "FlashcardCard_russian_idx";

/** Снято из журнала Prisma 17.10.2026 (`db.flashcardCard.findMany({ where:
 *  { russian: { in } }, select: { russian, translationEs } })`). */
const QUERY = {
  what: "lookupWordBank (src/lib/word-bank.ts) — перевод слова по тапу в рассказе",
  sql:
    "SELECT `main`.`FlashcardCard`.`id`, `main`.`FlashcardCard`.`russian`, `main`.`FlashcardCard`.`translationEs` " +
    "FROM `main`.`FlashcardCard` WHERE `main`.`FlashcardCard`.`russian` IN ('кот','Кот','дом','Дом') LIMIT -1 OFFSET 0",
};

function sqlite(db, script) {
  return execFileSync("sqlite3", [db], { input: script, encoding: "utf8" });
}

function buildCiShapedDb(dir) {
  const db = path.join(dir, "ci-shaped.db");
  const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  sqlite(db, ddl);
  const tables = sqlite(db, "select count(*) from sqlite_master where type='table' and name='FlashcardCard';").trim();
  if (tables !== "1") throw new Error("DDL не дошёл до базы: таблицы FlashcardCard нет");
  return db;
}

function plan(db) {
  return sqlite(db, `explain query plan ${QUERY.sql};`).trim();
}

/** Ноль или одна претензия: запрос один. */
function checkPlan(db) {
  const p = plan(db);
  if (p.includes(`USING INDEX ${INDEX}`) && /SEARCH/.test(p)) return [];
  const fullScan = /\bSCAN\b/.test(p) && !/SEARCH/.test(p);
  return [`план НЕ берёт ${INDEX}${fullScan ? " (остался полный проход)" : ""}: ${QUERY.what}\n      ${p.replace(/\n/g, "\n      ")}`];
}

/** Объявление в схеме и доставка на прод — текстом, без импорта модулей
 *  с клиентом базы. */
function checkDeclarations() {
  const problems = [];
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const model = /model FlashcardCard \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
  if (!/@@index\(\[russian\]\)/.test(model)) problems.push("в prisma/schema.prisma у FlashcardCard нет @@index([russian])");
  const sync = readFileSync("prisma/ensure-schema-sync.ts", "utf8");
  if (!sync.includes(`index: "${INDEX}"`)) {
    problems.push(`${INDEX} не числится в CREATE_INDEX_STATEMENTS (prisma/ensure-schema-sync.ts) — новая база его не получит`);
  }
  if (!new RegExp(`CREATE INDEX IF NOT EXISTS "${INDEX}" ON "FlashcardCard"\\("russian"\\)`).test(sync)) {
    problems.push(`оператор для ${INDEX} не «CREATE INDEX IF NOT EXISTS … ("russian")» — второй билд упадёт или индекс будет другим`);
  }
  return problems;
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "russian-index-"));
  try {
    const declarations = checkDeclarations();
    const db = buildCiShapedDb(dir);

    if (process.argv.includes("--plant")) {
      // Подсадка 1 — ровно то, что было на проде до 17.10.2026: индекса нет.
      sqlite(db, `DROP INDEX "${INDEX}";`);
      const missing = checkPlan(db);
      console.log(`  подсадка «индекса нет»: найдено ${missing.length} (ожидалось 1)`);
      // Подсадка 2 — индекс есть, но с чужой сортировкой: схема на вид верна, план — полный проход.
      sqlite(db, `CREATE INDEX "${INDEX}" ON "FlashcardCard"("russian" COLLATE NOCASE);`);
      const nocase = checkPlan(db);
      console.log(`  подсадка «индекс с COLLATE NOCASE»: найдено ${nocase.length} (ожидалось 1)`);
      // Отрицательный контроль: правильный индекс — претензий ноль.
      sqlite(db, `DROP INDEX "${INDEX}"; CREATE INDEX "${INDEX}" ON "FlashcardCard"("russian");`);
      const clean = checkPlan(db);
      console.log(`  без подсадки: найдено ${clean.length} (ожидалось 0)`);
      const ok = missing.length === 1 && nocase.length === 1 && clean.length === 0;
      console.log(`[${NAME} --plant] ${ok ? "пройдено" : "ПРОВАЛ"}: поймано ${missing.length + nocase.length} из 2, чистый — ${clean.length === 0 ? "чист" : "НЕ чист"}`);
      return ok ? 0 : 1;
    }

    const problems = [...declarations, ...checkPlan(db)];
    console.log(`  ${plan(db).split("\n").find((l) => /SEARCH|SCAN/.test(l))?.trim()}\n    ← ${QUERY.what}`);
    if (problems.length > 0) {
      console.error(`[${NAME}] ПРОБЛЕМ ${problems.length}:`);
      for (const p of problems) console.error(`    ${p}`);
      return 1;
    }
    console.log(`[${NAME}] запрос идёт поиском по ${INDEX}; объявление в схеме и доставка на месте.`);
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`[${NAME}] упал:`, error);
      process.exitCode = 1;
    },
  );
}
