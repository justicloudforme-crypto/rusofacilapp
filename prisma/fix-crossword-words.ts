/**
 * ЗАМЕНА ОДНОГО СЛОВА В ОДНОМ КРОССВОРДЕ. По умолчанию НИЧЕГО НЕ ПИШЕТ.
 *
 * Случай, ради которого написано: в пазле лежат два одинаковых слова,
 * различающиеся только написанием («свекровь» и «свёкровь» в B1/167), и
 * одно из них надо заменить другим — не перекладывая пазл заново и не
 * трогая остальные 1261.
 *
 * Замена делается на месте и обязана быть НЕЗАМЕТНОЙ для соседей:
 *
 *  1. Длина нового слова равна длине старого — иначе клетки уехали бы.
 *  2. На каждой клетке, которую слово делит с другим словом, буква
 *     обязана СОВПАСТЬ со старой. Пересечение — утверждение о списке
 *     слов, и молча переписать чужую букву значит сломать соседа.
 *  3. Клетки, которые слово занимает единолично, переписываются.
 *  4. Новое слово есть в банке карточек (`FlashcardCard.russian`,
 *     нормализация «ё»/регистр) и ещё не встречается в этом пазле.
 *
 * После правки строка прогоняется через тот же `auditCrossword`, что и
 * `check:crosswords`: если правка что-то сломала, скрипт краснеет ДО
 * записи, а не после. Запись — одним `update` в транзакции.
 *
 * Прогресс не трогается: `WordGameProgress` ссылается на пазл целиком
 * (`puzzleId`), а не на слово, и id строки не меняется.
 *
 * Использование:
 *   npm run db:fix-crossword-words -- --plan=prisma/data/fix-crossword-words-2026-09-02.json
 *   npm run db:fix-crossword-words -- --plan=… --apply
 *   npm run db:fix-crossword-words -- --self-test
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { auditCrossword, normalizeBankWord } from "../src/lib/word-games/crossword-audit";
import type { WordPlacement } from "../src/lib/word-games/types";

interface Replacement {
  type: string;
  level: string;
  sequence: number;
  /** Слово, которое убираем — ровно как оно лежит в пазле. */
  replace: string;
  /** Слово, которое ставим на его место. */
  with: string;
  /** Новая подсказка (испанская фраза с ______). */
  clue: string;
  reason: string;
}

