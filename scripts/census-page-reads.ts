/**
 * ПЕРЕПИСЬ: СКОЛЬКО ЧТЕНИЙ ПРИ РЕНДЕРЕ ПУБЛИЧНЫХ СТРАНИЦ УБИВАЮТ ВЕСЬ ОТВЕТ.
 *
 * Строка долга 295, заведена 20.09.2026 (7.220): «20 файлов, 52 места;
 * переживают отказ 27, убивают ответ 25». Та перепись была разовой — её
 * посчитали руками и инструмента не оставили, поэтому «сколько осталось»
 * следующий заход доказать не мог ничем, кроме слова. Здесь она
 * оставлена в репозитории и печатает число.
 *
 * ЧТО СЧИТАЕТСЯ. Модули, отдающие страницу: `src/app/**\/page.tsx`,
 * `layout.tsx`, `sitemap.ts`. Местом считается и прямой вызов
 * `db.X.findMany(`, и вызов помощника, который читает базу, — иначе
 * функция, у которой ВСЕ чтения непрямые, отчиталась бы «чтений нет»
 * (ровно эта ошибка описана в `db-read-resilience.test.ts`).
 *
 * ЧТО ЗНАЧИТ «УБИВАЕТ ОТВЕТ». Место стоит ВНЕ какого-либо `try` в своём
 * файле. Это не приговор: большинство таких мест громкие ЗАКОННО —
 * содержимое урока, сетка пазла, любое чтение уровня доступа. Перепись
 * отвечает на «сколько и где», а не на «что чинить»; чинить решает
 * разбор, и решённое лежит в `MUST_DEGRADE` / `MUST_FAIL_LOUDLY`.
 *
 *   npx tsx scripts/census-page-reads.ts
 *   npx tsx scripts/census-page-reads.ts --plant   # позитивный контроль
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");

/** Помощники, читающие базу без того, чтобы вызывающий назвал `db`.
 *  Тот же список, что в `src/lib/db-read-resilience.test.ts`; расхождение
 *  между ними ловит проверка в конце этого файла. */
const DB_BACKED_HELPERS = [
  "getFlashcardIndex",
  "getStoryCatalog",
  "attachGlossaryAudio",
  "getCurrentUser",
  "getSubscriptionsForUser",
  "getUserStreakStats",
  "getTermBySlug",
  "getStoryById",
  "homePreviewPool",
];

export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Диапазоны `try { … }`, найденные СЧЁТОМ СКОБОК: `}` внутри строки или
 *  комментария обрывает наивную регулярку раньше времени. */
export function tryRanges(raw: string): Array<[number, number]> {
  const source = withoutComments(raw);
  const ranges: Array<[number, number]> = [];
  const header = /\btry\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(source))) {
    let depth = 1;
    let i = header.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    ranges.push([match.index, i]);
  }
  return ranges;
}

