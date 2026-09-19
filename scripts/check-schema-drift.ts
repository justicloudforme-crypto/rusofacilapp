/**
 * Схема против настоящей базы: не только «колонка есть», но и КАКАЯ.
 *
 * ЗАЧЕМ. Долг 6 (закрыт 29.08.2026) сверял по 22 моделям ровно один
 * вопрос — есть ли колонка, — и на этом останавливался. 08.09.2026
 * замером найдено, чего он не видит: `Story.topic` объявлен в
 * `schema.prisma` как `String @default("other")`, то есть NOT NULL со
 * значением по умолчанию, а на проде эта колонка nullable, без дефолта и
 * пуста во всех 325 строках. Никакого сбоя тут нет:
 * `prisma/ensure-schema-sync.ts` добавляет недостающие колонки голым
 * `ALTER TABLE … ADD COLUMN <тип>` — без `NOT NULL` и без `DEFAULT`,
 * потому что SQLite иначе отказывается добавлять колонку в непустую
 * таблицу. Это его задокументированное свойство (PROGRESS 7.8), и именно
 * поэтому расхождение обязана ловить отдельная сверка, а не он сам.
 *
 * Следствие не гипотетическое: Prisma отдаёт коду `topic` как `string`,
 * а приходит `null`, и фильтр каталога рассказов фильтровать не по чему.
 *
 * ЧТО СПРАШИВАЕТСЯ у каждого скалярного поля каждой модели:
 *
 *   1. колонка вообще есть (вопрос долга 6, оставлен);
 *   2. `notnull` совпадает с тем, объявлено ли поле с `?`;
 *   3. `dflt_value` совпадает с `@default(...)`, если он объявлен;
 *   4. `type` из семейства, допустимого для объявленного типа Prisma;
 *   5. и отдельно, для колонки, которая в схеме NOT NULL, а в базе
 *      nullable: СКОЛЬКО строк в ней пусты. Число, а не «есть проблема»:
 *      разница между «колонка молодая и пустых нет» и «пусты все 325»
 *      это разница между заметкой и долгом.
 *
 * ЧИТАЕТ И ТОЛЬКО ЧИТАЕТ. `PRAGMA table_info` и `SELECT COUNT(*)` —
 * ничего другого здесь нет и быть не должно: цель — уметь запускать это
 * против боевой базы.
 *
 *   npm run check:schema-drift          # прод, если в окружении есть TURSO_*, иначе dev.db
 *   npm run check:schema-drift:plant    # позитивный контроль
 *
 * `--plant` не украшение. Проверка отвечает числом расхождений, и по
 * правилу PROGRESS 4.1 её зелёный (или её «одно расхождение») ничего не
 * значит, пока не показано, что она умеет находить подсаженное.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { parseSchema } from "../prisma/ensure-schema-sync";

/** Какие имена типов SQLite законны для объявленного типа Prisma.
 * Их больше одного не по слабости сверки: миграции Prisma пишут
 * `BOOLEAN`/`DATETIME`, а `ensure-schema-sync` добавляет колонки как
 * `INTEGER`/`TEXT` — обе формы живут в боевой базе законно, и требовать
 * одну означало бы 40 ложных находок в первом же прогоне. */
const ACCEPTABLE_SQLITE_TYPES: Record<string, string[]> = {
  TEXT: ["TEXT", "DATETIME", "JSONB"],
  INTEGER: ["INTEGER", "BOOLEAN", "BIGINT"],
  REAL: ["REAL", "FLOAT", "DECIMAL"],
};

/** Значения `@default(...)`, которые Prisma вычисляет на стороне клиента:
 * в базе им дефолта соответствовать не обязано. */
const CLIENT_SIDE_DEFAULTS = new Set(["cuid()", "uuid()", "autoincrement()", "auto()"]);

