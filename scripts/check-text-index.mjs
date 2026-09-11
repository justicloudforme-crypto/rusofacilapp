/**
 * Индекс на `AudioAsset.text` ОБЯЗАН БРАТЬСЯ — и это проверяется планом
 * запроса, а не наличием строчки в схеме (долг 135, заход 7.173).
 *
 * ЦЕНА, ЗАПЛАЧЕННАЯ 11.09.2026. Оба индекса `AudioAsset` начинались с
 * `contentType`, индекса на `text` не было, и запрос
 * `WHERE text IN (…) AND NOT contentType='story'` (`clipsByText`,
 * `src/lib/audio-reuse.ts`) шёл ПОЛНЫМ проходом: один холодный рендер
 * медиа-страницы достаёт 6 нужных строк, прочитав 36 316 (замерено
 * `rows_read`). 552 медиа-страницы в карте сайта — 91% цены полного
 * обхода сайта, и это исчерпало месячную квоту чтений Turso: живой сайт
 * отдавал 500 у 330 замороженных URL из 330 несколько часов
 * (PROGRESS.md 7.172).
 *
 * ПОЧЕМУ НЕ ХВАТИЛО БЫ ПРОВЕРКИ «`@@index([text])` есть в схеме».
 * Индекс, объявленный в схеме, — это ещё не индекс, который БЕРЁТСЯ. Три
 * способа потерять его молча, каждый без единой правки схемы:
 *   1. сортировка. Индекс с `COLLATE NOCASE` на колонке без `COLLATE`
 *      планировщик НЕ возьмёт вовсе — проверено контролем ниже, план
 *      остаётся полным проходом;
 *   2. форма запроса. `LOWER(text) = ?`, `text LIKE ?`, приведение типа
 *      или нормализация в SQL — и индекс снова не годится;
 *   3. доставка. В проекте нет каталога миграций: индексы на прод везёт
 *      `prisma/ensure-schema-sync.ts`, и `@@index`, дописанный к давно
 *      живущей модели, до прода не доезжал НИКОГДА — ровно так этот
 *      индекс и не существовал до 11.09.2026.
 * Поэтому проверка строит базу В ФОРМЕ CI из самой схемы и смотрит
 * `EXPLAIN QUERY PLAN` двух НАСТОЯЩИХ запросов продукта — тех самых,
 * которые снял `prisma/run-7173/capture-sql.ts` из журнала Prisma, а не
 * переписанных от руки.
 *
 * Базу строит `prisma migrate diff --from-empty --to-schema`, а не
 * `prisma db push`, которым базу заводит CI: push отказывается идти без
 * переменной согласия (он умеет терять данные), а diff печатает ровно тот
 * же DDL и ничего не трогает. Форма от этого не меняется — сверка ниже
 * проверяет, что DDL вообще дошёл до базы.
 *
 *   node scripts/check-text-index.mjs          # проверка
 *   node scripts/check-text-index.mjs --plant  # позитивный контроль
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NAME = "check:text-index";
const INDEX = "AudioAsset_text_idx";

/** Те самые два запроса. Снято из журнала Prisma 11.09.2026
 * (`prisma/run-7173/capture-sql.ts`), параметры подставлены литералами —
 * план от этого не меняется, а читать такое можно. */
const QUERIES = [
  {
    what: "clipsByText (src/lib/audio-reuse.ts) — «Ключевая лексика» медиа-страницы и /api/lesson-audio",
    sql:
      "SELECT `AudioAsset`.`id`, `AudioAsset`.`contentType`, `AudioAsset`.`contentId`, `AudioAsset`.`itemKey`, " +
      "`AudioAsset`.`text`, `AudioAsset`.`audioUrl` FROM `AudioAsset` WHERE (`AudioAsset`.`text` IN " +
      "('космонавт','полёт','космос','ракета','старт','Земля') AND (NOT `AudioAsset`.`contentType` = 'story')) " +
      "ORDER BY `AudioAsset`.`contentType` ASC, `AudioAsset`.`contentId` ASC, `AudioAsset`.`itemKey` ASC LIMIT -1 OFFSET 0",
  },
  {
    what: "wordClipUrl (src/lib/story-word-audio.ts) — /api/word-audio, тап по слову в рассказе",
    sql:
      "SELECT `AudioAsset`.`id`, `AudioAsset`.`contentType`, `AudioAsset`.`contentId`, `AudioAsset`.`itemKey`, " +
      "`AudioAsset`.`text`, `AudioAsset`.`audioUrl` FROM `AudioAsset` WHERE (`AudioAsset`.`voice` = 'onyx' AND " +
      "(NOT `AudioAsset`.`contentType` = 'story') AND (`AudioAsset`.`text` = 'Москва' OR `AudioAsset`.`text` = 'москва')) " +
      "ORDER BY `AudioAsset`.`contentType` ASC, `AudioAsset`.`contentId` ASC, `AudioAsset`.`itemKey` ASC LIMIT -1 OFFSET 0",
  },
];

