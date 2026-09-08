// Код доступа не создаёт второго пути к доступу.
//
// 08.09.2026, заход 7.146. В 7.145 решение «что этому человеку открыто»
// сведено с десяти мест к одному — `tierOfAccount` в `src/lib/entitlement.ts`.
// Коды доступа — первая с тех пор функция, которая ВЫДАЁТ доступ, и ровно она
// же — первая возможность вернуть болезнь: достаточно завести флаг на `User`,
// или спросить в маршруте «а нет ли у него погашенного кода», или написать
// свою вставку в `Subscription` рядом с общей — и мест снова станет два.
//
// ТРИ ПРАВИЛА, которые держит этот сторож:
//
//   1. Таблица `AccessCode` (`db.accessCode`, `prisma.accessCode`) читается и
//      пишется ТОЛЬКО из `src/lib/access-code.ts`. Ни одна страница, ни один
//      маршрут, ни правило доступа в неё не смотрят.
//   2. Никто, кроме `src/lib/subscription.ts`, не пишет в `Subscription`
//      напрямую в связи с кодом: выдача идёт `extendOrGrantSubscription`.
//      Проверяется у `access-code.ts` поимённо — `db.subscription.create` /
//      `.update` / `.updateMany` / `.upsert` там запрещены.
//   3. В схеме нет колонки уровня «у пользователя есть доступ» — то есть
//      `model User` не обзавёлся полем с именем вида `hasAccess`,
//      `accessCode`, `isPremium`, `entitled`.
//
// Исключения закреплены ЧИСЛОМ, как у `check:brand` и `check:entitlement-point`.
//
//   node scripts/check-access-code-path.mjs
//   node scripts/check-access-code-path.mjs --map
//   node scripts/check-access-code-path.mjs --plant
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const MAP = process.argv.includes("--map");
const ROOT = join(process.cwd(), "src");

/** Дом таблицы кодов: здесь ей и место. */
const HOME = "lib/access-code.ts";

/**
 * Кто ещё имеет право трогать `db.accessCode`, и почему. Каждая строка — с
 * причиной; длина списка закреплена числом ниже.
 *
 * Скрипты (`scripts/*.ts`) сюда не попадают вовсе: сторож ходит по `src/`, а
 * выпуск и отзыв партии — это administración базы, а не выдача доступа
 * пользователю в запросе.
 */
const ALLOWED = new Map();
const ALLOWED_COUNT = 0;

/** Записи в `Subscription`, которые в `access-code.ts` были бы вторым путём
 * выдачи в обход `extendOrGrantSubscription`. */
const FORBIDDEN_WRITES = [
  "db.subscription.create",
  "db.subscription.update",
  "db.subscription.updateMany",
  "db.subscription.upsert",
];

/** Имена полей `User`, которые означали бы хранимый признак доступа. Именно
 * такой флаг 7.145 и вычищал из десяти мест. */
const FORBIDDEN_USER_FIELDS = /^\s*(hasAccess|hasAccessCode|accessCode|accessCodeId|isPremium|isEntitled|entitled|accessUntil)\b/i;

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
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Файлы, читаемые сторожем. Тесты исключены намеренно: тест, поднимающий
 * подставную таблицу, — не второй путь к доступу. */
function sourceFiles() {
  return walk(ROOT)
    .map((f) => relative(ROOT, f).split("\\").join("/"))
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => !f.startsWith("generated/"))
    .sort();
}

/** Обращения к таблице кодов вне её дома. */
function tableTouches(files, read) {
  const hits = [];
  for (const file of files) {
    if (file === HOME) continue;
    const source = stripComments(read(file));
    source.split("\n").forEach((line, i) => {
      if (/\b(?:db|prisma|client)\.accessCode\b/.test(line)) {
        hits.push({ file, line: i + 1, text: line.trim().slice(0, 90) });
      }
    });
  }
  return hits;
}

/** Прямые записи в Subscription внутри дома кодов. */
function directGrants(read) {
  const source = stripComments(read(HOME));
  const hits = [];
  source.split("\n").forEach((line, i) => {
    for (const pattern of FORBIDDEN_WRITES) {
      if (line.includes(pattern)) hits.push({ file: HOME, line: i + 1, text: line.trim().slice(0, 90) });
    }
  });
  return hits;
}

/** Хранимый признак доступа в `model User`. */
function userFlagFields(schemaText) {
  const body = schemaText.split(/\nmodel User \{/)[1]?.split(/\n\}/)[0] ?? "";
  return body
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .filter((line) => FORBIDDEN_USER_FIELDS.test(line))
    .map((line) => line.trim());
}

/** Единственный вызов выдачи — он обязан быть. Без этой половины сторож
 * зеленел бы и на файле, который не выдаёт вообще ничего. */