interface Finding {
  model: string;
  column: string;
  kind: "нет колонки" | "nullability" | "дефолт" | "дефолт только в базе" | "тип";
  expected: string;
  actual: string;
  /** Сколько строк пусты — только для NOT NULL в схеме и nullable в базе. */
  emptyRows?: number;
  rows?: number;
}

function expectedDefault(raw: string): string | null {
  if (CLIENT_SIDE_DEFAULTS.has(raw)) return null;
  if (raw === "now()") return "CURRENT_TIMESTAMP";
  if (raw.startsWith("dbgenerated(")) return null;
  // `"other"` в схеме — это `'other'` в DDL SQLite.
  const quoted = raw.match(/^"(.*)"$/);
  if (quoted) return `'${quoted[1]}'`;
  return raw;
}

function defaultsAgree(expected: string, actual: string | null): boolean {
  if (actual === null) return false;
  // `false` и `0` — одно и то же значение, записанное двумя законными
  // способами: миграции Prisma пишут `false`, а рукописный DDL в
  // ensure-schema-sync — `0`. Обе формы живут в боевой базе.
  const norm = (v: string) =>
    v
      .trim()
      .replace(/^\((.*)\)$/, "$1")
      .toLowerCase()
      .replace(/^false$/, "0")
      .replace(/^true$/, "1");
  return norm(expected) === norm(actual);
}

/**
 * Сколько ТАБЛИЦ сверка действительно осмотрела в последнем прогоне.
 *
 * ДЫРА, НАЙДЕННАЯ 19.09.2026 (7.216) ПРИ ЗАКРЫТИИ ДОЛГА 68. Пропуск
 * отсутствующей таблицы (строка ниже) — решение правильное и
 * объяснённое, но у него есть край: на базе, где таблиц НЕТ ВОВСЕ,
 * пропускаются все, и сверка честно печатает «расхождений нет».
 * Проверено на пустом файле базы: 0 осмотренных таблиц и зелёный код
 * выхода. Это ровно тот случай из правила замера 4.1, где «0» означает
 * «0 совпадений», а не «всё хорошо», — и он опасен именно там, куда
 * сверку и надо поставить: в прогоне, где базу кто-то должен был поднять
 * перед ней. Поэтому число осмотренного теперь называется вслух, а ноль
 * роняет прогон.
 */
export let lastExaminedTables = 0;

