/**
 * «ДАННЫХ ЕЩЁ НЕТ» ≠ «ДАННЫХ НОЛЬ» — сторож долгов 224 и 231 (7.204).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Два дефекта владельца оказались одним классом:
 *
 *   224 — серверная отдача `/es/vocabulary` печатала 23 плитки с
 *         `data-bank-total="0"` и подписью «0 palabras»; заглушек в ней
 *         не было ни одной, настоящие числа приходили после гидратации.
 *         TTFB на проде 1,30 с — три-четыре секунды человек читал не
 *         «ещё грузится», а неверный ФАКТ.
 *   231 — страница идиом печатала «Aprendidas: 0 de 0» («Изучено: 0 из
 *         0») до ответа `/api/idioms`, при том что СПИСОК под полосой в
 *         ту же секунду показывал скелет.
 *
 * В обоих случаях экран называл ЧИСЛОМ то, чего ещё не знал. Заглушка
 * для оболочки уже была написана (7.196), но включалась она только
 * внутри оболочки: `!nativeShell || …`. Правило распространено на веб.
 *
 * НАСТОЯЩИЙ НОЛЬ ПО-ПРЕЖНЕМУ ПЕЧАТАЕТСЯ ЧИСЛОМ. Условия смотрят на то,
 * ПРИШЁЛ ЛИ ОТВЕТ и про тот ли он разрез, а не на величину.
 *
 * ====================================================================
 * ЧЕТЫРЕ МЕСТА, И КАЖДОЕ ПАДАЕТ ОТДЕЛЬНО
 * ====================================================================
 *
 *   CategoryGrid   — число на плитке за `ready`, и `ready` не ослаблен
 *                    признаком оболочки;
 *   ContinueStrip  — числа строки «Продолжить» за `ready`, так же;
 *   IdiomsList     — полоса освоенного и её подпись за `idiomsLoading`;
 *   FlashcardsApp  — счётчик «N из M» внутри темы за `progressReady`.
 *
 *   node scripts/check-zero-placeholder.mjs          # гейт
 *   node scripts/check-zero-placeholder.mjs --plant  # положительный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const GRID = "src/components/flashcards/CategoryGrid.tsx";
const STRIP = "src/components/flashcards/ContinueStrip.tsx";
const IDIOMS = "src/components/flashcards/IdiomsList.tsx";
const CARDS = "src/components/flashcards/FlashcardsApp.tsx";
export const FILES = [GRID, STRIP, IDIOMS, CARDS];

/** Комментарии вычёркиваются: в этих файлах правило объяснено словами, и
 *  слова содержат и `nativeShell`, и «0». */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(read) {
  const bad = [];
  const grid = stripComments(read(GRID));
  const strip = stripComments(read(STRIP));
  const idioms = stripComments(read(IDIOMS));
  const cards = stripComments(read(CARDS));

  const readyLine = /const ready = ([^;]+);/.exec(grid)?.[1] ?? "";
  if (!readyLine) bad.push(`${GRID}: признака \`ready\` нет вовсе — сторож ослеп, а не доволен`);
  else if (/nativeShell/.test(readyLine)) {
    bad.push(`${GRID}: \`ready\` ослаблен признаком оболочки — в вебе плитка снова напечатает «0 слов» до ответа (долг 224)`);
  }
  if (!/ready \? \(/.test(grid) || !/tile-count-skeleton/.test(grid)) {
    bad.push(`${GRID}: число на плитке печатается мимо заглушки`);
  }

  const showLine = /const showNumbers = ([^;]+);/.exec(strip)?.[1] ?? "";
  if (!showLine) bad.push(`${STRIP}: признака \`showNumbers\` нет вовсе — сторож ослеп`);
  else if (/nativeShell/.test(showLine)) {
    bad.push(`${STRIP}: числа «Продолжить» в вебе печатаются до ответа (долг 224)`);
  }

  // Судится РОВНО блок полосы (`ref={listTopRef}`), а не файл целиком:
  // скелет списка под полосой стоял там и до правки, и совпадение с ним
  // означало бы, что сторож доволен чужим местом.
  const barAt = idioms.indexOf("ref={listTopRef}");
  const bar = barAt === -1 ? "" : idioms.slice(barAt, idioms.indexOf("</div>", barAt));
  if (!bar) {
    bad.push(`${IDIOMS}: блока полосы освоенного нет вовсе — сторож ослеп, а не доволен`);
  } else {
    const gateAt = bar.indexOf("idiomsLoading ? (");
    const elseAt = bar.indexOf(") : (");
    const labelAt = bar.indexOf("dict.progressLabel");
    if (gateAt === -1 || !/idioms-progress-skeleton/.test(bar)) {
      bad.push(`${IDIOMS}: полоса освоенного рисуется безусловно — до ответа это «0 из 0» (долг 231)`);
    } else if (elseAt === -1 || labelAt === -1 || labelAt < elseAt) {
      bad.push(`${IDIOMS}: подпись с числами стоит не в ветке «ответ пришёл» (долг 231)`);
    }
  }

  if (!/progressReady \? \(/.test(cards) || !/progress-count-skeleton/.test(cards)) {
    bad.push(`${CARDS}: счётчик «N из M» внутри темы печатается до ответа`);
  }
  return bad;
}

const realRead = (file) => readFileSync(file, "utf8");

function plant() {
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(realRead).length === 0 }];
  const planted = (name, file, from, to, expect) => {
    const mutated = realRead(file).replace(from, to);
    if (mutated === realRead(file)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    const read = (f) => (f === file ? mutated : realRead(f));
    cases.push({ name, ok: violations(read).some((v) => v.includes(expect)) });
  };

  planted(
    "подсадка: вернуть плиткам «0 слов» в вебе — поймана",
    GRID,
    "const ready = summaryLevel !== undefined",
    "const ready = !nativeShell || summaryLevel !== undefined",
    "ослаблен признаком оболочки",
  );
  planted(
    "подсадка: вернуть числа «Продолжить» в вебе до ответа — поймана",
    STRIP,
    "const showNumbers = ready;",
    "const showNumbers = !nativeShell || ready;",
    "«Продолжить» в вебе",
  );
  planted(
    "подсадка: вернуть «Aprendidas: 0 de 0» — поймана",
    IDIOMS,
    "{idiomsLoading ? (",
    "{false ? (",
    "рисуется безусловно",
  );
  planted(
    "подсадка: отнять заглушку у счётчика темы — поймана",
    CARDS,
    "{progressReady ? (",
    "{true ? (",
    "«N из M»",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:zero-placeholder --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violations(realRead);
  if (bad.length) {
    console.error("СЧЁТЧИК СНОВА ПЕЧАТАЕТ НОЛЬ ДО ТОГО, КАК УЗНАЛ ЧИСЛО (долги 224 и 231):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`[check:zero-placeholder] ${FILES.length} места: до ответа — заглушка, после — число, включая честный ноль (контроль — --plant).`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