function grantCalls(read) {
  return (stripComments(read(HOME)).match(/extendOrGrantSubscription\s*\(/g) ?? []).length;
}

function audit(files, read, schemaText) {
  const touches = tableTouches(files, read).filter((h) => !ALLOWED.has(h.file));
  return {
    touches,
    grants: directGrants(read),
    userFlags: userFlagFields(schemaText),
    grantCalls: grantCalls(read),
  };
}

function problems(result) {
  const out = [];
  for (const hit of result.touches) {
    out.push(`ВТОРОЙ ПУТЬ: ${hit.file}:${hit.line} трогает таблицу AccessCode вне ${HOME} — ${hit.text}`);
  }
  for (const hit of result.grants) {
    out.push(`ВЫДАЧА В ОБХОД: ${hit.file}:${hit.line} пишет в Subscription напрямую — ${hit.text}`);
  }
  for (const field of result.userFlags) {
    out.push(`ФЛАГ НА USER: в model User появилось поле-признак доступа — ${field}`);
  }
  if (result.grantCalls === 0) {
    out.push(`ВЫДАЧИ НЕТ ВОВСЕ: в ${HOME} нет ни одного вызова extendOrGrantSubscription`);
  }
  return out;
}

function main() {
  const files = sourceFiles();
  const read = (file) => readFileSync(join(ROOT, file), "utf-8");
  const schemaText = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");

  if (ALLOWED.size !== ALLOWED_COUNT) {
    console.error(`Длина списка исключений ${ALLOWED.size}, ожидалось ${ALLOWED_COUNT}. Число правится вместе со списком.`);
    process.exit(1);
  }

  if (MAP) {
    console.log(`| место | что |`);
    console.log(`|---|---|`);
    console.log(`| \`src/${HOME}\` | дом таблицы AccessCode, ${grantCalls(read)} вызов(а) extendOrGrantSubscription |`);
    for (const hit of tableTouches(files, read)) console.log(`| \`src/${hit.file}:${hit.line}\` | ${hit.text} |`);
    console.log(`\nфайлов прочитано: ${files.length}; исключений: ${ALLOWED.size}`);
  }

  if (PLANT) {
    console.log("check:access-code-path --plant");
    let caught = 0;
    const plants = [
      {
        name: "маршрут спрашивает таблицу кодов сам",
        run: () => {
          const plantedRead = (file) =>
            file === "app/api/checkout/route.ts"
              ? `const row = await db.accessCode.findUnique({ where: { code } });\n`
              : read(file);
          const planted = [...files, "app/api/checkout/route.ts"];
          return problems(audit([...new Set(planted)], plantedRead, schemaText)).some((p) => p.startsWith("ВТОРОЙ ПУТЬ"));
        },
      },
      {
        name: "погашение пишет строку Subscription само, в обход общей выдачи",
        run: () => {
          const plantedRead = (file) =>
            file === HOME
              ? read(file).replace(
                  "await extendOrGrantSubscription(",
                  "await db.subscription.create({ data: {} }); await extendOrGrantSubscription("
                )
              : read(file);
          return problems(audit(files, plantedRead, schemaText)).some((p) => p.startsWith("ВЫДАЧА В ОБХОД"));
        },
      },
      {
        name: "на User заведён флаг доступа",
        run: () => {
          const planted = schemaText.replace("\nmodel User {", "\nmodel User {\n  hasAccessCode Boolean @default(false)");
          return problems(audit(files, read, planted)).some((p) => p.startsWith("ФЛАГ НА USER"));
        },
      },
      {
        name: "выдача выброшена вовсе — сторож не должен зеленеть на пустоте",
        run: () => {
          const plantedRead = (file) =>
            file === HOME ? read(file).replaceAll("extendOrGrantSubscription(", "nothingAtAll(") : read(file);
          return problems(audit(files, plantedRead, schemaText)).some((p) => p.startsWith("ВЫДАЧИ НЕТ"));
        },
      },
    ];
    for (const plant of plants) {
      const hit = plant.run();
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${plant.name}`);
      if (hit) caught += 1;
    }
    const clean = problems(audit(files, read, schemaText));
    const quiet = clean.length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: без подсадки чисто" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — сначала почини настоящее нарушение"}`
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const found = problems(audit(files, read, schemaText));
  if (found.length === 0) {
    console.log(
      `check:access-code-path — ${files.length} файлов, таблица AccessCode читается только из src/${HOME}, ` +
        `выдача идёт ${grantCalls(read)} вызовом extendOrGrantSubscription, флагов доступа на User 0, нарушений 0.`
    );
    process.exit(0);
  }
  for (const line of found) console.error(line);
  process.exit(1);
}

// Ничего при импорте — см. src/lib/entry-point.test.ts.
const isEntryPointHere =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPointHere) main();
