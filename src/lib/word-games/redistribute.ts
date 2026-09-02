// Spreading one over-packed WORD_SEARCH puzzle's words across several
// grids — the same words, fewer per grid, on a board size CHOSEN for the
// list rather than inherited from it.
//
// Why this shape. The words are not the problem (they come straight from
// the FlashcardCard bank and are the level's real vocabulary), so the two
// levers are how many words share one grid and how big that grid is. Both
// are used here; neither cuts a word.
//
// The board size used to be the source row's own size, and before that a
// hard-wired 16. Both were wrong in the same way: a list whose longest
// word is 14 letters cannot be laid on a 16-wide board without that word
// taking 88% of the side (quality.ts, ось 2), and a 16-word list on a
// 16×16 board sits at 40% occupancy — under the corridor floor, the
// "разрежённый край" that is exactly as dull as the packed one. The bank
// already holds six sizes (8/10/12/14/16/18) and the picker renders any of
// them, so the size is a lever that was simply never pulled.
import { buildWordSearch } from "./word-search";
import { makeRng, type WordCandidate } from "./generation";
import { occupancyStats } from "./word-search-audit";
import { BOARD_SIZES, corridorFor, corridorTarget, minSideForWord } from "./quality";
import type { WordGameGrid, WordPlacement } from "./types";

/**
 * Куда целится укладчик — теперь коридор из quality.ts, а не «лишь бы под
 * порогом».
 *
 * Прежнее значение (0,75) стояло под порогом density.ts (0,80) с запасом
 * в одно слово, и этого достаточно, чтобы пазл не считался сломанным, —
 * но 0,75 и есть та самая мозаика, из-за которой этот заход и начался:
 * свободна одна клетка из четырёх. Верх коридора для прямого пазла 0,65,
 * для ★ — 0,55; низ, 0,45 и 0,35, здесь такой же обязательный: часть,
 * упавшая ниже, — это не «разгрузили», это «разбавили».
 */
export const MAX_PARTS = 4;

export interface BuiltPart {
  grid: WordGameGrid;
  words: WordPlacement[];
  occupancy: number;
  maxOverlap: number;
}

/** Deals the words into `parts` buckets longest-first, round-robin and
 * then back (boustrophedon), so every bucket gets a comparable share of
 * the long words instead of one bucket collecting them all. Letter counts
 * come out within a few of each other, which is what makes the parts
 * land at similar occupancy. */
export function dealWords(words: WordCandidate[], parts: number): WordCandidate[][] {
  const byLength = [...words].sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
  const buckets: WordCandidate[][] = Array.from({ length: parts }, () => []);
  byLength.forEach((w, i) => {
    const lap = Math.floor(i / parts);
    const slot = i % parts;
    buckets[lap % 2 === 0 ? slot : parts - 1 - slot].push(w);
  });
  return buckets;
}

/** Builds one bucket into a 16×16 grid, retrying seeds until every word
 * in it is actually placed. Returns null if none of the attempts fits the
 * whole bucket — the caller then splits further rather than shipping a
 * part that quietly lost a word. */
export function buildPart(
  bucket: WordCandidate[],
  size: number,
  seedPrefix: string,
  attempts = 12,
): BuiltPart | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const built = buildWordSearch(bucket, size, bucket.length, makeRng(`${seedPrefix}-try${attempt}`));
    if (!built || built.words.length < bucket.length) continue;
    const stats = occupancyStats(built.grid.grid, built.words);
    if (stats.placementMismatches.length > 0) continue;
    return { grid: built.grid, words: built.words, occupancy: stats.occupancy, maxOverlap: stats.maxOverlap };
  }
  return null;
}

export interface FittedPart extends BuiltPart {
  /** Сторона, на которой эта часть собрана. Части одного рунга — это
   * РАЗНЫЕ строки базы и разные URL, поэтому одинаковый размер им не
   * нужен: длинное слово может требовать 18, а короткий остаток жить на
   * 12, и заставлять остаток растекаться по 324 клеткам значило бы
   * лечить перегруз разрежённостью. */
  size: number;
  /** Легла ли эта часть в коридор quality.ts. */
  inCorridor: boolean;
}

export interface SplitResult {
  parts: FittedPart[];
  /** Every word of the input, in the order the parts hold them — checked
   * against the input by the caller. */
  wordsOut: string[];
  /** Все ли части в коридоре. false — план всё равно возвращается (он
   * лучший достижимый), но записывать его молча нельзя. */
  inCorridor: boolean;
}

export interface PlanOptions {
  /** ★-пазл играет по другому правилу укладки и потому по другому
   * коридору (quality.ts). */
  curved?: boolean;
  /** Разрешённые стороны, по возрастанию. По умолчанию — шесть размеров
   * банка. Сужается в тестах и в подсадках контроля. */
  sizes?: readonly number[];
  /** Границы числа частей. Низ по умолчанию 1: «одной сеткой, но другого
   * размера» — законный и самый дешёвый исход. */
  minParts?: number;
  maxParts?: number;
}

