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
 * ====================================================================
 * ЧТО ДОБАВЛЕНО 18.09.2026 — ДОЛГИ 257, 259, 260
 * ====================================================================
 *
 * Тот же класс, только причина у молчания другая: экран не ждал ответа, а
 * НАМЕРЕННО не показывал того, что знает, — потому что смотрели его
 * браузером, а не приложением. Замер 18.09.2026 на прод-сборке назвал цену
 * числами: на `/vocabulary?level=C1` внутри оболочки стоят 23 короны, 23
 * замка и сумма чисел на плитках 988, а в браузере у тех же ролей — 0, 0 и
 * 0; на пустом экране темы честную причину показывали 8 экранов из 32.
 *
 * Решение владельца 18.09.2026: браузер говорит то же, что приложение.
 * Поэтому здесь сторожатся ЧЕТЫРЕ ветки, каждая падает отдельно:
 *
 *   257 — `CategoryGrid`: перепись банка и плашка закрытого не спрашивают
 *         `nativeShell` ни в числе, ни в знаке, ни в плашке;
 *   259 — `LockedOrEmpty`: причина «закрыто» не спрятана за оболочкой;
 *         `MatchApp`: пустой экран идёт через тот же общий компонент, а не
 *         печатает «недостаточно слов» сам;
 *   260 — `ContinueStrip`: знаменатель не спрашивает `nativeShell`.
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
/** Общий пустой экран словаря — тот, что печатает причину (долг 259). */
const EMPTY = "src/components/flashcards/FreeTrialLimitBanner.tsx";
/** Режим «Emparejar» — единственное место, печатавшее «недостаточно слов». */
const MATCH = "src/components/flashcards/MatchApp.tsx";
export const FILES = [GRID, STRIP, IDIOMS, CARDS, EMPTY, MATCH];

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

  // ── ДОЛГ 257: сетка тем говорит одно и то же в браузере и в приложении ──
  // Ищется ЧТЕНИЕ признака оболочки, а не слово: `nativeShell: true` в
  // вызове `accessSignFor` — имя опции общего правила, а не ветка (см.
  // комментарий у самого вызова).
  if (/useIsNativeShell/.test(grid) || /\bnativeShell\s*(&&|\?|\))/.test(grid)) {
    bad.push(
      `${GRID}: в сетке тем снова появилась ветка оболочки — в браузере раздел C1 опять станет ` +
        `пустым на вид (долг 257, замер 18.09.2026: 23 короны против 0)`,
    );
  }
  const totalLine = /const total = ([^;]+);/.exec(grid)?.[1] ?? "";
  if (!totalLine) bad.push(`${GRID}: числа на плитке нет вовсе — сторож ослеп, а не доволен`);
  else if (!/bankHere > 0 \? bankHere/.test(totalLine)) {
    bad.push(`${GRID}: плитка печатает не перепись банка — «0 слов» при непустом банке вернётся (долг 257)`);
  }
  if (!/\{ready && lockedAtLevel > 0 && \(/.test(grid)) {
    bad.push(`${GRID}: плашка закрытого уровня рисуется по другому условию — её снова не увидит браузер (долг 257)`);
  }

  // ── ДОЛГ 260: знаменатель «Продолжить» один на оба места ──
  const denomLine = /const denominator = ([^;]+);/.exec(strip)?.[1] ?? "";
  if (!denomLine) bad.push(`${STRIP}: знаменателя строки «Продолжить» нет вовсе — сторож ослеп`);
  else if (/nativeShell/.test(denomLine)) {
    bad.push(`${STRIP}: знаменатель «Продолжить» снова зависит от оболочки (долг 260)`);
  } else if (!/item\.total > 0 \? item\.total/.test(denomLine)) {
    bad.push(
      `${STRIP}: знаменатель «Продолжить» считается не по открытому — «0/266» рядом с «0 de 230» ` +
        `вернётся (долг 260)`,
    );
  }

  // ── ДОЛГ 259: причина «закрыто» не спрятана за оболочкой ──
  const empty = stripComments(read(EMPTY));
  const emptyAt = empty.indexOf("export function LockedOrEmpty");
  const emptyBody = emptyAt === -1 ? "" : empty.slice(emptyAt);
  if (!emptyBody) {
    bad.push(`${EMPTY}: общего пустого экрана словаря нет вовсе — сторож ослеп, а не доволен`);
  } else if (!/\n  if \(lockedHere > 0\) \{/.test(emptyBody)) {
    bad.push(
      `${EMPTY}: причина «материал есть и закрыт» снова за признаком оболочки — в браузере вернётся ` +
        `«Нет карточек для этого фильтра» при непустом банке (долг 259)`,
    );
  }
  const match = stripComments(read(MATCH));
  if (!/<LockedOrEmpty/.test(match) || !/emptyMessage=\{dict\.notEnoughCardsMessage\}/.test(match)) {
    bad.push(
      `${MATCH}: «недостаточно слов для этого фильтра» печатается мимо общего пустого экрана — ` +
        `причина снова умолчана (долг 259)`,
    );
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
  planted(
    "подсадка: вернуть сетке тем ветку оболочки — поймана (долг 257)",
    GRID,
    "const total = bankHere > 0 ? bankHere : openHere;",
    "const nativeShell = false; const total = nativeShell && bankHere > 0 ? bankHere : openHere;",
    "ветка оболочки",
  );
  planted(
    "подсадка: плитка снова печатает доступное вместо банка — поймана (долг 257)",
    GRID,
    "const total = bankHere > 0 ? bankHere : openHere;",
    "const total = openHere;",
    "не перепись банка",
  );
  planted(
    "подсадка: плашку закрытого уровня снова прячут — поймана (долг 257)",
    GRID,
    "{ready && lockedAtLevel > 0 && (",
    "{false && ready && lockedAtLevel > 0 && (",
    "плашка закрытого уровня",
  );
  planted(
    "подсадка: знаменатель «Продолжить» снова считает банк — поймана (долг 260)",
    STRIP,
    "const denominator = item.total > 0 ? item.total : item.bankTotal;",
    "const denominator = item.bankTotal > 0 ? item.bankTotal : item.total;",
    "не по открытому",
  );
  planted(
    "подсадка: причину «закрыто» снова прячут за оболочкой — поймана (долг 259)",
    EMPTY,
    "\n  if (lockedHere > 0) {",
    "\n  if (nativeShell && lockedHere > 0) {",
    "снова за признаком оболочки",
  );
  planted(
    "подсадка: «Emparejar» снова печатает «недостаточно слов» сам — поймана (долг 259)",
    MATCH,
    "emptyMessage={dict.notEnoughCardsMessage}",
    "emptyMessage={dict.instructionLabel}",
    "мимо общего пустого экрана",
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
