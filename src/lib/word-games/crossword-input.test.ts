import { describe, expect, it } from "vitest";
import type { PublicCrosswordWord } from "./data";
import {
  buildCellWordMap,
  cellsOfWord,
  firstEmptyCellInWord,
  isPuzzleSolved,
  isWordSolved,
  nextCellInWord,
  prevCellInWord,
  resolveDirectionOnClick,
  shouldCountAsError,
  sortClues,
  wordAt,
} from "./crossword-input";

// A small L-shaped crossword: "КОТ" across at (0,0), "ТУЗ" down starting
// at the shared "Т" cell (0,2) — mirrors a real generated puzzle's shape
// closely enough to exercise every code path.
const acrossWord: PublicCrosswordWord = { number: 1, row: 0, col: 0, direction: "E", length: 3, clue: "animal" };
const downWord: PublicCrosswordWord = { number: 2, row: 0, col: 2, direction: "S", length: 3, clue: "card suit" };
const words = [acrossWord, downWord];

describe("buildCellWordMap / wordAt", () => {
  it("maps every cell of every word, including the shared intersection", () => {
    const map = buildCellWordMap(words);
    expect(wordAt(map, 0, 0, "E")?.word).toBe(acrossWord);
    expect(wordAt(map, 0, 2, "E")?.word).toBe(acrossWord);
    expect(wordAt(map, 0, 2, "S")?.word).toBe(downWord);
    expect(wordAt(map, 2, 2, "S")?.word).toBe(downWord);
  });

  it("returns null for a direction that doesn't pass through the cell", () => {
    const map = buildCellWordMap(words);
    expect(wordAt(map, 0, 0, "S")).toBeNull();
    expect(wordAt(map, 5, 5, "E")).toBeNull();
  });
});

describe("resolveDirectionOnClick", () => {
  const map = buildCellWordMap(words);

  it("picks the only direction available on a non-intersecting cell", () => {
    expect(resolveDirectionOnClick(map, 0, 0, null, null)).toBe("E");
    expect(resolveDirectionOnClick(map, 1, 2, null, null)).toBe("S");
  });

  it("keeps the previous direction when re-entering a different cell of the same word", () => {
    expect(resolveDirectionOnClick(map, 0, 1, "E", { row: 0, col: 0 })).toBe("E");
  });

  it("flips direction on a second click of the same intersection cell", () => {
    const first = resolveDirectionOnClick(map, 0, 2, null, null);
    expect(first).toBe("E");
    const second = resolveDirectionOnClick(map, 0, 2, first, { row: 0, col: 2 });
    expect(second).toBe("S");
  });

  it("falls back to a supported direction when the previous one doesn't apply here", () => {
    // previousDirection "S" doesn't reach (0,0) at all (only "E" does)
    expect(resolveDirectionOnClick(map, 0, 0, "S", { row: 5, col: 5 })).toBe("E");
  });
});

describe("nextCellInWord / prevCellInWord", () => {
  it("steps forward/backward along an across word", () => {
    expect(nextCellInWord(acrossWord, 0, 0)).toEqual({ row: 0, col: 1 });
    expect(nextCellInWord(acrossWord, 0, 2)).toBeNull();
    expect(prevCellInWord(acrossWord, 0, 1)).toEqual({ row: 0, col: 0 });
    expect(prevCellInWord(acrossWord, 0, 0)).toBeNull();
  });

  it("steps forward/backward along a down word", () => {
    expect(nextCellInWord(downWord, 0, 2)).toEqual({ row: 1, col: 2 });
    expect(prevCellInWord(downWord, 2, 2)).toEqual({ row: 1, col: 2 });
  });
});

describe("firstEmptyCellInWord", () => {
  it("returns the first cell with no guess yet", () => {
    const guesses = new Map([["0,0", "к"]]);
    expect(firstEmptyCellInWord(acrossWord, guesses)).toEqual({ row: 0, col: 1 });
  });

  it("returns null once every cell has a guess", () => {
    const guesses = new Map([
      ["0,0", "к"],
      ["0,1", "о"],
      ["0,2", "т"],
    ]);
    expect(firstEmptyCellInWord(acrossWord, guesses)).toBeNull();
  });
});

describe("cellsOfWord", () => {
  it("lists every cell in order", () => {
    expect(cellsOfWord(acrossWord)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });
});

describe("isWordSolved / isPuzzleSolved", () => {
  it("requires every cell of a word to be server-confirmed correct", () => {
    const partial = new Set(["0,0", "0,1"]);
    expect(isWordSolved(acrossWord, partial)).toBe(false);
    const full = new Set(["0,0", "0,1", "0,2"]);
    expect(isWordSolved(acrossWord, full)).toBe(true);
  });

  it("the puzzle is solved only once every word is", () => {
    const acrossOnly = new Set(["0,0", "0,1", "0,2"]);
    expect(isPuzzleSolved({ words }, acrossOnly)).toBe(false);
    const both = new Set(["0,0", "0,1", "0,2", "1,2", "2,2"]);
    expect(isPuzzleSolved({ words }, both)).toBe(true);
  });
});

describe("sortClues", () => {
  it("orders by clue number ascending regardless of input order", () => {
    const third: PublicCrosswordWord = { number: 3, row: 4, col: 0, direction: "E", length: 2, clue: "c" };
    const first: PublicCrosswordWord = { number: 1, row: 0, col: 0, direction: "E", length: 2, clue: "a" };
    const second: PublicCrosswordWord = { number: 2, row: 2, col: 0, direction: "E", length: 2, clue: "b" };
    expect(sortClues([third, first, second]).map((w) => w.number)).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const a: PublicCrosswordWord = { number: 2, row: 0, col: 0, direction: "E", length: 2, clue: "a" };
    const b: PublicCrosswordWord = { number: 1, row: 2, col: 0, direction: "E", length: 2, clue: "b" };
    const input = [a, b];
    sortClues(input);
    expect(input).toEqual([a, b]);
  });
});

describe("shouldCountAsError", () => {
  it("counts a wrong letter typed into a specific cell as an error", () => {
    expect(shouldCountAsError({ row: 0, col: 0 }, true)).toBe(true);
  });

  it("does not count a correct letter as an error", () => {
    expect(shouldCountAsError({ row: 0, col: 0 }, false)).toBe(false);
  });

  it("never counts a manual 'Check' pass (no target cell) as an error, even when it reveals wrong cells", () => {
    expect(shouldCountAsError(undefined, true)).toBe(false);
  });

  it("a manual 'Check' pass with no wrong cells is also not an error", () => {
    expect(shouldCountAsError(undefined, false)).toBe(false);
  });
});
