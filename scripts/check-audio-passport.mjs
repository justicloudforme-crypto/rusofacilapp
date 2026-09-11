/**
 * «Новый контент со звуком описан паспортом озвучки» — сторож захода 7.168.
 *
 * ЗАЧЕМ. Пять заходов подряд (7.163–7.168) закрывали один и тот же класс:
 * поверхность рисует орган «слушать», а записи для него никто не сделал,
 * и вместо неё звучал голос ОС. Каждый раз находка была ЗАМЕРОМ, а не
 * правилом: поверхностей 18, и ни один документ не говорил, чем каждая
 * озвучивается. `docs/audio-passport.md` это говорит; здесь проверяется,
 * что он не разошёлся с продуктом.
 *
 * ПРАВИЛО, асимметричное, как у `check:silent-listen`:
 *
 *   каждая поверхность, которую считает `check:listen-buttons`, ОБЯЗАНА
 *   быть названа в паспорте, а каждый скрипт озвучки, названный в
 *   паспорте, — существовать на диске.
 *
 *   Обратное правилом не является: паспорт вправе описывать и то, что
 *   кнопок не рисует (озвучка самих рассказов).
 *
 * Слепота — тоже отказ: прогон, в котором не найдено ни одной
 * поверхности или ни одной ссылки на скрипт, считается провалом, а не
 * чистым результатом (PROGRESS.md 4.1).
 *
 *   node scripts/check-audio-passport.mjs
 *   node scripts/check-audio-passport.mjs --plant
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PLANT = process.argv.includes("--plant");
const PASSPORT = join(ROOT, "docs", "audio-passport.md");
const GUARD = join(ROOT, "scripts", "check-listen-buttons.ts");

/** Поверхности, которым паспорт не нужен, — только вместе с причиной.
 *  Сегодня список пуст, и это записано в самом паспорте, раздел 10. */
const EXCEPTIONS = /** @type {Record<string, string>} */ ({});

/** Имена поверхностей из `BASELINE` сторожа переписи — источник правды. */
export function surfacesFromGuard(source) {
  const start = source.indexOf("const BASELINE: Record<string, [number, number]> = {");
  if (start === -1) return [];
  const end = source.indexOf("\n};", start);
  const block = source.slice(start, end === -1 ? undefined : end);
  return [...block.matchAll(/^\s*"([^"]+)":\s*\[/gmu)].map((m) => m[1]);
}

/** Поверхности, названные в паспорте: первый столбец его таблицы. */
export function surfacesFromPassport(source) {
  return [...source.matchAll(/^\|\s*([^|]+?)\s*\|/gmu)]
    .map((m) => m[1].trim())
    .filter((name) => name && !/^-+$/.test(name));
}

/** Ссылки на скрипты озвучки — `prisma/...ts` в обратных кавычках. */
export function scriptsFromPassport(source) {
  return [...new Set([...source.matchAll(/`(prisma\/[\w.-]+\.ts)`/gu)].map((m) => m[1]))];
}

function plant() {
  const guard = readFileSync(GUARD, "utf8");
  const passport = readFileSync(PASSPORT, "utf8");
  const surfaces = surfacesFromGuard(guard);
  const named = new Set(surfacesFromPassport(passport));
  const cases = [];
  cases.push({ name: "поверхности сторожа читаются (не пустое множество)", ok: surfaces.length >= 18 });
  cases.push({ name: "поверхности паспорта читаются (не пустое множество)", ok: named.size >= 18 });
  cases.push({
    name: "подсадка: поверхность, вычеркнутая из паспорта, ловится",
    ok: (() => {
      const broken = passport.replace(`| карточки: слово |`, `| карточки-слово |`);
      const left = new Set(surfacesFromPassport(broken));
      return surfaces.some((s) => !left.has(s));
    })(),
  });
  cases.push({
    name: "подсадка: новая поверхность в стороже без строки в паспорте ловится",
    ok: (() => {
      const broken = guard.replace(
        `const BASELINE: Record<string, [number, number]> = {`,
        `const BASELINE: Record<string, [number, number]> = {\n  "новая поверхность": [1, 1],`,
      );
      return surfacesFromGuard(broken).some((s) => !named.has(s));
    })(),
  });
  cases.push({
    name: "подсадка: несуществующий скрипт озвучки ловится",
    ok: !existsSync(join(ROOT, "prisma/generate-nothing-audio.ts")) &&
      scriptsFromPassport("`prisma/generate-nothing-audio.ts`").length === 1,
  });
  cases.push({
    name: "отрицательный контроль: строка-разделитель таблицы не считается поверхностью",
    ok: !surfacesFromPassport("| --- | --- |").length,
  });
  let caught = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) caught++;
  }
  console.log(`[check:audio-passport --plant] пройдено ${caught} из ${cases.length}`);
  return caught === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  if (!existsSync(PASSPORT)) {
    console.error("нет docs/audio-passport.md — новому контенту не по чему озвучиваться");
    return 1;
  }
  const passport = readFileSync(PASSPORT, "utf8");
  const surfaces = surfacesFromGuard(readFileSync(GUARD, "utf8"));
  const named = new Set(surfacesFromPassport(passport));
  const scripts = scriptsFromPassport(passport);
  if (surfaces.length === 0 || named.size === 0 || scripts.length === 0) {
    console.error(
      `проверять нечего: поверхностей сторожа ${surfaces.length}, поверхностей паспорта ${named.size}, ` +
        `скриптов озвучки ${scripts.length} — пустое множество результатом не считается`,
    );
    return 1;
  }
  const undocumented = surfaces.filter((s) => !named.has(s) && !(s in EXCEPTIONS));
  const missing = scripts.filter((s) => !existsSync(join(ROOT, s)));
  console.log(
    `[check:audio-passport] поверхностей со звуком ${surfaces.length}, описано ${surfaces.length - undocumented.length}, ` +
      `скриптов озвучки названо ${scripts.length}, из них живых ${scripts.length - missing.length}`,
  );
  if (undocumented.length) {
    console.error("\nПОВЕРХНОСТЬ СО ЗВУКОМ НЕ ОПИСАНА В docs/audio-passport.md:");
    for (const s of undocumented) console.error(`  ${s}`);
  }
  if (missing.length) {
    console.error("\nПАСПОРТ ССЫЛАЕТСЯ НА НЕСУЩЕСТВУЮЩИЙ СКРИПТ ОЗВУЧКИ:");
    for (const s of missing) console.error(`  ${s}`);
  }
  if (undocumented.length || missing.length) return 1;
  for (const [surface, why] of Object.entries(EXCEPTIONS)) console.log(`  исключение: ${surface} — ${why}`);
  console.log("нераскрытых поверхностей 0 (контроль — --plant).");
  return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts и инцидент 29.08.2026).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
