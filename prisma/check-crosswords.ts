/**
 * ЦЕЛОСТНОСТЬ КРОССВОРДОВ — разовый читающий прогон по всему банку.
 * CHECK ONLY: ничего не пишет, ни в базу, ни в файлы.
 *
 * Зачем отдельная команда. `check:word-search` покрывает ТОЛЬКО филворды
 * (`type = WORD_SEARCH`): её солвер ищет слово лучом в одном из восьми
 * направлений и ничего не знает ни про пересечения, ни про пустые клетки.
 * Кроссворды (`type = CROSSWORD`) не проверялись ни разу.
 *
 * Что меряется на каждый кроссворд:
 *
 *  1. РЕШЕНИЕ ЕСТЬ. Каждое слово лежит по своим координатам: направление
 *     только E (across) или S (down), клетки не выходят за край, длина
 *     слова совпадает с числом клеток, и буквы в сетке совпадают с
 *     буквами слова.
 *  2. ПЕРЕСЕЧЕНИЯ. Отдельно от сетки: если две записи занимают одну и ту
 *     же клетку, буква у обоих слов на этом месте обязана быть одна и та
 *     же. Это утверждение о СПИСКЕ СЛОВ, и оно проверяется без чтения
 *     сетки — иначе оба слова сверялись бы с одной и той же клеткой и
 *     любое расхождение было бы невидимо.
 *  3. СЕТКА СХОДИТСЯ С КООРДИНАТАМИ. Координаты генератора НЕ читаются
 *     как истина: считается множество клеток, занятых словами, и
 *     множество непустых клеток сетки. Лишняя буква в сетке (`orphan`) и
 *     пустая клетка под словом (`hole`) — оба дефекта. Это ровно тот
 *     класс, который в филвордах и искали (PROGRESS.md 7.77, 7.81).
 *  4. СЛОВА. Дубли внутри одного кроссворда и слова, которых нет в банке
 *     карточек (сверка по `FlashcardCard.russian`, нормализация: регистр
 *     и «ё» → «е», потому что банк держит «ёлка», а укладчик кладёт
 *     буквы как есть).
 *  5. ИЗОЛИРОВАННЫЕ СЛОВА. Слово, не делящее ни одной клетки ни с одним
 *     другим словом. В кроссворде это дыра в связности: такое слово
 *     нельзя вывести из пересечений, и на доске оно висит отдельно.
 *  6. РАСКЛАД: по уровням, по размерам сеток (высота×ширина, не только
 *     `size`: сетка кроссворда прямоугольная — см. crossword.ts, где
 *     `size = max(height, width)`), платность по `isFreeWordGamePuzzle`
 *     (а не по «sequence <= 10»: правило дополнительно исключает C1
 *     целиком) и колонка `premiumOnly` — включая проверку того, что
 *     хвост каждой лестницы платность НАСЛЕДУЕТ, а не обрывает.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ встроен в каждый прогон и печатается всегда: три
 * подсадки (битое пересечение, битая координата, лишняя буква в сетке)
 * обязаны быть пойманы, чистый контроль — пройти. Без этого «0 проблем»
 * не значит ничего (PROGRESS.md 4.1).
 *
 * Использование:
 *   npm run check:crosswords                     # база из окружения
 *   npm run check:crosswords -- --self-test      # только контроль
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run check:crosswords
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { isFreeWordGamePuzzle } from "../src/lib/word-games/free-tier";
import {
  auditCrossword,
  crosswordInputFromRow,
  normalizeBankWord,
  type CrosswordAudit,
  type CrosswordInput,
} from "../src/lib/word-games/crossword-audit";

const SELF_TEST_ONLY = process.argv.includes("--self-test");
/**
 * ПОДСАДКА В ЖИВОЙ БАНК. Синтетический контроль выше доказывает, что
 * правило умеет находить дефект в кроссворде, который я же и написал.
 * `--plant` доказывает большее: тот же дефект, посаженный в НАСТОЯЩУЮ
 * строку прода (в памяти, база не трогается), тоже находится — то есть
 * «0 проблем» получено не потому, что разбор живых строк молча
 * разваливается. Прогон БЕЗ флага обязан о подсадке молчать.
 */
