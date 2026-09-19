// Сырой SQL не решает вопросов о времени за Prisma.
//
// 08.09.2026, заход 7.147, долг 91. Находка, из которой правило выросло,
// стоила одного красного прогона сценария [A6] в 7.146: Prisma хранит
// `DateTime` на SQLite/libSQL **текстом** (`2026-09-08T12:00:00.000+00:00`),
// а не числом миллисекунд. Строка, положенная в таблицу сырым клиентом
// числом, читается через Prisma как правильная дата — разбор идёт в JS, —
// но СРАВНЕНИЕ в SQL с ней не работает: SQLite ставит все числа ниже любой
// строки. Живой код доступа выглядел неизвестным.
//
// Дефекта в приложении на проде не было и нет: и запись, и чтение там идут
// через Prisma. Не было ровно одного — СТОРОЖА, который заметит, если это
// перестанет быть правдой. Он перед вами.
//
// ДВА ПРАВИЛА:
//
//   1. СРАВНЕНИЕ. Сырой SQL не сравнивает колонку `DateTime` порядковым
//      оператором (`<`, `>`, `<=`, `>=`, `BETWEEN`) и не заворачивает её в
//      `date()`/`datetime()`/`julianday()`/`strftime()`. Ответ такого
//      сравнения зависит от формата хранения, а формат принадлежит Prisma:
//      сравнивать надо либо через Prisma (она знает свой формат), либо в JS
//      после чтения.
//   2. ЗАПИСЬ. Если сырой SQL всё-таки ПИШЕТ колонку `DateTime`, значение
//      обязано прийти из общего форматтера `storedDateTime`
//      (`scripts/stored-datetime.mjs`), а не из `new Date()`, `Date.now()`,
//      `.getTime()` или `.toISOString()` на месте. Иначе в одной таблице
//      заводятся две записи одной даты, и первое же сравнение в SQL —
//      хоть наше, хоть внутри Prisma — начинает врать.
//
// Исключения закреплены ЧИСЛОМ, как у check:brand, check:entitlement-point
// и check:access-code-path: список правится вместе с числом, молча вырасти
// он не может.
//
//   node scripts/check-raw-datetime.mjs
//   node scripts/check-raw-datetime.mjs --map
//   node scripts/check-raw-datetime.mjs --plant
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const MAP = process.argv.includes("--map");
const ROOT = process.cwd();

/** Где ищем. `src/generated` — не наш код, `node_modules` — тем более. */
const SCANNED = ["src", "scripts", "prisma", "e2e"];

/**
 * Кому можно, и почему. Ключ — `файл:строка не нужна`, достаточно файла и
 * куска SQL: причина пишется рядом, а длина списка закреплена числом ниже.
 */
const ALLOWED = new Map([
  [
    "scripts/check-raw-datetime.mjs",
    "сам сторож: примеры нарушений в его подсадках — это строки, которые он ОБЯЗАН находить",
  ],
]);
const ALLOWED_COUNT = 1;

/**
 * Исключения ВТОРОГО вопроса (по аргументу вызова, долг 92) — отдельным
 * списком и УЖЕ файлового: ключ «файл:колонка», а не файл целиком.
 *
 * Почему не общий список. Пустить сюда весь файл значило бы ослепить
 * сторожа на остальные его строки, а в `access-code.scenario.ts` записей
 * даты ещё шесть, и все через форматтер. Здесь разрешена ровно одна
 * колонка в одном файле — та, кривой формат которой и есть ПРЕДМЕТ
 * измерения случая [A12]: он кладёт срок числом миллисекунд нарочно и
 * показывает, что живой код становится неизвестным. Запрети это — и
 * находка 7.146 перестанет быть воспроизводимой.
 */
const ALLOWED_ARGUMENT_SITES = new Map([
  [
    "scripts/scenarios/access-code.scenario.ts:expiresAt",
    "случай [A12] кладёт срок числом миллисекунд НАРОЧНО — это измерение поведения SQLite, а не запись продукта",
  ],
]);
const ALLOWED_ARGUMENT_SITES_COUNT = 1;

