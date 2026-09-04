/**
 * Целостность и плотность филвордов (Sopa de Letras) — солвер плюс
 * геометрия по всему банку пазлов. CHECK ONLY, ничего не пишет.
 *
 * Что меряется на каждый WORD_SEARCH-пазл:
 *
 *  1. Найдено ли каждое слово В САМОЙ СЕТКЕ — прямой линией в одном из 8
 *     направлений (для ★/curved — гнутым 8-связным путём без повторов
 *     клеток). Координаты, записанные генератором, здесь намеренно НЕ
 *     читаются: игрок их не видит, и расхождение сетки с координатами —
 *     ровно тот дефект, который надо поймать.
 *  2. Совпадают ли записанные координаты с сеткой (`placementMismatches`).
 *     Это отдельный вопрос от пункта 1 и отдельная колонка.
 *  3. ГЕОМЕТРИЯ, считается по записанным координатам: занятых клеток в
 *     процентах, распределение перекрытий (сколько клеток принадлежат 1,
 *     2, 3, 4+ словам) и доля клеток-заполнителей.
 *
 * Почему геометрия, а не прежняя «плотность». Прежнее число — сумма длин
 * слов ÷ клетки — считает общую клетку столько раз, сколько слов через неё
 * проходит, поэтому у совершенно обычного пазла вылезало за 100%. Занятые
 * клетки за 100% выйти не могут по построению; перекрытия вынесены в
 * отдельное распределение, а не размазаны по одному числу.
 *
 * Снимок несёт ОТПЕЧАТОК БАНКА (хэш отсортированных id строк). Прогон
 * начинается со сверки отпечатка: снимок, снятый с другого банка,
 * останавливает проверку со словами «сравнение с другим банком» и не
 * печатает ни строки про «стало хуже» — сравнивать пазл с чужим тёзкой
 * под тем же номером бессмысленно. Дыра, которую это закрывает, стоила
 * 918 ложных регрессий (PROGRESS.md 7.81).
 *
 * Порог — src/lib/word-games/density.ts, там же обоснование цифрами.
 * Порог ОТЧЁТНЫЙ. Падает проверка не по нему, а по снимку: пазл не имеет
 * права стать хуже, чем он уже есть (--baseline).
 *
 * Позитивный контроль встроен в каждый прогон. Плюс --plant подсаживает в
 * просматриваемый набор пазл с перекрытием 4 и нулём заполнителей:
 * прогон обязан его поймать, а прогон БЕЗ флага обязан о нём молчать.
 *
 * ДВЕ КОМАНДЫ, И ЭТО РАЗНЫЕ ВОПРОСЫ (разведено 02.09.2026, PROGRESS 7.84):
 *
 *   npm run check:word-search          — «цел ли банк, который лежит вот
 *       здесь»: солвер, координаты, геометрия. Читает ту базу, на которую
 *       указывает окружение (без ключа — локальная `dev.db`). Со снимком
 *       НЕ сравнивается вовсе, поэтому зелёная без боевого ключа. Входит
 *       в `npm run verify`.
 *
 *   npm run check:word-search:prod     — «совпадает ли банк с продовым
 *       снимком»: отпечаток плюс «ни один пазл не стал хуже». Вопрос про
 *       ПРОД, поэтому без `TURSO_DATABASE_URL` он не «пропускается» и не
 *       «зелёный вакуумно», а падает вслух. В `verify` НЕ входит.
 *
 * Так разведено потому, что после 7.83 снимок описывает прод, а `dev.db`
 * держал другой банк — и `verify` на машине без ключа был красным всегда,
 * то есть переставал быть сигналом. Целостность банка от наличия ключа не
 * зависит; сверка с продом зависит целиком.
 *
 * Использование:
 *   npm run check:word-search
 *   npm run check:word-search -- --plant        # подсадка, обязана быть поймана
 *   npm run check:word-search -- --self-test    # только контроль, без банка
 *   npm run check:word-search -- --write-baseline=docs/…json
 *   npm run check:word-search -- --baseline=docs/…json
 *   npm run check:word-search:prod              # требует ключ, иначе падает
 *   npm run check:word-search:prod -- --plant   # подсадка в прод-прогоне
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run check:word-search
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import {
  auditPuzzle,
  puzzleInputFromRow,
  type PuzzleAudit,
  type PuzzleInput,
} from "../src/lib/word-games/word-search-audit";
import {
  PROD_BASELINE_PATH,
  bankFingerprint,
  fingerprintMismatch,
  isLegacyBaseline,
  type BankFingerprint,
  type BaselineFile,
} from "../src/lib/word-games/bank-fingerprint";
import {
  MAX_WORDS_PER_CELL,
  OCCUPANCY_LIMIT,
  SEVERE_OCCUPANCY,
  exceedsThreshold,
  isSevere,
  severity,
  worstFirst,
} from "../src/lib/word-games/density";
import type { WordPlacement } from "../src/lib/word-games/types";

/**
 * Снимок ПРОДА — с той базы, которую видят игроки, и которая объявлена
 * эталоном. Он больше не подставляется по умолчанию: его берёт только
 * прод-прогон (`--against-prod`, он же `npm run check:word-search:prod`)
 * либо явный `--baseline=`.
 *
 * Прогон против чужого банка по-прежнему падает со словами «СРАВНЕНИЕ С
 * ДРУГИМ БАНКОМ» — это ровно тот контроль, ради которого отпечаток и
 * вводился. Локальный банк со своим снимком сверяют явно:
 *   npm run check:word-search -- --baseline=<снимок с dev.db>
 *
 * Дата в имени файла — это дата СНИМКА, а не дата какой-либо записи, и
 * она обязана двигаться вместе с ним: снимок от 02.09 пережил запись
 * порции 1 коридора (03.09) и три дня подряд называл «стало хуже» ровно
 * те 115 строк, которые порция и привела в коридор 45–65%. Имя, которое
 * отстаёт от содержимого, — это и есть та мина; поэтому файл переименован
 * вместе с пересъёмом, а константа ниже прибита к пути и переименована с
 * ним (04.09.2026).
 *
 * Перезаписывать этот снимок — только с прода и только после успешной
 * записи в прод:
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npm run check:word-search -- --write-baseline=docs/word-search-baseline-prod-2026-09-04.json
 */
