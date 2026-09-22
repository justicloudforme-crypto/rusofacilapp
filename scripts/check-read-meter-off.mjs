#!/usr/bin/env node
/**
 * ПРИБОР ПОДСЧЁТА ЧТЕНИЙ НЕ ВКЛЮЧАЕТСЯ НА ВЫКАТЕ.
 *
 * Заход 7.222 положил в `src/lib/db.ts` обёртку адаптера, считающую
 * походы в базу (`db-read-meter.ts`). Она выключена, пока не задана
 * переменная `MEASURE_DB_READS`, и это половина правила: вторая половина —
 * чтобы переменная не могла появиться на выкате.
 *
 * Цена включения названа честно: каждый поход в базу дописывал бы строку
 * в файл СИНХРОННО (`appendFileSync`), то есть держал бы обработчик
 * запроса на диске. На ноутбуке это незаметно, на боевой функции — нет.
 *
 * Правила:
 *   1. `MEASURE_DB_READS` не упоминается ни в `vercel.json`, ни в
 *      `next.config.ts`, ни в строке `build` из `package.json`, ни в
 *      заданиях `.github/workflows/**` — то есть нигде, откуда она могла
 *      бы попасть в выкат или в проверку;
 *   2. `db.ts` по-прежнему зовёт `meterAdapter` — иначе прибора нет
 *      вовсе, и первое правило охраняло бы пустоту.
 *
 *   node scripts/check-read-meter-off.mjs
 *   node scripts/check-read-meter-off.mjs --plant
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const VAR = "MEASURE_DB_READS";

export function filesToScan() {
  const list = ["vercel.json", "next.config.ts", "package.json"];
  const wf = path.join(".github", "workflows");
  if (existsSync(wf)) for (const f of readdirSync(wf)) list.push(path.join(wf, f));
  return list.filter((f) => existsSync(f));
}

export function offences(files) {
  const bad = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(VAR)) continue;
    // Единственное разрешённое упоминание — имя самого сторожа в списке
    // проверок: без него правило нельзя было бы поставить в строй.
    const lines = text.split("\n").filter((line) => line.includes(VAR));
    for (const line of lines) {
      if (/check:read-meter-off/.test(line)) continue;
      bad.push(`${file}: ${line.trim()}`);
    }
  }
  return bad;
}

export function meterIsWired(source) {
  return /meterAdapter\(/.test(source);
}

function main() {
  const plant = process.argv.includes("--plant");
  const files = filesToScan();
  const dbSource = readFileSync(path.join("src", "lib", "db.ts"), "utf8");

  if (plant) {
    let caught = 0;
    const planted = [...files, "ПОДСАЖЕННЫЙ.yml"];
    const readAll = offences(files);
    if (readAll.length !== 0) {
      console.error("✗ отрицательный контроль провален: на живых файлах уже есть нарушения");
      process.exit(1);
    }
    // Подсадка 1: переменная в настоящей строке рабочего задания.
    const fake = `jobs:\n  build:\n    env:\n      ${VAR}: /tmp/leak.jsonl\n`;
    const fakeOffences = fake.split("\n").filter((l) => l.includes(VAR) && !/check:read-meter-off/.test(l));
    if (fakeOffences.length > 0) caught++;
    else console.error("✗ НЕ ПОЙМАНО: переменная в задании CI");
    // Подсадка 2: прибор выдернут из db.ts.
    if (!meterIsWired(dbSource.replace("meterAdapter(adapter)", "adapter"))) caught++;
    else console.error("✗ НЕ ПОЙМАНО: прибор выдернут из db.ts");
    // Отрицательный контроль к подсадке 2.
    if (!meterIsWired(dbSource)) {
      console.error("✗ отрицательный контроль: прибор не найден в живом db.ts");
      process.exit(1);
    }
    console.log(`Control passed: подсажено 2, поймано ${caught}; на живых файлах (${planted.length - 1}) — молчит.`);
    process.exit(caught === 2 ? 0 : 1);
  }

  const bad = offences(files);
  if (!meterIsWired(dbSource)) {
    console.error("✗ src/lib/db.ts больше не зовёт meterAdapter — мерить нечем, и правило ниже охраняет пустоту");
    process.exit(1);
  }
  if (bad.length > 0) {
    console.error(`✗ ${VAR} задаётся там, откуда может попасть на выкат:`);
    for (const line of bad) console.error(`    ${line}`);
    process.exit(1);
  }
  console.log(`check:read-meter-off: ${VAR} не задан ни в одном из ${files.length} файлов; прибор в db.ts на месте.`);
  process.exit(0);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) main();
