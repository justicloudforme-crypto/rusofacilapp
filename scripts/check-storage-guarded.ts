/**
 * ХРАНИЛИЩЕ БРАУЗЕРА ТРОГАЕТ ОДИН ФАЙЛ — СТОРОЖ.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * `window.localStorage` и `window.sessionStorage` бросают исключение в
 * четырёх ОБЫЧНЫХ положениях дел: приватное окно Safari, запрещённые
 * данные сайта, политика устройства, переполнение квоты. В браузере с
 * запрещёнными данными бросает уже само обращение к свойству — до
 * `getItem`. Отказ хранилища поэтому не исключительная ситуация, а
 * штатная, и обрабатываться обязан один раз, а не в каждом месте.
 *
 * Перепись 18.09.2026 (заход 7.211, задача 2) — числа ДО правки:
 * обращений в `src/` **24**, из них под `try/catch` **18**, без защиты
 * **6** в трёх файлах:
 *
 *   src/lib/sound.ts:30,35                      — долг 261
 *   src/components/lesson/ExercisesTab.tsx:92,169 — долг 262
 *   src/components/DevServiceWorkerCleanup.tsx:50,51 — долг 263
 *
 * Третье место найдено этой же переписью: перепись 7.210 называла три
 * места, а долгами были заведены только два.
 *
 * ====================================================================
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ
 * ====================================================================
 *
 * Правило одно и без градаций: **имена `localStorage` и
 * `sessionStorage` встречаются в `src/` ровно в одном файле —
 * `src/lib/safe-storage.ts`**. Не «под try/catch», а «в обёртке»:
 * `try/catch` у каждого места — это и есть те три разных решения, от
 * которых заводились долги 261–263. Список разрешённых исключений
 * поимённый и сегодня пуст — пустой список не может соврать молча.
 *
 * Разбор идёт ПО ДЕРЕВУ TypeScript, а не подстрокой: слова
 * `localStorage` полны комментарии этого репозитория (одних только
 * упоминаний в прозе — больше сорока), и поиск подстрокой дал бы
 * ложный красный, который чинят удалением сторожа.
 *
 *   npx tsx scripts/check-storage-guarded.ts
 *   npx tsx scripts/check-storage-guarded.ts --plant
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { isEntryPoint } from "../src/lib/entry-point";

const SRC = join(process.cwd(), "src");

/** Единственный файл, которому обращаться к хранилищу можно. */
const WRAPPER = join("src", "lib", "safe-storage.ts");

/** Поимённые исключения. Пуст намеренно: список, в который что-то
 *  кладут молча, перестаёт быть проверкой. */
const ALLOWED_EXTRA: string[] = [];

const NAMES = new Set(["localStorage", "sessionStorage"]);

export interface Finding {
  file: string;
  line: number;
  name: string;
  excerpt: string;
}

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

/** Все обращения к хранилищу в одном исходнике. Считаются ТОЛЬКО
 *  идентификаторы — не строки, не комментарии, не имена типов. */
