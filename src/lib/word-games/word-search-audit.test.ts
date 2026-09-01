import { describe, it, expect } from "vitest";
import { auditPuzzle, findStraight, findCurved, puzzleInputFromRow } from "./word-search-audit";

const GRID = [
  ["к", "о", "т", "а", "б", "в"],
  ["г", "д", "е", "ж", "з", "и"],
  ["д", "о", "м", "к", "л", "м"],
  ["н", "о", "п", "р", "с", "т"],
  ["с", "ы", "р", "у", "ф", "х"],
  ["ц", "ч", "ш", "щ", "ъ", "ы"],
];

function puzzle(words: string[], curved = false) {
  return {
    id: "t",
    level: "A1",
    sequence: 1,
    curved,
    grid: GRID,
    words: words.map((word) => ({ word })),
  };
}

describe("word-search solver", () => {
  it("finds a word laid out along a row, a column and a diagonal", () => {
    expect(findStraight(GRID, "кот")).not.toBeNull(); // row 0, E
    expect(findStraight(GRID, "темп")).not.toBeNull(); // column 2, S
    expect(findStraight(GRID, "сом")).not.toBeNull(); // diagonal NE from (4,0)
  });

  it("finds a word read backwards — a W placement is an E placement reversed", () => {
    expect(findStraight(GRID, "ток")).not.toBeNull();
  });

  it("does not find a word that is not in the grid", () => {
    expect(findStraight(GRID, "лиса")).toBeNull();
  });

  // The positive control the whole check rests on: a sweep that reports
  // "0 puzzles with missing words" is worth nothing unless it is shown
  // first that a missing word IS caught (PROGRESS.md 4.1).
  it("positive control: a planted missing word is caught, a clean puzzle is not", () => {
    expect(auditPuzzle(puzzle(["кот", "дом", "сыр"])).missing).toEqual([]);
    expect(auditPuzzle(puzzle(["кот", "дом", "сыр", "лиса"])).missing).toEqual(["лиса"]);
  });

  it("positive control: an overfull grid is caught by both measures", () => {
    const overfull = auditPuzzle(puzzle(["дееспособность", "конституционный", "кот", "дом", "сыр", "мама"]));
    // 14 + 15 + 3 + 3 + 3 + 4 = 42 letters into 36 cells.
    expect(overfull.density).toBeGreaterThan(1);
    expect(overfull.impossibleByLength).toBe(true);
    const fine = auditPuzzle(puzzle(["кот", "дом", "сыр"]));
    expect(fine.density).toBeLessThan(0.65);
    expect(fine.impossibleByLength).toBe(false);
  });

  it("counts the grid from the array, not from gridData.size", () => {
    const input = puzzleInputFromRow({
      id: "x",
      level: "A1",
      sequence: 1,
      curved: false,
      // `size` lies: the grid below is 2x3.
      gridData: JSON.stringify({ size: 99, grid: [["к", "о", "т"], ["д", "о", "м"]] }),
      words: JSON.stringify([{ word: "кот" }]),
    });
    expect(input).not.toBeNull();
    const audit = auditPuzzle(input!);
    expect([audit.rows, audit.cols]).toEqual([2, 3]);
  });

  it("a row whose JSON will not parse degrades to null instead of throwing", () => {
    expect(
      puzzleInputFromRow({ id: "x", level: "A1", sequence: 1, curved: false, gridData: "{oops", words: "[]" }),
    ).toBeNull();
  });

  it("a curved/★ word may bend, and a bent search still refuses a word that is absent", () => {
    // "кот" bends: к(0,0) → о(0,1) → т(0,2) is straight, so use one that
    // is only reachable by bending — о(0,1) → д(1,1) → о(2,1) → м(2,2).
    expect(findCurved(GRID, "одом").found).toBe(true);
    expect(findCurved(GRID, "лиса").found).toBe(false);
    expect(auditPuzzle(puzzle(["одом"], true)).missing).toEqual([]);
    expect(auditPuzzle(puzzle(["лиса"], true)).missing).toEqual(["лиса"]);
  });
});