const PLANT = process.argv.includes("--plant");
const SHOW = Number((process.argv.find((a) => a.startsWith("--show=")) ?? "--show=15").slice(7));

/* ------------------------------------------------------------------ */
/* Контрольные кроссворды                                             */
/* ------------------------------------------------------------------ */

/**
 * Чистый контроль: 5×5, два слова, одно настоящее пересечение.
 *
 *   к о т . .
 *   . к . . .
 *   . н . . .
 *   . о . . .
 *   . . . . .
 *
 * «кот» (0,0,E) и «окно» (0,1,S) делят клетку (0,1) — буква «о» у обоих.
 * Лишних букв в сетке нет, дыр под словами нет, изолированных слов нет.
 */
function cleanControl(): CrosswordInput {
  const grid = [
    ["к", "о", "т", "", ""],
    ["", "к", "", "", ""],
    ["", "н", "", "", ""],
    ["", "о", "", "", ""],
    ["", "", "", "", ""],
  ];
  return {
    id: "control-clean",
    level: "A1",
    sequence: 0,
    grid,
    words: [
      { word: "кот", row: 0, col: 0, direction: "E" },
      { word: "окно", row: 0, col: 1, direction: "S" },
    ],
  };
}

/** Подсадка 1: битое пересечение. Вертикальное слово заявляет в общей
 * клетке (0,1) букву «а», горизонтальное — «о». */
function brokenIntersectionControl(): CrosswordInput {
  const base = cleanControl();
  return {
    ...base,
    id: "control-broken-intersection",
    words: base.words.map((w) => (w.direction === "S" ? { ...w, word: "акно" } : w)),
  };
}

/** Подсадка 2: битая координата. «кот» сдвинут на клетку вправо — буквы
 * сетки под ним больше не складываются в слово. */
function brokenCoordinateControl(): CrosswordInput {
  const base = cleanControl();
  return {
    ...base,
    id: "control-broken-coordinate",
    words: base.words.map((w) => (w.word === "кот" ? { ...w, col: 1 } : w)),
  };
}

/** Подсадка 3: лишняя буква в сетке, не принадлежащая ни одному слову. */
function orphanLetterControl(): CrosswordInput {
  const base = cleanControl();
  const grid = base.grid.map((row) => [...row]);
  grid[2][4] = "щ";
  return { ...base, id: "control-orphan-letter", grid };
}

interface ControlCase {
  name: string;
  input: CrosswordInput;
  /** Какое поле аудита обязано быть непустым. */
  expect: (a: CrosswordAudit) => boolean;
}

const CONTROLS: ControlCase[] = [
  {
    name: "чистый кроссворд — обязан пройти",
    input: cleanControl(),
    expect: (a) => a.problems.length === 0,
  },
  {
    name: "битое пересечение — обязано быть поймано",
    input: brokenIntersectionControl(),
    expect: (a) => a.intersectionMismatches.length > 0,
  },
  {
    name: "битая координата — обязана быть поймана",
    input: brokenCoordinateControl(),
    expect: (a) => a.placementMismatches.length > 0,
  },
  {
    name: "лишняя буква в сетке — обязана быть поймана",
    input: orphanLetterControl(),
    expect: (a) => a.orphanCells > 0,
  },
];

function runControls(bank: Set<string>): boolean {
  console.log("\nПОЗИТИВНЫЙ КОНТРОЛЬ");
  let allOk = true;
  for (const c of CONTROLS) {
    const audit = auditCrossword(c.input, bank);
    const ok = c.expect(audit);
    allOk &&= ok;
    console.log(`  ${ok ? "ok  " : "ПРОВАЛ"} ${c.name}`);
    if (!ok) {
      console.log(`        проблемы: ${audit.problems.join("; ") || "нет"}`);
    }
  }
  return allOk;
}