const PROD_BASELINE = PROD_BASELINE_PATH;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const PLANT = process.argv.includes("--plant");
const SELF_TEST_ONLY = process.argv.includes("--self-test");
const WRITE_BASELINE = arg("write-baseline");
/**
 * Прогон «против прода»: сверка с продовым снимком плюс требование ключа.
 * Отдельный флаг, а не просто `--baseline=`, потому что вопрос «совпадает
 * ли банк с продом» без ключа не имеет ответа — и молчаливый пропуск здесь
 * хуже красного: он выглядит как «сошлось».
 */
const AGAINST_PROD = process.argv.includes("--against-prod");
/**
 * Снимок берётся ТОЛЬКО когда его попросили явно (`--baseline=`) или когда
 * идёт прод-прогон. Умолчания нет намеренно: снимок описывает прод, а
 * обычный прогон читает ту базу, что под рукой, и сравнивать их по
 * умолчанию — это и есть тот красный `verify` без ключа, ради которого
 * команды и разведены.
 */
const BASELINE = arg("baseline") ?? (AGAINST_PROD ? PROD_BASELINE : null);
const SHOW_GRIDS = process.argv.includes("--grids");
const WORST_COUNT = Number(arg("worst") ?? 10);

/* ------------------------------------------------------------------ */
/* Контрольные пазлы                                                   */
/* ------------------------------------------------------------------ */

const CONTROL_GRID = [
  ["к", "о", "т", "а", "б", "в"],
  ["г", "д", "е", "ж", "з", "и"],
  ["д", "о", "м", "к", "л", "м"],
  ["н", "о", "п", "р", "с", "т"],
  ["с", "ы", "р", "у", "ф", "х"],
  ["ц", "ч", "ш", "щ", "ъ", "ы"],
];

/** Нормальный пазл: 6×6, три слова по строкам, ничего не пересекается. */
function cleanControl(): PuzzleInput {
  return {
    id: "control-clean",
    level: "A1",
    sequence: 0,
    curved: false,
    grid: CONTROL_GRID,
    words: [
      { word: "кот", row: 0, col: 0, direction: "E" },
      { word: "дом", row: 2, col: 0, direction: "E" },
      { word: "сыр", row: 4, col: 0, direction: "E" },
    ],
  };
}