export function readOffsets(raw: string): Array<{ offset: number; what: string }> {
  const source = withoutComments(raw);
  const direct = [
    ...source.matchAll(/\bdb\.(\w+)\.(findMany|findUnique|findFirst|count|aggregate|groupBy)\(/g),
  ].map((m) => ({ offset: m.index, what: `db.${m[1]}.${m[2]}` }));
  const indirect = DB_BACKED_HELPERS.flatMap((name) =>
    [...source.matchAll(new RegExp(`\\b${escapeRegExp(name)}\\(`, "g"))].map((m) => ({
      offset: m.index,
      what: name,
    })),
  );
  return [...direct, ...indirect].sort((a, b) => a.offset - b.offset);
}

/** Правило проекта (раздел 7.41): всё, что подставляется в регулярку,
 *  экранируется — даже когда значение своё. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^(page\.tsx|layout\.tsx|sitemap\.ts)$/.test(entry)) out.push(full);
  }
  return out;
}

export interface CensusRow {
  file: string;
  total: number;
  loud: number;
  degrading: number;
  loudReads: string[];
}

export function censusOf(files: Array<{ file: string; source: string }>): CensusRow[] {
  return files
    .map(({ file, source }) => {
      const ranges = tryRanges(source);
      const reads = readOffsets(source);
      const loud = reads.filter(({ offset }) => !ranges.some(([a, b]) => offset > a && offset < b));
      return {
        file,
        total: reads.length,
        loud: loud.length,
        degrading: reads.length - loud.length,
        loudReads: loud.map((r) => r.what),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.loud - a.loud || a.file.localeCompare(b.file));
}

function main() {
  const plant = process.argv.includes("--plant");
  const files = walk(APP).map((file) => ({
    file: relative(SRC, file),
    source: readFileSync(file, "utf8"),
  }));

  if (plant) {
    // ПОЗИТИВНЫЙ КОНТРОЛЬ. Перепись, которая считает «громких 0», ничем
    // не отличается от переписи, которая не нашла файлов: обе печатают
    // ноль. Поэтому к настоящему тексту первого же файла приписывается
    // одно заведомо громкое чтение, и число обязано вырасти ровно на 1.
    const base = censusOf(files);
    const baseLoud = base.reduce((sum, row) => sum + row.loud, 0);
    if (files.length === 0) {
      console.error("✗ ПОДСАДКА ПУСТА: страничных модулей не найдено вовсе");
      process.exit(1);
    }
    const planted = censusOf([
      { ...files[0], source: `${files[0].source}\nasync function planted() { return db.story.findMany(); }\n` },
      ...files.slice(1),
    ]);
    const plantedLoud = planted.reduce((sum, row) => sum + row.loud, 0);
    console.log(`громких до подсадки: ${baseLoud}, после: ${plantedLoud}`);
    if (plantedLoud !== baseLoud + 1) {
      console.error("✗ подсаженное громкое чтение не поймано — перепись ничего не доказывает");
      process.exit(1);
    }
    // Обратная половина: чтение, УБРАННОЕ в try, обязано перестать быть
    // громким. Без неё правило ловило бы только появление, но не починку.
    const wrapped = censusOf([
      {
        ...files[0],
        source: `${files[0].source}\nasync function wrapped() { try { return await db.story.findMany(); } catch (error) { console.error(error); return []; } }\n`,
      },
      ...files.slice(1),
    ]);
    const wrappedLoud = wrapped.reduce((sum, row) => sum + row.loud, 0);
    if (wrappedLoud !== baseLoud) {
      console.error(`✗ обёрнутое чтение всё ещё считается громким (${wrappedLoud} против ${baseLoud})`);
      process.exit(1);
    }
    console.log("✓ подсадка поймана 1 из 1; обёрнутое чтение громким не считается");
    process.exit(0);
  }

  const rows = censusOf(files);
  const totals = rows.reduce(
    (acc, row) => ({
      files: acc.files + 1,
      total: acc.total + row.total,
      loud: acc.loud + row.loud,
      degrading: acc.degrading + row.degrading,
    }),
    { files: 0, total: 0, loud: 0, degrading: 0 },
  );
  // Публичное и служебное считаются ОТДЕЛЬНО. Перепись 7.220 говорила о
  // «рендере публичных страниц», а `app/[lang]/admin/**` открыт только
  // сотруднику: его громкие чтения законны по построению — админке
  // деградировать не во что, там показывают ровно то, что в базе.
  const isAdmin = (file: string) => file.includes("/admin/");
  const publicRows = rows.filter((row) => !isAdmin(row.file));
  const sum = (list: CensusRow[], key: "total" | "loud" | "degrading") =>
    list.reduce((acc, row) => acc + row[key], 0);
  console.log(
    `ВСЕГО: файлов ${totals.files}, мест ${totals.total}; ` +
      `переживают отказ ${totals.degrading}, убивают ответ ${totals.loud}`,
  );
  console.log(
    `ИЗ НИХ ПУБЛИЧНЫХ (без admin/): файлов ${publicRows.length}, мест ${sum(publicRows, "total")}; ` +
      `переживают отказ ${sum(publicRows, "degrading")}, убивают ответ ${sum(publicRows, "loud")}`,
  );
  console.log("");
  console.log("| файл | мест | переживают | убивают ответ |");
  console.log("|---|---:|---:|---:|");
  for (const row of rows) {
    console.log(`| \`${row.file}\` | ${row.total} | ${row.degrading} | ${row.loud} |`);
  }
}

// Гейт точки входа: сам по себе импорт этого файла не имеет права ничего
// делать. Правило держит `src/lib/entry-point.test.ts`, и оно же поймало
// здесь голый `main()` — перепись запускалась бы от одного импорта.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) main();
