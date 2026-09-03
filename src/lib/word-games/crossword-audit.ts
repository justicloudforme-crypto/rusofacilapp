import type { WordGameGrid, WordPlacement, WordSearchDirection } from "./types";

/**
 * Аудит одного кроссворда. Чистая функция без базы и без файлов — ровно
 * как word-search-audit.ts, чтобы правило можно было проверить тестом, а
 * не только прогоном по банку.
 *
 * Главное решение здесь то же, что в филвордах: координаты генератора не
 * считаются истиной. Слово «лежит на месте» — это утверждение о СЕТКЕ
 * (буквы под координатами складываются в слово), а «пересечение сходится»
 * — утверждение о СПИСКЕ СЛОВ (два слова, делящие клетку, называют в ней
 * одну букву). Второе проверяется без чтения сетки намеренно: если
 * сверять оба слова с одной и той же клеткой, любое расхождение между
 * ними станет невидимым.
 */

/** Клетка сетки, пустая у кроссворда, — пустая строка: так её пишет
 * crossword.ts (`Array(width).fill("")`). Пробел и null тоже принимаются
 * как пустые: банк писался разными прогонами генератора. */
function isEmptyCell(value: unknown): boolean {
  return value === "" || value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/** Нормализация для сверки со словарём: регистр и «ё» → «е». Банк держит
 * «ёлка», а сравнение посимвольно эти пары теряет. */
export function normalizeBankWord(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

export interface CrosswordInput {
  id: string;
  level: string;
  sequence: number;
  grid: string[][];
  words: WordPlacement[];
}

export interface CrosswordAudit {
  id: string;
  level: string;
  sequence: number;
  height: number;
  width: number;
  wordCount: number;
  words: string[];
  /** Слова, чьи буквы в сетке не складываются в слово (или уходят за
   * край, или ложатся на пустую клетку). */
  placementMismatches: string[];
  /** Слова, у которых число клеток не равно длине слова. */
  lengthMismatches: string[];
  /** Пары слов, называющие разные буквы в одной общей клетке. */
  intersectionMismatches: string[];
  /** Непустые клетки сетки, не принадлежащие ни одному слову. */
  orphanCells: number;
  /** Клетки под словами, пустые в сетке. */
  holeCells: number;
  /** Слово встречается в одном кроссворде дважды буква в букву. */
  duplicateWords: string[];
  /** То же после нормализации «ё» и регистра. Отдельная колонка потому,
   * что «все» и «всё» — разные слова (todo / todos), а «свекровь» и
   * «свёкровь» — одно, и различить их может только человек. */
  duplicateWordsNormalized: string[];
  wordsNotInBank: string[];
  /** Слова без единого пересечения с другими словами этого кроссворда. */
  isolatedWords: string[];
  /** Все структурные дефекты одной строкой каждый. Изолированные слова и
   * слова вне банка сюда НЕ входят: это вопрос качества и словаря, а не
   * «есть ли у кроссворда решение». */
  problems: string[];
  /** Решение есть: все слова на местах, длины сходятся, пересечения
   * согласованы, сетка не спорит с координатами. */
  solvable: boolean;
}

function step(direction: WordSearchDirection): { dr: number; dc: number } {
  if (direction === "E") return { dr: 0, dc: 1 };
  if (direction === "S") return { dr: 1, dc: 0 };
  // Кроссворд знает только across/down; всё остальное — само по себе
  // дефект, и он назван отдельной строкой в problems.
  return { dr: 0, dc: 0 };
}

function cellsOf(placement: WordPlacement): { row: number; col: number }[] {
  const { dr, dc } = step(placement.direction);
  if (dr === 0 && dc === 0) return [];
  return Array.from({ length: [...placement.word].length }, (_, i) => ({
    row: placement.row + dr * i,
    col: placement.col + dc * i,
  }));
}

export function auditCrossword(input: CrosswordInput, bank: Set<string>): CrosswordAudit {
  const { grid, words } = input;
  const height = grid.length;
  const width = height === 0 ? 0 : Math.max(...grid.map((r) => r.length));
  const problems: string[] = [];

  const placementMismatches: string[] = [];
  const lengthMismatches: string[] = [];
  const intersectionMismatches: string[] = [];
  const isolatedWords: string[] = [];

  // Клетка → список (слово, индекс буквы). Строится по СПИСКУ СЛОВ.
  const claims = new Map<string, { word: string; letter: string; index: number }[]>();

  for (const placement of words) {
    const letters = [...placement.word];
    if (placement.direction !== "E" && placement.direction !== "S") {
      problems.push(`направление «${placement.direction}» у «${placement.word}» — у кроссворда бывают только E и S`);
      placementMismatches.push(placement.word);
      continue;
    }
    const cells = cellsOf(placement);
    if (cells.length !== letters.length) {
      lengthMismatches.push(placement.word);
      problems.push(`«${placement.word}»: клеток ${cells.length}, букв ${letters.length}`);
    }
    let outOfBounds = false;
    let mismatched = false;
    cells.forEach((cell, i) => {
      const key = `${cell.row},${cell.col}`;
      const list = claims.get(key) ?? [];
      list.push({ word: placement.word, letter: letters[i] ?? "", index: i });
      claims.set(key, list);

      const raw = grid[cell.row]?.[cell.col];
      if (cell.row < 0 || cell.col < 0 || cell.row >= height || cell.col >= (grid[cell.row]?.length ?? 0)) {
        outOfBounds = true;
        return;
      }
      if (isEmptyCell(raw)) {
        mismatched = true;
        return;
      }
      if (normalizeBankWord(String(raw)) !== normalizeBankWord(letters[i] ?? "")) {
        mismatched = true;
      }
    });
    if (outOfBounds) {
      placementMismatches.push(placement.word);
      problems.push(`«${placement.word}» (${placement.row},${placement.col},${placement.direction}) уходит за край сетки ${height}×${width}`);
    } else if (mismatched) {
      placementMismatches.push(placement.word);
      problems.push(`«${placement.word}» (${placement.row},${placement.col},${placement.direction}): буквы сетки не складываются в слово`);
    }
  }

  // Пересечения — по списку слов, без сетки.
  let holeCells = 0;
  const intersectingWords = new Set<string>();
  for (const [key, list] of claims) {
    if (list.length > 1) {
      for (const c of list) intersectingWords.add(c.word);
      const letters = new Set(list.map((c) => normalizeBankWord(c.letter)));
      if (letters.size > 1) {
        const pair = list.map((c) => `«${c.word}»:${c.letter}`).join(" ≠ ");
        intersectionMismatches.push(pair);
        problems.push(`клетка (${key}): ${pair}`);
      }
    }
    const [row, col] = key.split(",").map(Number);
    if (isEmptyCell(grid[row]?.[col])) holeCells += 1;
  }
  if (holeCells > 0) problems.push(`пустых клеток сетки под словами: ${holeCells}`);

  // Сетка против координат: непустая клетка, которую не занимает ни одно слово.
  let orphanCells = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (isEmptyCell(grid[r][c])) continue;
      if (!claims.has(`${r},${c}`)) orphanCells += 1;
    }
  }
  if (orphanCells > 0) problems.push(`букв в сетке, не принадлежащих ни одному слову: ${orphanCells}`);

  for (const placement of words) {
    if (!intersectingWords.has(placement.word)) isolatedWords.push(placement.word);
  }

  const exact = new Map<string, number>();
  const normalized = new Map<string, number>();
  for (const placement of words) {
    exact.set(placement.word, (exact.get(placement.word) ?? 0) + 1);
    const key = normalizeBankWord(placement.word);
    normalized.set(key, (normalized.get(key) ?? 0) + 1);
  }
  const duplicateWords = [...exact.entries()].filter(([, n]) => n > 1).map(([w]) => w);
  const duplicateWordsNormalized = [...normalized.entries()].filter(([, n]) => n > 1).map(([w]) => w);

  const wordsNotInBank = [...new Set(words.map((w) => normalizeBankWord(w.word)))].filter((w) => !bank.has(w));

  return {
    id: input.id,
    level: input.level,
    sequence: input.sequence,
    height,
    width,
    wordCount: words.length,
    words: words.map((w) => w.word),
    placementMismatches,
    lengthMismatches,
    intersectionMismatches,
    orphanCells,
    holeCells,
    duplicateWords,
    duplicateWordsNormalized,
    wordsNotInBank,
    isolatedWords,
    problems,
    solvable:
      placementMismatches.length === 0 &&
      lengthMismatches.length === 0 &&
      intersectionMismatches.length === 0 &&
      holeCells === 0,
  };
}

/** Разбор строки базы. Возвращает null, если JSON не разбирается или не
 * той формы — это само по себе находка и считается отдельно. */
export function crosswordInputFromRow(row: {
  id: string;
  level: string;
  sequence: number;
  gridData: string;
  words: string;
}): CrosswordInput | null {
  try {
    const gridData = JSON.parse(row.gridData) as WordGameGrid;
    const words = JSON.parse(row.words) as WordPlacement[];
    if (!Array.isArray(gridData?.grid) || !Array.isArray(words)) return null;
    return { id: row.id, level: row.level, sequence: row.sequence, grid: gridData.grid, words };
  } catch {
    return null;
  }
}