/** Тот же пазл, но одно слово из списка в сетке отсутствует. */
function missingWordControl(): PuzzleInput {
  const base = cleanControl();
  return {
    ...base,
    id: "control-missing",
    words: [...base.words, { word: "лиса", row: 5, col: 5, direction: "E" }],
  };
}

/** Слово, которое физически не помещается: 15 букв в сетке 6×6. Ловится
 * сразу двумя способами — по длине и по тому, что записанные координаты
 * не складываются в слово (они уходят за край). */
function overfullControl(): PuzzleInput {
  const base = cleanControl();
  return {
    ...base,
    id: "control-overfull",
    words: [
      { word: "дееспособность", row: 0, col: 0, direction: "E" },
      { word: "конституционный", row: 0, col: 0, direction: "S" },
      ...base.words,
    ],
  };
}

/**
 * ПОДСАДКА (--plant): 3×3, четыре слова через одну и ту же центральную
 * клетку, ни одной клетки-заполнителя. Занятость 100%, перекрытие 4 —
 * оба порога нарушены сразу, и оба записанных размещения настоящие
 * (координаты реально складываются в слова), чтобы проверка ловила его
 * геометрией, а не как битую строку.
 */
function plantedControl(): PuzzleInput {
  return {
    id: "PLANTED-overlap4-nofiller",
    level: "A1",
    sequence: 9999,
    curved: false,
    grid: [
      ["а", "б", "в"],
      ["г", "х", "д"],
      ["е", "ж", "з"],
    ],
    words: [
      { word: "гхд", row: 1, col: 0, direction: "E" },
      { word: "бхж", row: 0, col: 1, direction: "S" },
      { word: "ахз", row: 0, col: 0, direction: "SE" },
      { word: "вхе", row: 0, col: 2, direction: "SW" },
    ] as WordPlacement[],
  };
}

interface ControlOutcome {
  label: string;
  passed: boolean;
  detail: string;
}