export async function findDrift(client: Client, schemaText: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let examined = 0;

  for (const model of parseSchema(schemaText)) {
    const info = await client.execute(`PRAGMA table_info("${model.name}")`);
    if (info.rows.length === 0) continue; // таблицы нет — это вопрос ensure-schema-sync, не этой сверки
    examined += 1;
    const columns = new Map(
      info.rows.map((row) => [
        String(row.name),
        {
          type: String(row.type ?? "").toUpperCase(),
          notnull: Number(row.notnull) === 1,
          dflt: row.dflt_value === null || row.dflt_value === undefined ? null : String(row.dflt_value),
        },
      ]),
    );

    for (const field of model.fields) {
      const actual = columns.get(field.name);
      if (!actual) {
        findings.push({ model: model.name, column: field.name, kind: "нет колонки", expected: field.sqlType, actual: "—" });
        continue;
      }

      const expectedNotNull = !field.nullable;
      if (expectedNotNull !== actual.notnull) {
        const finding: Finding = {
          model: model.name,
          column: field.name,
          kind: "nullability",
          expected: expectedNotNull ? "NOT NULL" : "nullable",
          actual: actual.notnull ? "NOT NULL" : "nullable",
        };
        // Число, а не факт: пустых строк в колонке, которую код считает
        // непустой, — это и есть цена расхождения.
        if (expectedNotNull) {
          const counted = await client.execute(
            `SELECT COUNT(*) AS total, SUM(CASE WHEN "${field.name}" IS NULL THEN 1 ELSE 0 END) AS empty FROM "${model.name}"`,
          );
          finding.rows = Number(counted.rows[0]?.total ?? 0);
          finding.emptyRows = Number(counted.rows[0]?.empty ?? 0);
        }
        findings.push(finding);
      }

      if (field.defaultRaw !== null) {
        const expected = expectedDefault(field.defaultRaw);
        if (expected !== null && !defaultsAgree(expected, actual.dflt)) {
          findings.push({
            model: model.name,
            column: field.name,
            kind: "дефолт",
            expected,
            actual: actual.dflt ?? "нет дефолта",
          });
        }
      } else if (actual.dflt !== null) {
        /**
         * ОБРАТНЫЙ ВОПРОС — ДОЛГ 69.
         *
         * Строка долга: «`check:schema-drift` спрашивает про дефолт
         * ТОЛЬКО когда он объявлен в схеме: обратного вопроса — «в базе
         * дефолт есть, а в схеме его нет» — у неё нет вовсе. Снятие
         * `@default(2)` у `User.streakFreezesLeft` закрыло находку и тем
         * же движением лишило сверку возможности возразить со второй
         * стороны […] чинится симметричным вопросом в
         * `scripts/check-schema-drift.ts` — те же `PRAGMA table_info`,
         * которые скрипт уже читает, обратной сверкой».
         *
         * Чем это плохо на практике: дефолт, оставшийся в базе
         * наследством `prisma db push` или ручного `ALTER`, продолжает
         * подставлять значение при вставке мимо Prisma (сид, сырой SQL,
         * `ensure-schema-sync.ts`), а код об этом значении не знает
         * ничего. Расхождение молча живёт дальше — ровно то, что эта
         * сверка и обязана ловить.
         *
         * `CURRENT_TIMESTAMP` из этого вопроса исключён намеренно: его
         * ставит сам `ensure-schema-sync.ts` на колонках времени, где
         * Prisma считает значение на своей стороне (`@default(now())`
         * разбирается в `expectedDefault` как клиентский), и ругаться на
         * собственный шов было бы ложной тревогой.
         */
        const dflt = actual.dflt.trim().toUpperCase();
        if (dflt !== "CURRENT_TIMESTAMP" && dflt !== "NULL") {
          findings.push({
            model: model.name,
            column: field.name,
            kind: "дефолт только в базе",
            expected: "дефолта нет",
            actual: actual.dflt,
          });
        }
      }

      const allowed = ACCEPTABLE_SQLITE_TYPES[field.sqlType] ?? [field.sqlType];
      if (actual.type && !allowed.includes(actual.type)) {
        findings.push({ model: model.name, column: field.name, kind: "тип", expected: allowed.join("/"), actual: actual.type });
      }
    }
  }

  lastExaminedTables = examined;
  return findings;
}

function describe(f: Finding): string {
  const tail =
    f.emptyRows === undefined ? "" : ` — пустых строк ${f.emptyRows} из ${f.rows}`;
  return `  ${f.model}.${f.column}: ${f.kind} — в схеме ${f.expected}, в базе ${f.actual}${tail}`;
}

function connect(): { client: Client; label: string } {
  const turso = process.env.TURSO_DATABASE_URL;
  if (turso) {
    return { client: createClient({ url: turso, authToken: process.env.TURSO_AUTH_TOKEN }), label: "боевая база (Turso)" };
  }
  const local = process.env.DATABASE_URL ?? "file:./dev.db";
  return { client: createClient({ url: local }), label: `локальная база (${local})` };
}

/** Позитивный контроль. Подсаживается не в базу — в ТЕКСТ схемы, потому
 * что сверка сравнивает две стороны, и подсадка в ту, которую можно
 * менять безнаказанно, доказывает ровно то же. ЧЕТЫРЕ формы, по одной на
 * каждый вопрос сверки; четвёртая — обратный вопрос долга 69, и она
 * подсаживается СНЯТИЕМ `@default`, то есть ровно тем движением, которым
 * дыра и была открыта. */