/** Один проверенный набор сторон и чем он кончился. Нужен для отчёта:
 * «почему выбрано именно это» должно читаться числами, а не
 * подразумеваться. */
export interface SizeAttempt {
  sizes: number[];
  outcome: "в коридоре" | "слово не влезает" | "пустая часть" | "не уложилось" | "перегружено" | "разрежено" | "узел";
  occupancies: number[];
}

/**
 * Раскладывает слова по буквам ПОД ЗАДАННЫЕ стороны.
 *
 * Каждая сетка получает долю букв по своей площади: сетка 18×18 вмещает
 * вдвое больше, чем 12×12, и делить между ними поровну — значит гарантированно
 * перегрузить меньшую и разрядить большую. Слова раздаются от длинных к
 * коротким в ту сетку, которой до её доли не хватает больше всех, — и
 * только в ту, на которой слово не выходит за потолок отношения
 * (quality.ts): слово в 14 букв не имеет права попасть в сетку 12×12,
 * какой бы недогруженной она ни была.
 *
 * null — если какое-то слово некуда положить или какая-то сетка осталась
 * пустой (пустая сетка — это не разложение, а потерянная строка).
 */
export function dealWordsToSizes(words: WordCandidate[], sizes: number[]): WordCandidate[][] | null {
  const byLength = [...words].sort(
    (a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word),
  );
  const buckets: WordCandidate[][] = sizes.map(() => []);
  const letters = sizes.map(() => 0);
  const capacity = sizes.map((s) => s * s);
  const totalCapacity = capacity.reduce((n, c) => n + c, 0);
  const totalLetters = byLength.reduce((n, w) => n + w.word.length, 0);

  for (const w of byLength) {
    const need = minSideForWord(w.word.length);
    let pick = -1;
    let bestDeficit = -Infinity;
    for (let i = 0; i < sizes.length; i++) {
      if (need === null || sizes[i] < need) continue;
      const share = (capacity[i] / totalCapacity) * totalLetters;
      const deficit = share - letters[i];
      if (deficit > bestDeficit || (deficit === bestDeficit && sizes[i] > sizes[pick])) {
        bestDeficit = deficit;
        pick = i;
      }
    }
    if (pick < 0) return null;
    buckets[pick].push(w);
    letters[pick] += w.word.length;
  }
  return buckets.some((b) => b.length === 0) ? null : buckets;
}

/**
 * Наборы сторон длиной `parts` из `sizes`, без учёта порядка (сочетания с
 * повторениями), в порядке предпочтения: сначала РОВНЫЕ (наименьший
 * разброс сторон), при равном разбросе — наименьшей суммарной площади.
 *
 * Почему разброс важнее площади. Обе величины сравниваются только среди
 * наборов, которые УЖЕ в коридоре, то есть «пустого поля» ни в одном из
 * них нет по построению, и площадь перестаёт быть признаком качества.
 * А разброс им остаётся: набор 10+18 кладёт в строку-источник шесть
 * коротких слов на маленькой доске, а весь остальной рунг — в хвост, и
 * рунг C1 превращается в две игры разной весовой категории под одним
 * номером в лестнице. Набор 14+18 из того же списка даёт две сравнимые
 * игры. Порядок фиксирован и не зависит ни от чего, кроме `sizes` и
 * `parts`.
 */
export function sizeCombinations(sizes: readonly number[], parts: number): number[][] {
  const out: number[][] = [];
  const walk = (start: number, acc: number[]) => {
    if (acc.length === parts) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < sizes.length; i++) walk(i, [...acc, sizes[i]]);
  };
  walk(0, []);
  const area = (c: number[]) => c.reduce((n, s) => n + s * s, 0);
  const spread = (c: number[]) => c[c.length - 1] - c[0];
  return out.sort((a, b) => spread(a) - spread(b) || area(a) - area(b) || b[b.length - 1] - a[a.length - 1]);
}

/**
 * План раскладки: сколько сеток, каких сторон, и что на них ляжет.
 *
 * Перебор — и есть правило, поэтому он записан здесь явно:
 *
 *   для числа частей = 1, 2, … maxParts (меньше — лучше):
 *       для набора сторон по возрастанию суммарной площади:
 *           раздать слова по площадям (dealWordsToSizes);
 *           уложить каждую часть на свою сторону;
 *           если ВСЕ части в коридоре и без узла — взять этот набор.
 *
 * Почему число частей во внешнем цикле. Новая часть — это новая строка в
 * базе, новый URL и новая позиция в лестнице; больший размер доски не
 * стоит ничего. Значит сначала пробуем обойтись без деления вовсе — и это
 * не теория: 231 пазл банка ниже коридора лежит на сетке 16×16, им нужен
 * НЕ раздел, а сетка поменьше.
 *
 * Детерминированность: единственный источник случайности — makeRng по
 * строке сида, а в сид входят seedPrefix, набор сторон, номер части и
 * номер попытки. Ни времени, ни Math.random, ни порядка строк базы здесь
 * нет, поэтому два прогона подряд дают побайтово одно и то же (сторожи —
 * redistribute.test.ts и `--twice` у отчёта).
 *
 * Возвращает лучший достижимый план с `inCorridor: false`, если в коридор
 * не попал ни один набор: список из восьми трёхбуквенных слов не ложится
 * в коридор ни на одной из шести сторон (8×8 — самая маленькая доска
 * банка, и на ней такой список даёт 37%), и это свойство списка, а не
 * отказ укладчика. Решение, писать ли такой план, принимает вызывающий.
 * null — только если слова не уложились ни при каком наборе.
 */