interface GridData {
  size: number;
  grid: string[][];
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const PLAN = arg("plan");
const APPLY = process.argv.includes("--apply");
const SELF_TEST = process.argv.includes("--self-test");

export interface PlanResult {
  ok: boolean;
  notes: string[];
  grid: string[][];
  words: WordPlacement[];
}

/**
 * Чистое ядро: считает новую сетку и новый список слов, проверяя все
 * четыре условия выше. Ни базы, ни файлов — поэтому у правила есть
 * позитивный контроль, а не только живой прогон.
 */
export function planReplacement(
  grid: string[][],
  words: WordPlacement[],
  item: Replacement,
  bank: Set<string>,
): PlanResult {
  const notes: string[] = [];
  const target = words.find((w) => w.word === item.replace);
  if (!target) {
    return { ok: false, notes: [`слова «${item.replace}» в пазле нет`], grid, words };
  }
  const oldLetters = [...item.replace];
  const newLetters = [...item.with];
  if (oldLetters.length !== newLetters.length) {
    return {
      ok: false,
      notes: [`длина не совпадает: «${item.replace}» ${oldLetters.length}, «${item.with}» ${newLetters.length}`],
      grid,
      words,
    };
  }
  if (bank.size > 0 && !bank.has(normalizeBankWord(item.with))) {
    return { ok: false, notes: [`слова «${item.with}» нет в банке карточек`], grid, words };
  }
  if (words.some((w) => w !== target && normalizeBankWord(w.word) === normalizeBankWord(item.with))) {
    return { ok: false, notes: [`«${item.with}» уже есть в этом пазле`], grid, words };
  }

  const dr = target.direction === "S" ? 1 : 0;
  const dc = target.direction === "E" ? 1 : 0;
  if (dr === 0 && dc === 0) {
    return { ok: false, notes: [`направление «${target.direction}» не E и не S`], grid, words };
  }

  // Клетки, занятые ДРУГИМИ словами: там буква меняться не имеет права.
  const sharedCells = new Set<string>();
  for (const w of words) {
    if (w === target) continue;
    const wdr = w.direction === "S" ? 1 : 0;
    const wdc = w.direction === "E" ? 1 : 0;
    [...w.word].forEach((_, i) => sharedCells.add(`${w.row + wdr * i},${w.col + wdc * i}`));
  }

  const nextGrid = grid.map((row) => [...row]);
  for (let i = 0; i < newLetters.length; i += 1) {
    const row = target.row + dr * i;
    const col = target.col + dc * i;
    const key = `${row},${col}`;
    if (sharedCells.has(key)) {
      if (normalizeBankWord(newLetters[i]) !== normalizeBankWord(oldLetters[i])) {
        return {
          ok: false,
          notes: [`клетка ${key} общая с другим словом: было «${oldLetters[i]}», стало бы «${newLetters[i]}»`],
          grid,
          words,
        };
      }
      notes.push(`клетка ${key} общая — буква «${oldLetters[i]}» сохранена`);
      continue;
    }
    notes.push(`клетка ${key}: «${grid[row]?.[col] ?? ""}» → «${newLetters[i]}»`);
    nextGrid[row][col] = newLetters[i];
  }

  const nextWords = words.map((w) =>
    w === target ? { ...w, word: item.with, clue: item.clue } : w,
  );
  return { ok: true, notes, grid: nextGrid, words: nextWords };
}

/** Позитивный контроль: подсадка, которая обязана быть отвергнута. */
function selfTest(): boolean {
  const grid = [
    ["с", "в", "е", "к", "р", "о", "в", "ь"],
    ["", "", "", "", "", "л", "", ""],
  ];
  const words: WordPlacement[] = [
    { word: "свекровь", clue: "c1", row: 0, col: 0, direction: "E" },
    { word: "ол", clue: "c2", row: 0, col: 5, direction: "S" },
  ];
  const bank = new Set(["свекровь", "ол", "алкоголь", "пуховик"]);
  const base: Replacement = {
    type: "CROSSWORD", level: "B1", sequence: 1,
    replace: "свекровь", with: "алкоголь", clue: "Él no bebe ______.", reason: "тест",
  };
  const good = planReplacement(grid, words, base, bank);
  const wrongLength = planReplacement(grid, words, { ...base, with: "пуховик" }, bank);
  const notInBank = planReplacement(grid, words, { ...base, with: "абвгдежз" }, bank);
  const breaksCross = planReplacement(grid, words, { ...base, with: "абвгдежз" }, new Set([...bank, "абвгдежз"]));
  const missing = planReplacement(grid, words, { ...base, replace: "которого нет" }, bank);

  const checks: [string, boolean][] = [
    ["годная замена принимается", good.ok],
    ["буква на пересечении сохранена", good.grid[0][5] === "о" && good.grid[0][6] === "л"],
    ["исходная сетка не изменена на месте", grid[0][6] === "в"],
    ["замена другой длины отвергнута", !wrongLength.ok],
    ["слово вне банка отвергнуто", !notInBank.ok],
    ["замена, ломающая пересечение, отвергнута", !breaksCross.ok],
    ["отсутствующее слово отвергнуто", !missing.ok],
  ];
  let ok = true;
  console.log("ПОЗИТИВНЫЙ КОНТРОЛЬ (--self-test)");
  for (const [name, passed] of checks) {
    ok &&= passed;
    console.log(`  ${passed ? "ok  " : "ПРОВАЛ"} ${name}`);
  }
  return ok;
}

async function main(): Promise<void> {
  if (SELF_TEST) {
    if (!selfTest()) process.exitCode = 1;
    return;
  }
  if (!PLAN) {
    console.error("Нужен --plan=<файл.json> со списком замен.");
    process.exitCode = 1;
    return;
  }
  const plan = JSON.parse(readFileSync(PLAN, "utf8")) as Replacement[];
  if (!Array.isArray(plan) || plan.length === 0) {
    console.error(`План ${PLAN} пуст или не массив.`);
    process.exitCode = 1;
    return;
  }
  if (!selfTest()) {
    console.error("Контроль не прошёл — прогон остановлен до чтения базы.");
    process.exitCode = 1;
    return;
  }

  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
  console.log(`\nбаза: ${process.env.TURSO_DATABASE_URL ? "ПРОД" : dbUrl.split("?")[0]}`);

  const bank = new Set(
    (await db.flashcardCard.findMany({ select: { russian: true } })).map((c) => normalizeBankWord(c.russian)),
  );
  let failed = false;
  const updates: { id: string; gridData: string; words: string }[] = [];

  for (const item of plan) {
    const row = await db.wordGamePuzzle.findFirst({
      where: { type: item.type, level: item.level, sequence: item.sequence },
    });
    console.log(`\n${item.type} ${item.level}/${item.sequence}: «${item.replace}» → «${item.with}»`);
    console.log(`  причина: ${item.reason}`);
    if (!row) {
      console.log("  ОТКАЗ: строки нет");
      failed = true;
      continue;
    }
    const gridData = JSON.parse(row.gridData as unknown as string) as GridData;
    const words = JSON.parse(row.words as unknown as string) as WordPlacement[];
    const result = planReplacement(gridData.grid, words, item, bank);
    for (const note of result.notes) console.log(`  ${note}`);
    if (!result.ok) {
      console.log("  ОТКАЗ — ничего не пишем");
      failed = true;
      continue;
    }
    const after = auditCrossword(
      { id: row.id, level: row.level, sequence: row.sequence, grid: result.grid, words: result.words },
      bank,
    );
    console.log(
      `  аудит после правки: solvable ${after.solvable}, problems ${after.problems.length}, ` +
        `дублей после нормализации ${after.duplicateWordsNormalized.length}, ` +
        `слов вне банка ${after.wordsNotInBank.length}, изолированных ${after.isolatedWords.length}`,
    );
    for (const p of after.problems) console.log(`    проблема: ${p}`);
    if (!after.solvable || after.problems.length > 0 || after.duplicateWordsNormalized.length > 0 || after.wordsNotInBank.length > 0) {
      console.log("  ОТКАЗ: правка ухудшает пазл");
      failed = true;
      continue;
    }
    updates.push({
      id: row.id,
      gridData: JSON.stringify({ ...gridData, grid: result.grid }),
      words: JSON.stringify(result.words),
    });
  }

  if (failed) {
    console.log("\nЕсть отказы — не записано ничего.");
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }
  if (!APPLY) {
    console.log(`\n--dry-run (по умолчанию): ${updates.length} строк(и) готовы, в базу ничего не записано.`);
    console.log("  Записать: тот же вызов с --apply");
    await db.$disconnect();
    return;
  }
  await db.$transaction(
    updates.map((u) => db.wordGamePuzzle.update({ where: { id: u.id }, data: { gridData: u.gridData, words: u.words } })),
  );
  console.log(`\nЗаписано строк: ${updates.length}.`);
  await db.$disconnect();
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
