import { describe, expect, it } from "vitest";
import { lineBetween, matchSelection, readWord } from "./word-search-select";

const grid = [
  ["К", "О", "Т", "Х"],
  ["Ж", "Ю", "Ы", "Э"],
  ["Т", "Ф", "Ы", "Й"],
  ["З", "У", "Т", "Ъ"],
];

describe("lineBetween", () => {
  it("returns a single cell when start equals end", () => {
    expect(lineBetween({ row: 1, col: 1 }, { row: 1, col: 1 })).toEqual([{ row: 1, col: 1 }]);
  });

  it("builds a horizontal path", () => {
    expect(lineBetween({ row: 0, col: 0 }, { row: 0, col: 2 })).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it("builds a vertical path", () => {
    expect(lineBetween({ row: 0, col: 0 }, { row: 2, col: 0 })).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ]);
  });

  it("builds a diagonal path in any of the 4 diagonal directions", () => {
    expect(lineBetween({ row: 0, col: 0 }, { row: 2, col: 2 })).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
    ]);
    expect(lineBetween({ row: 2, col: 0 }, { row: 0, col: 2 })).toEqual([
      { row: 2, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it("rejects a non-straight (knight's-move) drag", () => {
    expect(lineBetween({ row: 0, col: 0 }, { row: 1, col: 2 })).toBeNull();
  });
});

describe("readWord", () => {
  it("reads letters off the grid along a path", () => {
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(readWord(grid, cells)).toBe("КОТ");
  });
});

describe("matchSelection", () => {
  const words = ["кот", "туз"];

  it("matches a forward selection case-insensitively", () => {
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(matchSelection(grid, cells, words)).toBe("кот");
  });

  it("matches a selection dragged backwards along the same line", () => {
    const cells = [
      { row: 0, col: 2 },
      { row: 0, col: 1 },
      { row: 0, col: 0 },
    ];
    expect(matchSelection(grid, cells, words)).toBe("кот");
  });

  it("matches a diagonal placement", () => {
    // Т(0,2) У(3,1)? not aligned — use a real diagonal: Т(2,0) diag down-right
    const cells = [
      { row: 2, col: 0 },
      { row: 3, col: 1 },
    ];
    expect(matchSelection(grid, cells, ["ту"])).toBe("ту");
  });

  it("returns null when the selection spells nothing in the word list", () => {
    const cells = [
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ];
    expect(matchSelection(grid, cells, words)).toBeNull();
  });
});