/** Порядковые операторы: именно они зависят от формата хранения. Равенство
 * (`=`) в список не входит намеренно — оно врёт иначе и заметнее. */
const ORDER_OPS = ["<=", ">=", "<", ">"];
/** Функции SQLite, которым формат даты тоже не безразличен. */
const DATE_FUNCTIONS = ["julianday", "strftime", "datetime", "date", "unixepoch"];
/** Выражения, из которых дата в сыром SQL приходить не должна. */
const RAW_DATE_SOURCES = [".toISOString()", "Date.now()", ".getTime()", ".valueOf()", "new Date("];
/** Единственный законный источник. */
const FORMATTER = "storedDateTime";

/** Колонки `DateTime` по схеме — по имени, без привязки к модели: имена
 * здесь говорящие (`createdAt`, `expiresAt`, `currentPeriodEnd`), и колонки
 * с таким именем и не-датой в этой схеме нет ни одной. */
export function dateTimeColumns(schemaText) {
  const names = new Set();
  for (const line of schemaText.split("\n")) {
    const match = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s+DateTime\b/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "generated") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

export function sourceFiles(root = ROOT) {
  const out = [];
  for (const dir of SCANNED) {
    try {
      out.push(...walk(join(root, dir)));
    } catch {
      // Каталога может не быть — это не ошибка сторожа.
    }
  }
  return out.map((f) => relative(root, f).split("\\").join("/")).sort();
}

/**
 * Все строковые литералы файла (обычные и шаблонные) с их положением.
 * Простой посимвольный разбор: комментарии и вложенные кавычки он различает,
 * а `${…}` внутри шаблона оставляет как есть — для наших вопросов этого
 * достаточно.
 */
export function stringLiterals(source) {
  const out = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i;
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote) break;
        i += 1;
      }
      out.push({ start, end: i, text: source.slice(start + 1, i) });
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * Похоже ли на SQL-запрос, а не на любую строку со словом «update».
 *
 * Требуется ПАРА слов, а не одно, и это не придирка: отрицательный контроль
 * подсадки поймал сторожа на строке `"update your createdAt > settings"` —
 * обычной фразе, в которой есть и «update», и колонка, и знак «больше».
 * Одиночного ключевого слова недостаточно.
 */
export function looksLikeSql(text) {
  return (
    /\bselect\b[\s\S]*\bfrom\b/i.test(text) ||
    /\binsert\s+(?:or\s+\w+\s+)?into\b/i.test(text) ||
    (/\bupdate\b[\s\S]*\bset\b/i.test(text) && /=/.test(text)) ||
    /\bdelete\s+from\b/i.test(text)
  );
}

const lineOf = (source, index) => source.slice(0, index).split("\n").length;

/** Ищет `col <оператор>` и `<оператор> col` в обе стороны, а также колонку
 * внутри функции даты. */
export function comparisons(sql, columns) {
  const hits = [];
  for (const column of columns) {
    const bare = `(?:"|\`|\\[)?${column}(?:"|\`|\\])?`;
    for (const op of ORDER_OPS) {
      const escaped = op.replace(/[<>=]/g, (c) => `\\${c}`);
      if (new RegExp(`\\b${bare}\\s*${escaped}`, "i").test(sql)) hits.push(`${column} ${op}`);
      if (new RegExp(`${escaped}\\s*${bare}\\b`, "i").test(sql)) hits.push(`${op} ${column}`);
    }
    if (new RegExp(`\\b${bare}\\s+between\\b`, "i").test(sql)) hits.push(`${column} BETWEEN`);
    for (const fn of DATE_FUNCTIONS) {
      if (new RegExp(`\\b${fn}\\s*\\([^)]*\\b${bare}`, "i").test(sql)) hits.push(`${fn}(${column})`);
    }
  }
  return [...new Set(hits)];
}