function runControls(): ControlOutcome[] {
  const out: ControlOutcome[] = [];

  const clean = auditPuzzle(cleanControl());
  out.push({
    label: "нормальный пазл — проверка обязана промолчать",
    passed:
      clean.missing.length === 0 &&
      clean.undecided.length === 0 &&
      clean.placementMismatches.length === 0 &&
      !exceedsThreshold(clean),
    detail: `ненайденных ${clean.missing.length}, занято ${pct(clean.occupancy)}, заполнителей ${pct(clean.fillerShare)}, макс. слов на клетку ${clean.maxOverlap}`,
  });

  const missing = auditPuzzle(missingWordControl());
  out.push({
    label: "слово, которого нет в сетке — обязана поймать",
    passed: missing.missing.length === 1 && missing.missing[0] === "лиса",
    detail: `поймано: ${missing.missing.join(", ") || "ничего"}`,
  });

  const overfull = auditPuzzle(overfullControl());
  out.push({
    label: "слово длиннее сетки — обязана поймать и по длине, и по координатам",
    passed:
      overfull.impossibleByLength &&
      overfull.missing.length === 2 &&
      overfull.placementMismatches.length === 2,
    detail: `длиннейшее ${overfull.longestLength} букв при сетке ${overfull.rows}×${overfull.cols}, ненайденных ${overfull.missing.length}, координат не сходится ${overfull.placementMismatches.length}`,
  });

  // Занятость выше порога на настоящих координатах — отдельный случай от
  // подсадки ниже: там её поднимает перекрытие, здесь просто плотная
  // укладка. Без него «выше порога» проверялось бы ровно одним способом.
  const packed = auditPuzzle({
    id: "control-packed",
    level: "A1",
    sequence: 0,
    curved: false,
    grid: CONTROL_GRID,
    words: [
      { word: "котабв", row: 0, col: 0, direction: "E" },
      { word: "гдежзи", row: 1, col: 0, direction: "E" },
      { word: "домклм", row: 2, col: 0, direction: "E" },
      { word: "нопрст", row: 3, col: 0, direction: "E" },
      { word: "сыруфх", row: 4, col: 0, direction: "E" },
    ],
  });
  out.push({
    label: "плотная укладка без перекрытий — порог обязан её отвергнуть по занятости",
    passed: packed.maxOverlap === 1 && packed.occupancy > OCCUPANCY_LIMIT && exceedsThreshold(packed),
    detail: `занято ${pct(packed.occupancy)}, макс. слов на клетку ${packed.maxOverlap}`,
  });

  const curvedClean = auditPuzzle({ ...cleanControl(), id: "control-curved", curved: true });
  const curvedMissing = auditPuzzle({ ...missingWordControl(), id: "control-curved-missing", curved: true });
  out.push({
    label: "★ (гнутый путь) — молчит на нормальном, ловит подсаженное",
    passed: curvedClean.missing.length === 0 && curvedMissing.missing.length === 1,
    detail: `нормальный: ${curvedClean.missing.length}, подсаженный: ${curvedMissing.missing.join(", ") || "ничего"}`,
  });

  const planted = auditPuzzle(plantedControl());
  out.push({
    label: "подсадка «перекрытие 4, нуль заполнителей» — порог обязан её отвергнуть",
    passed:
      planted.maxOverlap === 4 &&
      planted.fillerCells === 0 &&
      planted.placementMismatches.length === 0 &&
      isSevere(planted),
    detail: `занято ${pct(planted.occupancy)}, заполнителей ${planted.fillerCells}, распределение ${JSON.stringify(planted.overlap)}`,
  });

  // Негативная половина того же контроля: подсадка обязана отличаться от
  // нормального пазла НЕ только по занятости. Если поменять только
  // заполнители, перекрытие обязано остаться прежним.
  const plantedNoOverlap = auditPuzzle({
    ...plantedControl(),
    id: "control-plant-negative",
    words: [{ word: "гхд", row: 1, col: 0, direction: "E" }],
  });
  out.push({
    label: "негативный контроль: одно слово в той же сетке — перекрытия нет",
    passed: plantedNoOverlap.maxOverlap === 1 && plantedNoOverlap.fillerCells === 6,
    detail: `макс. слов на клетку ${plantedNoOverlap.maxOverlap}, заполнителей ${plantedNoOverlap.fillerCells}`,
  });

  return out;
}

/* ------------------------------------------------------------------ */

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function key(a: { level: string; sequence: number }): string {
  return `WORD_SEARCH/${a.level}/${a.sequence}`;
}

interface BaselineEntry {
  occupancy: number;
  maxOverlap: number;
  severity: number;
}

function toBaseline(audits: PuzzleAudit[]): Record<string, BaselineEntry> {
  const out: Record<string, BaselineEntry> = {};
  for (const a of worstFirst(audits)) {
    out[key(a)] = {
      occupancy: Number(a.occupancy.toFixed(4)),
      maxOverlap: a.maxOverlap,
      severity: Number(severity(a).toFixed(4)),
    };
  }
  return out;
}

/** Куда снят снимок — только для чтения человеком. Токен сюда попасть
 * не может: из URL берётся хост, из локального пути — сам путь. */
function sourceLabel(url: string): string {
  if (!url.startsWith("libsql://") && !url.startsWith("https://")) return url;
  try {
    return new URL(url).host;
  } catch {
    return "libsql";
  }
}

/** Пазл стал ХУЖЕ снимка. Допуск 0.5 п.п. занятости — снимок хранит
 * округлённые числа, и пазл, который никто не трогал, не должен падать на
 * четвёртом знаке. Перекрытие целое, поэтому сравнивается точно. */
function regressions(audits: PuzzleAudit[], baseline: Record<string, BaselineEntry>) {
  const worse: string[] = [];
  const unknown: string[] = [];
  for (const a of audits) {
    const before = baseline[key(a)];
    if (!before) {
      unknown.push(key(a));
      continue;
    }
    if (a.occupancy > before.occupancy + 0.005) {
      worse.push(`${key(a)}: занято ${pct(before.occupancy)} → ${pct(a.occupancy)}`);
    } else if (a.maxOverlap > before.maxOverlap) {
      worse.push(`${key(a)}: слов на клетку ${before.maxOverlap} → ${a.maxOverlap}`);
    }
  }
  return { worse, unknown };
}