export function accessesIn(file: string, source: string): Finding[] {
  const out: Finding[] = [];
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines = source.split("\n");
  const walk = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && NAMES.has(node.text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      out.push({ file, line, name: node.text, excerpt: (lines[line - 1] ?? "").trim().slice(0, 120) });
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(sf, walk);
  return out;
}

function isAllowed(relPath: string): boolean {
  const normalised = relPath.split(sep).join("/");
  return normalised === WRAPPER.split(sep).join("/") || ALLOWED_EXTRA.includes(normalised);
}

export function main(): number {
  const plant = process.argv.includes("--plant");
  const files = sourceFiles(SRC);

  if (plant) {
    let ok = true;
    const say = (good: boolean, text: string) => {
      console.log(`  ${good ? "верно" : "ОШИБКА"} — ${text}`);
      if (!good) ok = false;
    };

    // Отрицательный контроль: здоровое дерево обязано молчать.
    const healthy = files
      .map((f) => ({ rel: relative(process.cwd(), f), file: f }))
      .filter((f) => !isAllowed(f.rel))
      .flatMap((f) => accessesIn(f.rel, readFileSync(f.file, "utf8")));
    say(healthy.length === 0, `ОТРИЦАТЕЛЬНЫЙ контроль: здоровое дерево, находок ${healthy.length}`);

    // 1. голое обращение в настоящем файле
    const victim = join(SRC, "components", "lesson", "ExercisesTab.tsx");
    const victimRel = relative(process.cwd(), victim);
    const victimSrc = readFileSync(victim, "utf8");
    const planted1 = victimSrc.replace(
      "const alreadyPassed = exercises.length === 0 || readLocal(storageKey) === \"1\";",
      "const alreadyPassed = exercises.length === 0 || window.localStorage.getItem(storageKey) === \"1\";",
    );
    const found1 = accessesIn(victimRel, planted1);
    say(
      planted1 !== victimSrc && found1.length === 1,
      `голое обращение возвращено в ${victimRel}: находок ${found1.length}` +
        (found1.length ? ` (строка ${found1[0].line})` : ""),
    );

    // 2. обращение ПОД try/catch — тоже отказ: правило про обёртку, а не про try
    const planted2 = victimSrc.replace(
      "const alreadyPassed = exercises.length === 0 || readLocal(storageKey) === \"1\";",
      "let v: string | null = null; try { v = window.localStorage.getItem(storageKey); } catch {}\n    const alreadyPassed = exercises.length === 0 || v === \"1\";",
    );
    const found2 = accessesIn(victimRel, planted2);
    say(found2.length === 1, `обращение ПОД try/catch — тоже находка: ${found2.length}`);

    // 3. sessionStorage в другом файле
    const victim3 = join(SRC, "lib", "translation-store.ts");
    const rel3 = relative(process.cwd(), victim3);
    const src3 = readFileSync(victim3, "utf8");
    const planted3 = src3.replace(
      "    const raw = readSession(STORAGE_KEY);",
      "    const raw = window.sessionStorage.getItem(STORAGE_KEY);",
    );
    const found3 = accessesIn(rel3, planted3);
    say(planted3 !== src3 && found3.length === 1, `sessionStorage возвращён в ${rel3}: находок ${found3.length}`);

    // 4. ОТРИЦАТЕЛЬНЫЙ: слово в комментарии, в строке и в чужом имени — не отказ
    const innocent = [
      "// localStorage тут только назван словом, обращения нет",
      'const label = "localStorage";',
      "const localStorageKey = 'x';",
      "const sessionStorageWarning = 1;",
      "/* sessionStorage в прозе */",
      "console.log(localStorageKey, label, sessionStorageWarning);",
    ].join("\n");
    const found4 = accessesIn("<подсадка>.ts", innocent);
    say(found4.length === 0, `слово в комментарии, в строке и внутри чужого имени — не отказ: находок ${found4.length}`);

    // 5. сам файл-обёртка обязан быть РАЗРЕШЁН, но видим сканеру
    const wrapperHits = accessesIn(WRAPPER, readFileSync(join(process.cwd(), WRAPPER), "utf8"));
    const bothNames = new Set(wrapperHits.map((h) => h.name));
    say(
      bothNames.size === 2 && isAllowed(WRAPPER),
      `обёртка видна сканеру и разрешена: обращений ${wrapperHits.length}, имён ${[...bothNames].sort().join(" и ") || "нет"}`,
    );

    console.log(
      ok
        ? "check:storage-guarded --plant — 4 из 4 подсадок, 2 из 2 отрицательных контроля"
        : "check:storage-guarded --plant — FAILED",
    );
    return ok ? 0 : 1;
  }

  /** ПОЛ. «0 находок» на несобравшейся выборке — не результат (правило 4.1). */
  if (files.length < 100) {
    console.error(`check:storage-guarded — просмотрено файлов ${files.length}: выборка не собралась`);
    return 1;
  }
  const wrapperPath = join(process.cwd(), WRAPPER);
  const wrapperHits = accessesIn(WRAPPER, readFileSync(wrapperPath, "utf8"));
  const inWrapper = wrapperHits.length;
  /** ПОЛ ВТОРОЙ, и он важнее первого: сканер обязан ВИДЕТЬ оба имени там,
   *  где они точно есть. Без него «мимо обёртки 0» означало бы ровно то
   *  же самое и у сломанного сканера. */
  const namesInWrapper = new Set(wrapperHits.map((h) => h.name));
  if (namesInWrapper.size !== 2) {
    console.error(
      `check:storage-guarded — в обёртке ${WRAPPER} видно имён ${namesInWrapper.size} из 2 ` +
        `(${[...namesInWrapper].sort().join(", ") || "ни одного"}): сканер читает не то либо обёртка исчезла`,
    );
    return 1;
  }

  const findings: Finding[] = [];
  for (const file of files) {
    const rel = relative(process.cwd(), file);
    if (isAllowed(rel)) continue;
    const source = readFileSync(file, "utf8");
    if (!/localStorage|sessionStorage/.test(source)) continue;
    findings.push(...accessesIn(rel, source));
  }

  if (findings.length) {
    console.error(
      "ОБРАЩЕНИЕ К ХРАНИЛИЩУ МИМО ОБЁРТКИ. Отказ хранилища — обычное положение дел\n" +
        `(приватное окно, запрет данных сайта, политика, квота); одно решение живёт в ${WRAPPER}:`,
    );
    for (const f of findings) console.error(`  ${f.file}:${f.line} — ${f.name} … ${f.excerpt}`);
    return 1;
  }
  console.log(
    `check:storage-guarded — файлов ${files.length}, обращений в обёртке ${inWrapper}, ` +
      `мимо обёртки 0, исключений ${ALLOWED_EXTRA.length}.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main();
}
