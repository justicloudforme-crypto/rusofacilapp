/**
 * ПРОСМОТР НАЗАД НЕ ВОЗВРАЩАЕТСЯ В `src/` — СТОРОЖ.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Класс отказа один и тот же в двух авариях этого проекта: страница
 * отдаётся с кодом 200 и полным HTML, а в браузере гибнет ПОСЛЕ
 * гидрации, и ни один сторож по кодам ответов этого не видит. 29.08.2026
 * это был `\-` под флагом `u` — 240 адресов с «Something went wrong».
 * Второй способ сделать то же самое — возможность, которой у движка
 * читателя нет:
 *
 *   `(?<=` / `(?<!` — просмотр назад, ES2018. Chrome/Android WebView с
 *   62 (2017), Node с 8.3, Firefox с 78, **Safari и любой браузер на iOS
 *   — только с 16.4 (март 2023)**. На движке без него `new RegExp`
 *   бросает `SyntaxError` НА ПОСТРОЕНИИ.
 *
 * Правило поэтому простое и без исключений: в `src/` (кроме проб)
 * просмотра назад нет ни в одном выражении — ни в литерале, ни в строке,
 * собранной из данных. Проба сама себе движок не выбирает: `*.test.ts`
 * гоняются в Node 22, и им это ограничение ни к чему.
 *
 * ====================================================================
 * ПОЧЕМУ СКАНЕР ЧИТАЕТ ПОСИМВОЛЬНО, А НЕ `indexOf("(?<")`
 * ====================================================================
 *
 * `\(?<` — это литеральная скобка, а `[(?<]` — класс из трёх символов.
 * Поиск подстрокой объявил бы их отказом и завёл бы ложный красный.
 * Разбор лежит в `src/lib/legacy-regexp.ts` и оттуда же зовётся пробами,
 * так что второго места, где живёт правило, нет.
 *
 * Комментарии перед разбором забеливаются: этот файл, `glossary-pattern.ts`
 * и `story-insights.ts` называют `(?<!` в прозе — на то они и объяснения.
 *
 *   npx tsx scripts/check-no-lookbehind.ts
 *   npx tsx scripts/check-no-lookbehind.ts --plant
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findLookbehind } from "../src/lib/legacy-regexp";
import { isEntryPoint } from "../src/lib/entry-point";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "generated") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Комментарии забелены, длины сохранены — номер строки обязан остаться
 * настоящим. Та же форма, что у `withoutComments` в
 * `src/lib/data-into-parser.test.ts`, включая `[^:]` перед `//`: без него
 * `https://…` съедает остаток строки, и подсаженная строка проходит. */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, before: string) => before + " ".repeat(m.length - before.length));
}

export interface Finding {
  file: string;
  line: number;
  feature: string;
  excerpt: string;
}

/** Все просмотры назад в одном исходнике, с номерами строк. */
export function findingsIn(file: string, source: string): Finding[] {
  const out: Finding[] = [];
  const clean = withoutComments(source);
  let offset = 0;
  let rest = clean;
  for (;;) {
    const feature = findLookbehind(rest);
    if (!feature) break;
    const at = rest.indexOf(feature);
    const absolute = offset + at;
    out.push({
      file,
      line: clean.slice(0, absolute).split("\n").length,
      feature,
      excerpt: source.slice(Math.max(0, absolute - 40), absolute + 60).replace(/\s+/g, " ").trim(),
    });
    offset = absolute + feature.length;
    rest = clean.slice(offset);
  }
  return out;
}

export function main(): number {
  const plant = process.argv.includes("--plant");

  if (plant) {
    /**
     * ПОДСАДКА — три образца, и третий обязан НЕ ловиться.
     *
     * Без третьего сторож, который кричит на всё подряд, выглядел бы
     * работающим: «поймано 2 из 2». Ложный красный стоит дороже
     * пропуска, потому что его чинят удалением сторожа.
     */
    const samples: { name: string; source: string; caught: boolean }[] = [
      {
        name: "регулярка из данных с просмотром назад (то самое место)",
        source: 'const re = new RegExp(`(?<![\\\\p{L}])(${alternatives.join("|")})`, "giu");',
        caught: true,
      },
      { name: "литерал с просмотром назад", source: "const re = /(?<=\\\\d)px/g;", caught: true },
      {
        name: "ОТРИЦАТЕЛЬНЫЙ контроль: экранированная скобка и класс — не отказ",
        source: 'const a = /\\\\(?</; const b = /[(?<]/; const c = "a < b";',
        caught: false,
      },
    ];
    let ok = true;
    for (const sample of samples) {
      const found = findingsIn("<подсадка>", sample.source).length > 0;
      const good = found === sample.caught;
      console.log(`  ${good ? "верно" : "ОШИБКА"} — ${sample.name}: ${found ? "поймано" : "пропущено"}`);
      if (!good) ok = false;
    }
    /** И четвёртый образец — живой файл, в который просмотр назад
     *  подсажен целиком: сканер обязан назвать его по имени. */
    const victim = join(SRC, "lib", "glossary-pattern.ts");
    const planted = readFileSync(victim, "utf8").replace(
      "`(^|[^\\\\p{L}])(${alternatives.join(\"|\")})(?![\\\\p{L}])`",
      "`(?<![\\\\p{L}])(${alternatives.join(\"|\")})(?![\\\\p{L}])`",
    );
    const onFile = findingsIn(relative(process.cwd(), victim), planted);
    const good = onFile.length === 1;
    console.log(
      `  ${good ? "верно" : "ОШИБКА"} — настоящий файл с возвращённым просмотром назад: находок ${onFile.length}` +
        (onFile.length ? ` (строка ${onFile[0].line})` : ""),
    );
    if (!good) ok = false;
    console.log(
      ok
        ? "check:no-lookbehind --plant — подсадка ловится, отрицательный контроль молчит"
        : "check:no-lookbehind --plant — FAILED",
    );
    return ok ? 0 : 1;
  }

  const files = sourceFiles(SRC);
  /**
   * ПОЛ. «0 находок» на пустой выборке — не результат (PROGRESS.md 4.1).
   * Файлов в `src/` сотни, и выражения в них есть; если сканер вдруг
   * увидел мало, он сломан, а не чист.
   */
  if (files.length < 100) {
    console.error(`check:no-lookbehind — просмотрено файлов ${files.length}: выборка не собралась`);
    return 1;
  }
  let regexes = 0;
  const findings: Finding[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const clean = withoutComments(source);
    regexes += (clean.match(/new RegExp\(/g) ?? []).length;
    findings.push(...findingsIn(relative(process.cwd(), file), source));
  }
  if (regexes < 5) {
    console.error(`check:no-lookbehind — вызовов new RegExp найдено ${regexes}: сканер читает не то`);
    return 1;
  }
  if (findings.length) {
    console.error("ПРОСМОТР НАЗАД В `src/` — на движке без ES2018 это SyntaxError на построении:");
    for (const f of findings) console.error(`  ${f.file}:${f.line} — ${f.feature} … ${f.excerpt}`);
    return 1;
  }
  console.log(
    `check:no-lookbehind — файлов ${files.length}, вызовов new RegExp ${regexes}: просмотров назад 0.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main();
}