function gridLines(input: PuzzleInput): string[] {
  return input.grid.map((row) => row.join(""));
}

function report(audits: PuzzleAudit[], inputs: Map<string, PuzzleInput>): boolean {
  const broken = audits.filter((a) => a.missing.length > 0);
  const undecided = audits.filter((a) => a.undecided.length > 0);
  const mismatched = audits.filter((a) => a.placementMismatches.length > 0);
  const flagged = audits.filter((a) => exceedsThreshold(a));
  const severe = audits.filter((a) => isSevere(a));

  console.log(`\nПазлов WORD_SEARCH: ${audits.length} (★/curved: ${audits.filter((a) => a.curved).length})`);
  console.log(`С ненайденными словами:            ${broken.length}`);
  console.log(`Не решено (упёрлось в предел):     ${undecided.length}`);
  console.log(`Координаты расходятся с сеткой:    ${mismatched.length}`);
  console.log(
    `Выше порога (занято > ${pct(OCCUPANCY_LIMIT)} или > ${MAX_WORDS_PER_CELL} слов на клетку): ${flagged.length} (${pct(flagged.length / audits.length)})`,
  );
  console.log(`  из них тяжёлых (занято > ${pct(SEVERE_OCCUPANCY)} или ≥ 4 слов на клетку): ${severe.length}`);

  console.log(`\nЗанятость по уровням (средняя / выше порога / ≥4 слов на клетку):`);
  for (const level of ["A1", "A2", "B1", "B2", "C1"]) {
    const g = audits.filter((a) => a.level === level);
    if (g.length === 0) continue;
    const mean = g.reduce((s, a) => s + a.occupancy, 0) / g.length;
    console.log(
      `  ${level}: n=${String(g.length).padEnd(4)} занято ${pct(mean).padEnd(7)} выше порога ${String(g.filter(exceedsThreshold).length).padEnd(4)} перекрытие≥4 ${g.filter((a) => a.maxOverlap >= 4).length}`,
    );
  }

  console.log(`\nРаспределение «сколько слов на самой загруженной клетке»:`);
  for (const n of [1, 2, 3, 4]) {
    const g = audits.filter((a) => (n === 4 ? a.maxOverlap >= 4 : a.maxOverlap === n));
    console.log(`  ${n === 4 ? "4+" : n}: ${g.length}`);
  }

  console.log(`\nГде новая метрика расходится со старой плотностью:`);
  console.log(`  старая > 100%, но не больше 2 слов на клетку: ${audits.filter((a) => a.density > 1 && a.maxOverlap <= 2).length}`);
  console.log(`  старая ≤ 70%, но 4 слова на клетку:           ${audits.filter((a) => a.density <= 0.7 && a.maxOverlap >= 4).length}`);
  console.log(`  старая > 65%, но по новому порогу здоров:     ${audits.filter((a) => a.density > 0.65 && !exceedsThreshold(a)).length}`);
  console.log(`  старая ≤ 65%, но по новому порогу нездоров:   ${audits.filter((a) => a.density <= 0.65 && exceedsThreshold(a)).length}`);

  const worst = worstFirst(audits).slice(0, WORST_COUNT);
  console.log(`\nХудшие ${worst.length} по новой метрике:`);
  console.log(`  уровень/рунг   слов  занято  заполн.  1/2/3/4+ клеток        тяжесть  старая`);
  for (const a of worst) {
    console.log(
      `  ${`${a.level}/${a.sequence}`.padEnd(13)} ${String(a.wordCount).padEnd(5)} ${pct(a.occupancy).padEnd(7)} ${pct(a.fillerShare).padEnd(8)} ${`${a.overlap.one}/${a.overlap.two}/${a.overlap.three}/${a.overlap.fourPlus}`.padEnd(21)} ${severity(a).toFixed(3).padEnd(8)} ${pct(a.density)}`,
    );
  }

  if (SHOW_GRIDS) {
    for (const a of worst) {
      const input = inputs.get(a.id);
      console.log(`\n=== ${a.level}/${a.sequence} (${a.id}) ===`);
      console.log(`слова: ${input?.words.map((w) => w.word).join(", ")}`);
      for (const line of gridLines(input!)) console.log(`  ${line}`);
    }
  }

  if (broken.length > 0) {
    console.log(`\nПазлы с ненайденными словами:`);
    for (const a of broken.slice(0, 50)) console.log(`  ${key(a)}: ${a.missing.join(", ")}`);
    if (broken.length > 50) console.log(`  … и ещё ${broken.length - 50}`);
  }
  if (undecided.length > 0) {
    console.log(`\nНе доказано ни в одну сторону (гнутый поиск упёрся в предел шагов):`);
    for (const a of undecided) console.log(`  ${key(a)}: ${a.undecided.join(", ")}`);
  }
  if (mismatched.length > 0) {
    console.log(`\nЗаписанные координаты не складываются в слово:`);
    for (const a of mismatched.slice(0, 50)) console.log(`  ${key(a)}: ${a.placementMismatches.join(", ")}`);
  }

  return broken.length === 0 && undecided.length === 0 && mismatched.length === 0;
}