function sqlite(db, script) {
  return execFileSync("sqlite3", [db], { input: script, encoding: "utf8" });
}

/** База в форме CI: схема проекта, ни одной строки данных. */
function buildCiShapedDb(dir) {
  const db = path.join(dir, "ci-shaped.db");
  const ddl = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  writeFileSync(path.join(dir, "ddl.sql"), ddl);
  sqlite(db, ddl);
  const tables = sqlite(db, "select count(*) from sqlite_master where type='table' and name='AudioAsset';").trim();
  if (tables !== "1") throw new Error("DDL не дошёл до базы: таблицы AudioAsset нет");
  return db;
}

function plan(db, sql) {
  return sqlite(db, `explain query plan ${sql};`).trim();
}

/** По одной строке-претензии НА ЗАПРОС, а не по одной на признак: иначе
 * счёт подсадки («сколько запросов поймано») разойдётся с числом запросов
 * и сверка контроля будет сравнивать несравнимое. */
function check(db) {
  const problems = [];
  for (const q of QUERIES) {
    const p = plan(db, q.sql);
    const usesIndex = p.includes(`USING INDEX ${INDEX}`) && /SEARCH/.test(p);
    const fullScan = /\bSCAN\b/.test(p) && !/SEARCH/.test(p);
    if (!usesIndex) {
      problems.push(
        `план НЕ берёт ${INDEX}${fullScan ? " (остался полный проход)" : ""}: ${q.what}\n      ${p.replace(/\n/g, "\n      ")}`
      );
    }
  }
  return problems;
}

/** Статическая половина: объявление в схеме и доставка на прод. */
async function checkDeclarations() {
  const problems = [];
  const { readFileSync } = await import("node:fs");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const audioAsset = /model AudioAsset \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
  if (!/@@index\(\[text\]\)/.test(audioAsset)) {
    problems.push("в prisma/schema.prisma у AudioAsset нет @@index([text])");
  }
  // Читается ТЕКСТОМ, а не импортом. Импорт этого модуля запускал бы
  // разбор TypeScript под node и — что важнее — заводил бы клиент базы;
  // см. правило про точку входа в самом ensure-schema-sync.ts.
  const sync = readFileSync("prisma/ensure-schema-sync.ts", "utf8");
  if (!sync.includes(`index: "${INDEX}"`)) {
    problems.push(`${INDEX} не числится в CREATE_INDEX_STATEMENTS (prisma/ensure-schema-sync.ts) — на прод он не поедет`);
  }
  if (!new RegExp(`CREATE INDEX IF NOT EXISTS "${INDEX}"`).test(sync)) {
    problems.push(`оператор для ${INDEX} не IF NOT EXISTS — второй билд упадёт на существующем индексе`);
  }
  return problems;
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "text-index-"));
  try {
    const declarations = await checkDeclarations();
    const db = buildCiShapedDb(dir);

    const plantMode = process.argv.includes("--plant");
    if (plantMode) {
      // ПОДСАДКА ровно той формы, которая и была на проде до 11.09.2026:
      // индекса нет. Проверка обязана покраснеть.
      sqlite(db, `DROP INDEX "${INDEX}";`);
      const problems = check(db);
      console.log(`  подсадка «индекса нет»: найдено проблем ${problems.length} (ожидалось ${QUERIES.length})`);
      for (const p of problems) console.log(`    ${p.split("\n")[0]}`);

      // ВТОРАЯ подсадка, которой первая не покрывает: индекс есть, но с
      // ЧУЖОЙ сортировкой. Схема выглядит правильной, а план — полный проход.
      sqlite(db, `CREATE INDEX "${INDEX}" ON "AudioAsset"("text" COLLATE NOCASE);`);
      const nocase = check(db);
      console.log(`  подсадка «индекс с COLLATE NOCASE»: найдено проблем ${nocase.length} (ожидалось ${QUERIES.length})`);

      const ok = problems.length === QUERIES.length && nocase.length === QUERIES.length;
      console.log(`[${NAME} --plant] ${ok ? "пройдено" : "ПРОВАЛ"}: ${problems.length + nocase.length} из ${QUERIES.length * 2}`);
      return ok ? 0 : 1;
    }

    const problems = [...declarations, ...check(db)];
    for (const q of QUERIES) {
      console.log(`  ${plan(db, q.sql).split("\n").find((l) => /SEARCH|SCAN/.test(l))?.trim()}\n    ← ${q.what}`);
    }
    if (problems.length > 0) {
      console.error(`[${NAME}] ПРОБЛЕМ ${problems.length}:`);
      for (const p of problems) console.error(`    ${p}`);
      return 1;
    }
    console.log(`[${NAME}] оба запроса идут поиском по ${INDEX}; объявление в схеме и доставка на прод на месте.`);
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
    }
  );
}