const PLANTS: Array<{ name: string; mutate: (schema: string) => string; expect: (f: Finding) => boolean }> = [
  {
    name: "nullable-колонка объявлена NOT NULL (форма долга 68)",
    mutate: (s) => s.replace("descriptionRu String?", "descriptionRu String"),
    expect: (f) => f.model === "Story" && f.column === "descriptionRu" && f.kind === "nullability",
  },
  {
    name: "дефолт в схеме не тот, что в базе",
    mutate: (s) => s.replace("isPremium     Boolean  @default(false)", "isPremium     Boolean  @default(true)"),
    expect: (f) => f.model === "Story" && f.column === "isPremium" && f.kind === "дефолт",
  },
  {
    // ДОЛГ 69, обратный вопрос: дефолт остался в базе, а из схемы убран.
    // Снятие `@default(false)` у `Story.isPremium` — это буквально то же
    // движение, каким 7.142 сняло `@default(2)` у `User.streakFreezesLeft`
    // и тем же движением лишило сверку второй стороны.
    name: "дефолт есть в базе, а из схемы убран (долг 69)",
    mutate: (s) => s.replace("isPremium     Boolean  @default(false)", "isPremium     Boolean"),
    expect: (f) => f.model === "Story" && f.column === "isPremium" && f.kind === "дефолт только в базе",
  },
  {
    name: "колонки, объявленной в схеме, в базе нет",
    mutate: (s) => s.replace("readingMinutes Int?", "readingMinutesPlanted Int?"),
    expect: (f) => f.model === "Story" && f.column === "readingMinutesPlanted" && f.kind === "нет колонки",
  },
];

async function main() {
  const plant = process.argv.includes("--plant");
  const schemaPath = join(process.cwd(), "prisma/schema.prisma");
  const schemaText = readFileSync(schemaPath, "utf-8");
  const { client, label } = connect();

  try {
    const real = await findDrift(client, schemaText);

    if (plant) {
      console.log(`check:schema-drift --plant — ${label}`);
      let caught = 0;
      for (const p of PLANTS) {
        const mutated = p.mutate(schemaText);
        if (mutated === schemaText) {
          console.error(`  ПОДСАДКА НЕ ПРИМЕНИЛАСЬ: «${p.name}» — строка в схеме изменилась, контроль ничего не доказывает`);
          continue;
        }
        const found = (await findDrift(client, mutated)).some(p.expect);
        // Отрицательная половина: та же находка НЕ должна появляться на
        // неподсаженной схеме, иначе контроль ловит не подсадку.
        const alsoWithout = real.some(p.expect);
        console.log(`  ${found && !alsoWithout ? "поймано" : "ПРОПУЩЕНО"}: ${p.name}${alsoWithout ? " (находка есть и БЕЗ подсадки — контроль пуст)" : ""}`);
        if (found && !alsoWithout) caught += 1;
      }
      console.log(`  поймано ${caught} из ${PLANTS.length}`);
      process.exitCode = caught === PLANTS.length ? 0 : 1;
      return;
    }

    console.log(`check:schema-drift — ${label}`);
    if (lastExaminedTables === 0) {
      console.error(
        "  ОТКАЗ: осмотрено 0 таблиц. В этой базе нет ни одной таблицы из схемы — значит сверять было нечего,\n" +
          "  а «расхождений нет» означало бы «0 совпадений», а не «всё хорошо» (правило замера 4.1).",
      );
      process.exitCode = 1;
      return;
    }
    if (real.length === 0) {
      console.log(`  осмотрено таблиц: ${lastExaminedTables}; расхождений схемы и базы нет (контроль — npm run check:schema-drift:plant).`);
      return;
    }
    console.log(`  осмотрено таблиц: ${lastExaminedTables}`);
    console.log(`  расхождений: ${real.length}`);
    for (const f of real) console.log(describe(f));
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

const isEntryPoint = process.argv[1]?.endsWith("check-schema-drift.ts");
if (isEntryPoint) {
  main().catch((error) => {
    console.error("[check:schema-drift] упало:", error);
    process.exit(1);
  });
}