async function main() {
  console.log("Позитивный контроль:");
  const controls = runControls();
  for (const c of controls) console.log(`  ${c.passed ? "OK  " : "ПРОВАЛ"} ${c.label} — ${c.detail}`);
  if (controls.some((c) => !c.passed)) {
    console.error("\nКонтроль не пройден — прогону по банку верить нельзя.");
    process.exitCode = 1;
    return;
  }
  if (SELF_TEST_ONLY) {
    console.log("\nТолько контроль (--self-test), банк не читался.");
    return;
  }

  // Прод-прогон без ключа обязан падать ВСЛУХ. Пропустить сверку с продом
  // молча — значит выдать «нечего было сравнивать» за «сошлось»; ровно
  // этого разведение команд и избегает.
  if (AGAINST_PROD && !process.env.TURSO_DATABASE_URL) {
    console.error(
      "\nСВЕРКА С ПРОДОМ НЕВОЗМОЖНА: не задан TURSO_DATABASE_URL.\n" +
        "  Эта команда отвечает на вопрос «совпадает ли банк с продовым снимком»,\n" +
        "  и без боевого ключа у него нет ответа. Она не пропускается и не\n" +
        "  считается зелёной — она падает.\n" +
        "  Целостность локального банка (солвер, координаты, геометрия) меряет\n" +
        "  другая команда, и ключ ей не нужен: npm run check:word-search",
    );
    process.exitCode = 1;
    return;
  }

  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = new PrismaClient({ adapter });
  try {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type: "WORD_SEARCH" },
      select: { id: true, level: true, sequence: true, curved: true, gridData: true, words: true },
      orderBy: [{ level: "asc" }, { sequence: "asc" }],
    });
    if (rows.length === 0) {
      console.error("\nВ базе нет ни одного WORD_SEARCH — сравнивать нечего, это не «0 проблем».");
      process.exitCode = 1;
      return;
    }

    const parsed = rows.map((row) => ({ row, input: puzzleInputFromRow(row) }));
    const unreadable = parsed.filter((p) => p.input === null);
    if (unreadable.length > 0) {
      console.error(`\nСтрок с нечитаемым JSON: ${unreadable.length}`);
      for (const u of unreadable.slice(0, 20)) console.error(`  ${u.row.level}/${u.row.sequence} (${u.row.id})`);
    }

    const inputs = new Map<string, PuzzleInput>();
    for (const p of parsed) if (p.input) inputs.set(p.input.id, p.input);
    if (PLANT) {
      const planted = plantedControl();
      inputs.set(planted.id, planted);
      console.log(`\n--plant: в набор подсажен ${key(planted)} (${planted.id}).`);
    }

    const audits = [...inputs.values()].map(auditPuzzle);
    const ok = report(audits, inputs);

    // Подсадка обязана быть поймана — и обязана отсутствовать без флага.
    const plantedAudit = audits.find((a) => a.id === plantedControl().id);
    if (PLANT) {
      if (!plantedAudit || !isSevere(plantedAudit)) {
        console.error("\nПОДСАДКА НЕ ПОЙМАНА — порог не видит перекрытие 4 при нуле заполнителей.");
        process.exitCode = 1;
        return;
      }
      console.log(`\nПОДСАДКА ПОЙМАНА: ${key(plantedAudit)} занято ${pct(plantedAudit.occupancy)}, слов на клетку ${plantedAudit.maxOverlap}.`);
      console.log("Это прогон с подсадкой — он обязан быть красным.");
      process.exitCode = 1;
      return;
    }
    if (plantedAudit) {
      console.error("\nПодсаженный пазл найден в прогоне БЕЗ --plant — контроль протёк в банк.");
      process.exitCode = 1;
      return;
    }

    const fingerprint = bankFingerprint(rows);

    if (WRITE_BASELINE) {
      const file: BaselineFile<BaselineEntry> = {
        source: sourceLabel(dbUrl),
        takenAt: new Date().toISOString().slice(0, 10),
        bank: fingerprint,
        puzzles: toBaseline(audits),
      };
      writeFileSync(WRITE_BASELINE, `${JSON.stringify(file, null, 1)}\n`, "utf8");
      console.log(
        `\nСнимок записан: ${WRITE_BASELINE} (${audits.length} пазлов, банк ${file.source}, ` +
          `отпечаток ${fingerprint.idsSha256.slice(0, 12)}…).`,
      );
    } else if (BASELINE) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(BASELINE, "utf8"));
      } catch {
        console.error(`\nСнимок ${BASELINE} не читается — сравнивать не с чем.`);
        process.exitCode = 1;
        return;
      }
      if (isLegacyBaseline(parsed)) {
        console.error(
          `\nСнимок ${BASELINE} старого формата: в нём нет отпечатка банка, ` +
            `поэтому он не умеет отличить свой банк от чужого — ровно та дыра, ` +
            `которая один раз уже выдала 918 ложных «стало хуже». ` +
            `Переснимите: npm run check:word-search -- --write-baseline=${BASELINE}`,
        );
        process.exitCode = 1;
        return;
      }
      const file = parsed as BaselineFile<BaselineEntry>;
      const reasons = fingerprintMismatch(file.bank as BankFingerprint, fingerprint);
      if (reasons.length > 0) {
        console.error(`\nСРАВНЕНИЕ С ДРУГИМ БАНКОМ — снимок ${BASELINE} снят не с этой базы.`);
        console.error(`  снимок: ${file.source}, снят ${file.takenAt}`);
        console.error(`  база:   ${sourceLabel(dbUrl)}`);
        for (const r of reasons) console.error(`  · ${r}`);
        console.error(
          `  Пазлы НЕ сравнивались: под одним номером в снимке и в базе разные пазлы, ` +
            `и «стало хуже» про них было бы ложью. Возьмите снимок того банка, ` +
            `против которого идёт прогон.`,
        );
        process.exitCode = 1;
        return;
      }
      const baseline = file.puzzles;
      const { worse, unknown } = regressions(audits, baseline);
      console.log(
        `\nОтпечаток банка сошёлся со снимком ${BASELINE} (${file.source}, ${file.takenAt}, ` +
          `${fingerprint.puzzles} строк, ${fingerprint.idsSha256.slice(0, 12)}…).`,
      );
      console.log(`\nСравнение со снимком ${BASELINE} (${Object.keys(baseline).length} пазлов):`);
      console.log(`  стало хуже: ${worse.length}`);
      console.log(`  нет в снимке (появились после него): ${unknown.length}`);
      if (unknown.length > 0) {
        for (const u of unknown.slice(0, 20)) console.log(`    ${u}`);
        if (unknown.length > 20) console.log(`    … и ещё ${unknown.length - 20}`);
      }
      for (const w of worse) console.error(`  ХУЖЕ  ${w}`);
      if (worse.length > 0) process.exitCode = 1;
    } else {
      // Сказать вслух, чего этот прогон НЕ делал. Молчание здесь читалось
      // бы как «со снимком сошлось».
      console.log(
        `\nСо снимком НЕ сравнивалось: это прогон целостности банка (${sourceLabel(dbUrl)}), ` +
          `отпечаток ${fingerprint.idsSha256.slice(0, 12)}….\n` +
          `  Сверка с продовым снимком — отдельная команда: npm run check:word-search:prod (нужен ключ).`,
      );
    }

    if (!ok || unreadable.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