/* ------------------------------------------------------------------ */

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${((n / total) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  // Слова контролей в банк карточек не входят: контроль проверяет
  // геометрию, а не словарь, и «нет в банке» у него ожидаемо.
  const controlBank = new Set(["кот", "окно", "акно"].map(normalizeBankWord));
  const controlsOk = runControls(controlBank);
  if (!controlsOk) {
    console.error("\nКОНТРОЛЬ НЕ ПРОЙДЕН — результатам прогона верить нельзя.");
    process.exitCode = 1;
    return;
  }
  if (SELF_TEST_ONLY) {
    console.log("\nТолько контроль (--self-test). Банк не читался.");
    return;
  }

  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = new PrismaClient({ adapter });

  try {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type: "CROSSWORD" },
      orderBy: [{ level: "asc" }, { sequence: "asc" }],
    });
    const cards = await db.flashcardCard.findMany({ select: { russian: true } });
    const bank = new Set(cards.map((c) => normalizeBankWord(c.russian)));

    console.log(
      `\nБАНК: ${rows.length} кроссвордов, ${cards.length} карточек ` +
        `(${dbUrl.startsWith("libsql") ? "ПРОД" : dbUrl})`,
    );

    const audits: CrosswordAudit[] = [];
    const broken: CrosswordInput[] = [];
    for (const row of rows) {
      const input = crosswordInputFromRow(row);
      if (!input) {
        broken.push({ id: row.id, level: row.level, sequence: row.sequence, grid: [], words: [] });
        continue;
      }
      audits.push(auditCrossword(input, bank));
    }

    // Подсадка в две первые живые строки: у одной ломается координата
    // (слово сдвигается на клетку), у другой — пересечение (буква слова
    // меняется на заведомо другую). Обе копии, оригиналы не трогаются.
    const planted: CrosswordAudit[] = [];
    if (PLANT) {
      const victims = rows.slice(0, 2).map(crosswordInputFromRow).filter((x): x is CrosswordInput => x !== null);
      if (victims.length === 2) {
        const shifted: CrosswordInput = {
          ...victims[0],
          id: `${victims[0].id}+сдвинутая-координата`,
          words: victims[0].words.map((w, i) => (i === 0 ? { ...w, col: w.col + 1 } : w)),
        };
        const conflicted: CrosswordInput = {
          ...victims[1],
          id: `${victims[1].id}+битое-пересечение`,
          words: victims[1].words.map((w, i) =>
            i === 0 ? { ...w, word: `ъ${[...w.word].slice(1).join("")}` } : w,
          ),
        };
        planted.push(auditCrossword(shifted, bank), auditCrossword(conflicted, bank));
        audits.push(...planted);
      }
    }

    const total = audits.length;
    const withPlacement = audits.filter((a) => a.placementMismatches.length > 0);
    const withIntersection = audits.filter((a) => a.intersectionMismatches.length > 0);
    const withLength = audits.filter((a) => a.lengthMismatches.length > 0);
    const withOrphan = audits.filter((a) => a.orphanCells > 0);
    const withHole = audits.filter((a) => a.holeCells > 0);
    const withDuplicates = audits.filter((a) => a.duplicateWords.length > 0);
    const withDuplicatesNormalized = audits.filter((a) => a.duplicateWordsNormalized.length > 0);
    const withUnknown = audits.filter((a) => a.wordsNotInBank.length > 0);
    const withIsolated = audits.filter((a) => a.isolatedWords.length > 0);
    const solvable = audits.filter((a) => a.solvable);

    console.log("\nРЕШЕНИЕ");
    console.log(`  строк, которые не разбираются вовсе        ${broken.length}`);
    console.log(`  кроссвордов с полным решением              ${solvable.length} / ${total} (${pct(solvable.length, total)})`);
    console.log(`  с расхождением координат и сетки           ${withPlacement.length}`);
    console.log(`  с расхождением длины слова и клеток        ${withLength.length}`);
    console.log(`  с несовпадением букв на пересечении        ${withIntersection.length}`);

    console.log("\nСЕТКА ПРОТИВ КООРДИНАТ");
    console.log(`  с лишними буквами в сетке (orphan)         ${withOrphan.length}`);
    console.log(`  с пустой клеткой под словом (hole)         ${withHole.length}`);

    console.log("\nСЛОВА");
    console.log(`  всего размещений                           ${audits.reduce((s, a) => s + a.wordCount, 0)}`);
    console.log(`  различных слов                             ${new Set(audits.flatMap((a) => a.words)).size}`);
    console.log(`  кроссвордов с дублем слова буква в букву    ${withDuplicates.length}`);
    console.log(`  то же после нормализации «ё» и регистра    ${withDuplicatesNormalized.length}`);
    console.log(`  кроссвордов со словом вне банка карточек   ${withUnknown.length}`);
    console.log(`  различных слов вне банка                   ${new Set(audits.flatMap((a) => a.wordsNotInBank)).size}`);
    console.log(`  кроссвордов с изолированным словом         ${withIsolated.length}`);
    console.log(`  изолированных слов всего                   ${audits.reduce((s, a) => s + a.isolatedWords.length, 0)}`);

    console.log("\nПО УРОВНЯМ");
    const levels = [...new Set(rows.map((r) => r.level))].sort();
    console.log("  уровень  всего  бесплатных  premiumOnly  макс.sequence");
    for (const level of levels) {
      const at = rows.filter((r) => r.level === level);
      const free = at.filter((r) => isFreeWordGamePuzzle(r)).length;
      const premium = at.filter((r) => r.premiumOnly).length;
      const maxSeq = Math.max(...at.map((r) => r.sequence));
      console.log(
        `  ${level.padEnd(8)} ${String(at.length).padStart(5)}  ${String(free).padStart(10)}  ${String(premium).padStart(11)}  ${String(maxSeq).padStart(13)}`,
      );
    }

    console.log("\nПО РАЗМЕРАМ СЕТОК (высота×ширина; сетка кроссворда прямоугольная)");
    const bySize = new Map<string, number>();
    for (const a of audits) bySize.set(`${a.height}×${a.width}`, (bySize.get(`${a.height}×${a.width}`) ?? 0) + 1);
    const areas = audits.map((a) => a.height * a.width).sort((x, y) => x - y);
    const sides = audits.map((a) => Math.max(a.height, a.width)).sort((x, y) => x - y);
    const median = (xs: number[]) => (xs.length === 0 ? 0 : xs[Math.floor(xs.length / 2)]);
    console.log(`  различных размеров                         ${bySize.size}`);
    console.log(`  длинная сторона: мин ${sides[0]}, медиана ${median(sides)}, макс ${sides[sides.length - 1]}`);
    console.log(`  площадь: мин ${areas[0]}, медиана ${median(areas)}, макс ${areas[areas.length - 1]}`);
    const buckets: [string, (n: number) => boolean][] = [
      ["до 12", (n) => n <= 12],
      ["13–20", (n) => n > 12 && n <= 20],
      ["21–30", (n) => n > 20 && n <= 30],
      ["31–40", (n) => n > 30 && n <= 40],
      ["больше 40", (n) => n > 40],
    ];
    for (const [name, test] of buckets) {
      const n = sides.filter(test).length;
      console.log(`  длинная сторона ${name.padEnd(10)} ${String(n).padStart(5)}  ${pct(n, total)}`);
    }
    console.log("  самые частые размеры:");
    for (const [key, n] of [...bySize.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
      console.log(`    ${key.padEnd(8)} ${String(n).padStart(4)}`);
    }
    console.log("  слов в кроссворде: " +
      `мин ${Math.min(...audits.map((a) => a.wordCount))}, ` +
      `медиана ${median(audits.map((a) => a.wordCount).sort((x, y) => x - y))}, ` +
      `макс ${Math.max(...audits.map((a) => a.wordCount))}`);

    console.log("\nПЛАТНОСТЬ");
    const freeRows = rows.filter((r) => isFreeWordGamePuzzle(r));
    console.log(`  бесплатных по isFreeWordGamePuzzle          ${freeRows.length} / ${rows.length} (${pct(freeRows.length, rows.length)})`);
    console.log(`  premiumOnly = true                         ${rows.filter((r) => r.premiumOnly).length}`);
    console.log(`  curved = true (у кроссворда обязан быть 0) ${rows.filter((r) => r.curved).length}`);
    const contradictions = rows.filter((r) => isFreeWordGamePuzzle(r) && r.premiumOnly);
    console.log(`  бесплатных И premiumOnly одновременно      ${contradictions.length}`);

    // Хвост лестницы: строки выше последней premiumOnly. Если платность
    // «оборвалась» — новые строки дописаны в хвост без флага, и самые
    // трудные рунги оказались бесплатнее средних.
    console.log("\nХВОСТ ЛЕСТНИЦ (наследование платности)");
    for (const level of levels) {
      const at = rows.filter((r) => r.level === level).sort((a, b) => a.sequence - b.sequence);
      const lastPremium = [...at].reverse().find((r) => r.premiumOnly);
      const tail = lastPremium ? at.filter((r) => r.sequence > lastPremium.sequence) : [];
      const gaps = at.filter((r, i) => i > 0 && r.sequence !== at[i - 1].sequence + 1);
      console.log(
        `  ${level.padEnd(4)} последний premiumOnly = ${lastPremium ? `#${lastPremium.sequence}` : "нет"}, ` +
          `после него ${tail.length} строк без флага, дыр в нумерации ${gaps.length}`,
      );
    }

    if (withDuplicatesNormalized.length > 0) {
      console.log("\nДУБЛИ СЛОВ ВНУТРИ ОДНОГО КРОССВОРДА (после нормализации «ё»)");
      for (const a of withDuplicatesNormalized) {
        const raw = a.words.filter((w) => a.duplicateWordsNormalized.includes(normalizeBankWord(w)));
        console.log(`  ${a.level}/${a.sequence} ${a.id}: ${raw.join(", ")}`);
      }
    }

    if (PLANT) {
      console.log("\nПОДСАДКА В ЖИВОЙ БАНК (--plant)");
      for (const a of planted) {
        const caught = a.problems.length > 0;
        console.log(`  ${caught ? "поймана" : "ПРОПУЩЕНА"}  ${a.id}`);
        for (const problem of a.problems.slice(0, 3)) console.log(`      ${problem}`);
      }
      if (planted.length !== 2 || planted.some((a) => a.problems.length === 0)) {
        console.error("  ПОДСАДКА НЕ ПОЙМАНА — прогон недействителен.");
        process.exitCode = 1;
      }
    }

    const flagged = audits
      .filter((a) => a.problems.length > 0)
      .sort((x, y) => y.problems.length - x.problems.length);
    if (flagged.length > 0) {
      console.log(`\nПРОБЛЕМНЫЕ КРОССВОРДЫ: ${flagged.length}. Первые ${Math.min(SHOW, flagged.length)}:`);
      for (const a of flagged.slice(0, SHOW)) {
        console.log(`  ${a.level}/${a.sequence} ${a.id}`);
        for (const p of a.problems.slice(0, 6)) console.log(`      ${p}`);
      }
    } else {
      console.log("\nПРОБЛЕМНЫХ КРОССВОРДОВ НЕТ (контроль выше показал, что проверка их находит).");
    }
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