/** Колонки `DateTime`, которые этот кусок SQL ПИШЕТ. */
export function writtenColumns(sql, columns) {
  const hits = new Set();
  // INSERT INTO "T" (a, b, c)
  const insert = /\binsert\s+(?:or\s+\w+\s+)?into\s+["'`[]?[A-Za-z_][A-Za-z0-9_]*["'`\]]?\s*\(([^)]*)\)/i.exec(sql);
  if (insert) {
    for (const raw of insert[1].split(",")) {
      const name = raw.trim().replace(/^["'`[]|["'`\]]$/g, "");
      if (columns.has(name)) hits.add(name);
    }
  }
  // UPDATE … SET col = …
  if (/\bupdate\b/i.test(sql) && /\bset\b/i.test(sql)) {
    for (const column of columns) {
      if (new RegExp(`\\b(?:"|\`|\\[)?${column}(?:"|\`|\\])?\\s*=`, "i").test(sql)) hits.add(column);
    }
  }
  return [...hits];
}

/**
 * ====================================================================
 * ВТОРОЙ ВОПРОС, УЖЕ ПО ВЫЗОВУ, А НЕ ПО ФАЙЛУ — ДОЛГ 92
 * ====================================================================
 *
 * Строка долга дословно: «у `check:raw-datetime` источник даты ищется по
 * ВСЕМУ файлу, а не по вызову, и это осознанный размен (иначе значение
 * прячется за переименованием в переменную — так сторож и нашёл
 * `check-rendered-surface.mjs`). Цена размена: в файле, где общий
 * форматтер УЖЕ есть, запись мимо него сторож не увидит. Это не догадка,
 * это измерено: случай [A12] в `access-code.scenario.ts` кладёт
 * `expiresAt` числом миллисекунд, и сторож на этом файле молчит. Чинить
 * разбором аргументов вызова, а не строк файла».
 *
 * Сделано ровно это, и вопрос по файлу НЕ убран — добавлен второй.
 * Файловый вопрос ловит «дата собрана в переменную двумя строками выше»,
 * вызовный — «в файле форматтер есть, а этот конкретный аргумент мимо
 * него». Убери любой из двух, и одна из двух форм проходит молча.
 *
 * Как считается соответствие «колонка → аргумент». Позиция щели `?`
 * берётся из САМОГО SQL: у `INSERT` — из списка колонок и списка
 * `VALUES` (литералы вроде `'standard'` и `90` щелями не считаются и
 * счёт не сдвигают), у `UPDATE` — по числу щелей до `SET col =`. Дальше
 * смотрится ровно тот аргумент, а не весь список: аргумент с
 * `Date.now()` для колонки, которая датой не является, ложной тревогой
 * не становится.
 */

/** Верхнеуровневое разбиение по запятым: скобки и кавычки не режутся. */
export function splitTopLevel(text) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((t) => t.trim());
}

/** Номер щели `?`, в которую этот SQL кладёт названную колонку `DateTime`.
 *  `null` — колонка пишется не щелью (литералом), спрашивать нечего. */
export function placeholderIndexFor(sql, column) {
  const insert =
    /\binsert\s+(?:or\s+\w+\s+)?into\s+["'`[]?[A-Za-z_][A-Za-z0-9_]*["'`\]]?\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\)/i.exec(
      sql,
    );
  if (insert) {
    const cols = splitTopLevel(insert[1]).map((c) => c.replace(/^["'`[]|["'`\]]$/g, ""));
    const values = splitTopLevel(insert[2]);
    const at = cols.indexOf(column);
    if (at < 0 || at >= values.length) return null;
    if (values[at] !== "?") return null;
    return values.slice(0, at).filter((v) => v === "?").length;
  }
  if (/\bupdate\b/i.test(sql) && /\bset\b/i.test(sql)) {
    const bare = "(?:\"|`|\\[)?" + column + "(?:\"|`|\\])?";
    const m = new RegExp(bare + "\\s*=\\s*\\?", "i").exec(sql);
    if (!m) return null;
    return (sql.slice(0, m.index).match(/\?/g) ?? []).length;
  }
  return null;
}

/** Массив `args: [...]` того вызова, которому принадлежит этот SQL. */
export function argumentsAfter(source, from) {
  const at = source.indexOf("args", from);
  if (at < 0) return null;
  const open = source.indexOf("[", at);
  if (open < 0 || open - at > 40) return null;
  let depth = 0;
  let quote = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "[" || ch === "(" || ch === "{") depth += 1;
    else if (ch === "]" || ch === ")" || ch === "}") {
      depth -= 1;
      if (depth === 0) return splitTopLevel(source.slice(open + 1, i));
    }
  }
  return null;
}

/** Берёт ли этот аргумент дату мимо общего форматтера. */
export function argumentBypassesFormatter(argument) {
  if (argument === undefined || argument === null) return null;
  if (argument.includes(`${FORMATTER}(`)) return null;
  for (const expr of RAW_DATE_SOURCES) {
    if (argument.includes(expr)) return expr;
  }
  return null;
}

/**
 * ОБЛАСТЬ ПОИСКА ИСТОЧНИКА ДАТЫ — ВЕСЬ ФАЙЛ, А НЕ ВЫЗОВ. Это решение, и вот
 * его цена, измеренная на первом же прогоне: `scripts/check-rendered-surface.mjs`
 * пишет `currentPeriodEnd`, `createdAt` и `updatedAt` строкой
 * `new Date().toISOString()`, но не в самом вызове — значения собираются в
 * переменные `now` и `end` двумя строками выше, а в `.run(...)` уходят уже
 * именами. Сторож, смотревший только внутрь вызова, это НЕ находил. Прятать
 * нарушение за переименованием — ровно то, чего сторож не должен позволять,
 * поэтому вопрос задаётся файлу целиком: «этот файл пишет дату сырым SQL —
 * откуда он вообще берёт даты?»
 *
 * Цена решения названа вслух: файл, который сырым SQL ПЕРЕПИСЫВАЕТ уже
 * готовое значение из другой базы (копировщики `sync-*-to-turso.ts`), но при
 * этом где-то рядом зовёт `Date.now()` для своего, скажем, отчёта, будет
 * назван ложно. Лечится строкой в списке исключений с причиной — видимой в
 * дифе, в отличие от молчания.
 */
export function auditFile(file, source, columns) {
  const problems = [];
  const sites = [];
  const literals = stringLiterals(source).filter((literal) => looksLikeSql(literal.text));

  // Откуда этот файл вообще берёт даты — с номерами строк, чтобы сообщение
  // называло место, а не файл.
  const rawSources = [];
  source.split("\n").forEach((text, index) => {
    const stripped = text.replace(/\/\/.*$/, "");
    for (const expr of RAW_DATE_SOURCES) {
      if (stripped.includes(expr)) rawSources.push(`${expr} (строка ${index + 1})`);
    }
  });
  const hasFormatter = new RegExp(`\\b${FORMATTER}\\s*\\(`).test(source);

  for (const literal of literals) {
    const line = lineOf(source, literal.start);
    const compared = comparisons(literal.text, columns);
    const written = writtenColumns(literal.text, columns);
    if (compared.length === 0 && written.length === 0) continue;
    sites.push({ file, line, compared, written });

    if (ALLOWED.has(file)) continue;

    for (const hit of compared) {
      problems.push(
        `СРАВНЕНИЕ ДАТЫ В СЫРОМ SQL: ${file}:${line} — «${hit}». ` +
          `Ответ зависит от формата хранения, а формат принадлежит Prisma: сравнивать через Prisma или в JS.`
      );
    }
    // ВТОРОЙ ВОПРОС — ПО ВЫЗОВУ (долг 92). Работает и там, где форматтер
    // в файле есть: спрашивается ровно тот аргумент, который уезжает в
    // щель этой колонки.
    if (written.length > 0) {
      const args = argumentsAfter(source, literal.end ?? literal.start);
      if (args) {
        for (const column of written) {
          const index = placeholderIndexFor(literal.text, column);
          if (index === null || index >= args.length) continue;
          const bypass = argumentBypassesFormatter(args[index]);
          if (!bypass) continue;
          if (ALLOWED_ARGUMENT_SITES.has(`${file}:${column}`)) continue;
          problems.push(
            `ЗАПИСЬ ДАТЫ МИМО ФОРМАТА PRISMA (по аргументу вызова): ${file}:${line} — ` +
              `колонка ${column} уезжает в щель №${index + 1}, а там «${args[index].trim()}» (${bypass}). ` +
              `Значение обязано пройти через ${FORMATTER}() (scripts/stored-datetime.mjs). ` +
              `Вопрос по файлу здесь молчит: общий форматтер в файле есть — долг 92.`,
          );
        }
      }
    }

    if (written.length > 0 && rawSources.length > 0 && !hasFormatter) {
      problems.push(
        `ЗАПИСЬ ДАТЫ МИМО ФОРМАТА PRISMA: ${file}:${line} — пишет ${written.join(", ")}, ` +
          `а даты в этом файле берутся из ${rawSources.slice(0, 3).join(", ")}` +
          `${rawSources.length > 3 ? ` и ещё ${rawSources.length - 3}` : ""}. ` +
          `Значение обязано пройти через ${FORMATTER}() (scripts/stored-datetime.mjs), ` +
          `иначе в одной колонке заводятся два формата.`
      );
    }
  }
  return { problems, sites };
}

export function audit(files, read, schemaText) {
  const columns = dateTimeColumns(schemaText);
  const problems = [];
  const sites = [];
  for (const file of files) {
    const result = auditFile(file, read(file), columns);
    problems.push(...result.problems);
    sites.push(...result.sites);
  }
  return { problems, sites, columns };
}

function main() {
  const files = sourceFiles();
  const read = (file) => readFileSync(join(ROOT, file), "utf-8");
  const schemaText = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf-8");

  if (ALLOWED.size !== ALLOWED_COUNT) {
    console.error(`Длина списка исключений ${ALLOWED.size}, ожидалось ${ALLOWED_COUNT}. Число правится вместе со списком.`);
    process.exit(1);
  }
  if (ALLOWED_ARGUMENT_SITES.size !== ALLOWED_ARGUMENT_SITES_COUNT) {
    console.error(
      `Длина списка исключений по аргументу ${ALLOWED_ARGUMENT_SITES.size}, ожидалось ${ALLOWED_ARGUMENT_SITES_COUNT}. ` +
        "Число правится вместе со списком.",
    );
    process.exit(1);
  }

  if (MAP) {
    const { sites, columns } = audit(files, read, schemaText);
    console.log(`| место | сравнивает | пишет |`);
    console.log(`|---|---|---|`);
    for (const site of sites) {
      console.log(`| \`${site.file}:${site.line}\` | ${site.compared.join(", ") || "—"} | ${site.written.join(", ") || "—"} |`);
    }
    console.log(`\nколонок DateTime в схеме: ${columns.size}; файлов прочитано: ${files.length}; мест: ${sites.length}`);
    return 0;
  }

  if (PLANT) {
    console.log("check:raw-datetime --plant");
    // Подсадки живут в памяти: настоящие файлы не трогаются вовсе.
    const plants = [
      {
        name: "сырое сравнение срока годности кода (та самая находка 7.146)",
        file: "src/lib/planted.ts",
        source: 'const rows = await raw.execute({ sql: `SELECT code FROM "AccessCode" WHERE expiresAt > ?`, args: [now] });',
        expect: "СРАВНЕНИЕ",
      },
      {
        name: "сырая запись даты числом миллисекунд",
        file: "src/lib/planted.ts",
        source:
          'await raw.execute({ sql: `INSERT INTO "AccessCode" (id, code, expiresAt) VALUES (?, ?, ?)`, args: [id, code, Date.now()] });',
        expect: "ЗАПИСЬ",
      },
      {
        name: "сырая запись даты через toISOString (Z вместо +00:00)",
        file: "src/lib/planted.ts",
        source:
          'db.prepare("INSERT INTO Subscription (id, currentPeriodEnd) VALUES (?, ?)").run(id, new Date().toISOString());',
        expect: "ЗАПИСЬ",
      },
      {
        name: "дата, завёрнутая в julianday()",
        file: "src/lib/planted.ts",
        source: 'const rows = await db.$queryRawUnsafe(`SELECT id FROM "StudyDay" WHERE julianday(markedAt) > julianday(?)`);',
        expect: "СРАВНЕНИЕ",
      },
      {
        // Отрицательная половина: сторож обязан МОЛЧАТЬ там, где всё верно.
        name: "запись через общий форматтер — молчание (отрицательный контроль)",
        file: "src/lib/planted.ts",
        source:
          'await raw.execute({ sql: `INSERT INTO "AccessCode" (id, code, expiresAt) VALUES (?, ?, ?)`, args: [id, code, storedDateTime(new Date())] });',
        expect: null,
      },
      {
        // И вторая: обычная строка со словом update — не SQL.
        name: "строка со словом update, но не запрос — молчание (отрицательный контроль)",
        file: "src/lib/planted.ts",
        source: 'const message = "update your createdAt > settings"; console.log(message, Date.now());',
        expect: null,
      },
      {
        // ДОЛГ 92. Ровно форма случая [A12]: в файле общий форматтер ЕСТЬ
        // (соседний аргумент через него и уезжает), а срок кладётся числом
        // миллисекунд. Вопрос по файлу здесь молчит по построению —
        // ловит только вопрос по аргументу вызова.
        name: "форматтер в файле есть, а ОДИН аргумент мимо него (долг 92)",
        file: "src/lib/planted.ts",
        source:
          'await raw.execute({ sql: `INSERT INTO "AccessCode" (id, code, tier, expiresAt, createdAt) VALUES (?, ?, \'standard\', ?, ?)`, args: [id, code, hour.getTime(), storedDateTime(new Date())] });',
        expect: "ЗАПИСЬ ДАТЫ МИМО ФОРМАТА PRISMA (по аргументу вызова)",
      },
      {
        // Обратная половина той же подсадки: тот же вызов, но срок уезжает
        // через форматтер — сторож обязан молчать, иначе он ловит не то.
        name: "тот же вызов, срок через форматтер — молчание (отрицательный контроль к долгу 92)",
        file: "src/lib/planted.ts",
        source:
          'await raw.execute({ sql: `INSERT INTO "AccessCode" (id, code, tier, expiresAt, createdAt) VALUES (?, ?, \'standard\', ?, ?)`, args: [id, code, storedDateTime(hour), storedDateTime(new Date())] });',
        expect: null,
      },
      {
        // И третья: аргумент с `Date.now()` для колонки, которая ДАТОЙ НЕ
        // ЯВЛЯЕТСЯ, ложной тревогой становиться не должен — позиционный
        // разбор тем и оправдан, что он смотрит ровно свою щель.
        name: "Date.now() уезжает в щель НЕ-даты — молчание (отрицательный контроль)",
        file: "src/lib/planted.ts",
        source:
          'await raw.execute({ sql: `INSERT INTO "AccessCode" (id, code, durationDays, createdAt) VALUES (?, ?, ?, ?)`, args: [id, code, Date.now(), storedDateTime(new Date())] });',
        expect: null,
      },
    ];
    const columns = dateTimeColumns(schemaText);
    let caught = 0;
    for (const plant of plants) {
      const { problems } = auditFile(plant.file, plant.source, columns);
      const hit = plant.expect === null ? problems.length === 0 : problems.some((p) => p.startsWith(plant.expect));
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${plant.name}`);
      if (hit) caught += 1;
    }
    const clean = audit(files, read, schemaText).problems;
    const quiet = clean.length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: без подсадки чисто" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН (${clean.length}) — сначала почини настоящее нарушение`}`
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    return caught === plants.length && quiet ? 0 : 1;
  }

  const { problems, sites, columns } = audit(files, read, schemaText);
  if (problems.length === 0) {
    console.log(
      `check:raw-datetime — ${files.length} файлов, мест с сырым SQL по колонкам DateTime ${sites.length}, ` +
        `колонок DateTime в схеме ${columns.size}, исключений ${ALLOWED.size}, нарушений 0.`
    );
    return 0;
  }
  for (const line of problems) console.error(line);
  console.error(`\nнарушений: ${problems.length}; файлов прочитано: ${files.length}`);
  return 1;
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) process.exit(main());