export function planLayout(
  words: WordCandidate[],
  seedPrefix: string,
  options: PlanOptions = {},
): (SplitResult & { tried: SizeAttempt[] }) | null {
  const curved = options.curved ?? false;
  const sizes = options.sizes ?? BOARD_SIZES;
  const maxParts = options.maxParts ?? MAX_PARTS;
  const { floor, ceiling } = corridorFor(curved);
  const target = corridorTarget(curved);
  const tried: SizeAttempt[] = [];
  let fallback: (SplitResult & { distance: number }) | null = null;

  for (let parts = options.minParts ?? 1; parts <= maxParts; parts++) {
    if (parts > words.length) break;
    for (const combo of sizeCombinations(sizes, parts)) {
      const buckets = dealWordsToSizes(words, combo);
      if (!buckets) {
        tried.push({ sizes: combo, outcome: "слово не влезает", occupancies: [] });
        continue;
      }
      const built: FittedPart[] = [];
      let outcome: SizeAttempt["outcome"] = "в коридоре";
      for (let i = 0; i < buckets.length; i++) {
        const part = buildPart(buckets[i], combo[i], `${seedPrefix}-${combo.join("_")}-part${i}`);
        if (!part) {
          outcome = "не уложилось";
          break;
        }
        const inCorridor = part.occupancy >= floor && part.occupancy <= ceiling && part.maxOverlap <= 3;
        built.push({ ...part, size: combo[i], inCorridor });
        if (!inCorridor) {
          outcome = part.maxOverlap > 3 ? "узел" : part.occupancy > ceiling ? "перегружено" : "разрежено";
          break;
        }
      }
      tried.push({ sizes: combo, outcome, occupancies: built.map((p) => Number(p.occupancy.toFixed(4))) });
      if (outcome === "в коридоре" && built.length === buckets.length) {
        return {
          parts: built,
          wordsOut: built.flatMap((p) => p.words.map((w) => w.word)),
          inCorridor: true,
          tried,
        };
      }
      if (built.length === buckets.length) {
        const distance = Math.max(...built.map((p) => Math.abs(p.occupancy - target)));
        if (fallback === null || distance < fallback.distance) {
          fallback = {
            parts: built,
            wordsOut: built.flatMap((p) => p.words.map((w) => w.word)),
            inCorridor: false,
            distance,
          };
        }
      }
    }
  }
  if (!fallback) return null;
  return { parts: fallback.parts, wordsOut: fallback.wordsOut, inCorridor: false, tried };
}

/** Размер доски одной сетки. */
export interface BoardSize {
  rows: number;
  cols: number;
}

export function boardSize(grid: string[][]): BoardSize {
  return { rows: grid.length, cols: grid[0]?.length ?? 0 };
}

/**
 * Каждая часть обязана лежать на той стороне, которую выбрал
 * планировщик, и эта сторона обязана быть из шести, которые банк держит.
 *
 * Почему это по-прежнему отдельный сторож, хотя размер теперь выбирается,
 * а не наследуется. Раньше он ловил зашитую константу 16, ужимавшую 18×18
 * до 16×16 и раздувавшую 10×10 до 16×16. Теперь ловит другое: часть,
 * собранную не на той стороне, которую для неё выбрали (сторона попадает
 * в манифест и в отчёт до записи — расхождение значит, что записывается
 * не то, что показали), сторону вне шести разрешённых — доска шире 18
 * столбцов не помещается на телефон — и неквадратную сетку.
 *
 * Проверяется КАЖДАЯ часть, включая первую: первая пишется в
 * существующую строку, и подмена размера доски там видна игроку сразу.
 */
export function boardSizeMismatches(
  expected: number | number[],
  parts: { grid: { grid: string[][] } }[],
  allowed: readonly number[] = BOARD_SIZES,
): string[] {
  const out: string[] = [];
  const want = Array.isArray(expected) ? expected : parts.map(() => expected);
  if (want.length !== parts.length) {
    out.push(`сторон обещано ${want.length}, а частей ${parts.length}`);
  }
  want.forEach((size, i) => {
    if (!allowed.includes(size)) {
      out.push(`часть ${i + 1}: сторона ${size} не из разрешённых (${allowed.join(", ")})`);
    }
  });
  parts.forEach((p, i) => {
    const got = boardSize(p.grid.grid);
    const size = want[i];
    if (size === undefined) return;
    if (got.rows !== size || got.cols !== size) {
      out.push(`часть ${i + 1}: доска ${got.rows}×${got.cols}, а выбрана ${size}×${size}`);
    }
  });
  return out;
}
