import { describe, expect, it } from "vitest";
import { extendPath, extendPathStraight, matchSelection, readWord } from "./word-search-select";

const grid = [
  ["К", "О", "Т", "Х"],
  ["Ж", "Ю", "Ы", "Э"],
  ["Т", "Ф", "Ы", "Й"],
  ["З", "У", "Т", "Ъ"],
];

describe("extendPath", () => {
  it("starts a new path from an empty one", () => {
    expect(extendPath([], { row: 1, col: 1 })).toEqual([{ row: 1, col: 1 }]);
  });

  it("extends onto an 8-adjacent cell", () => {
    const path = [{ row: 0, col: 0 }];
    expect(extendPath(path, { row: 1, col: 1 })).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it("supports a genuine bend — two straight segments in different directions", () => {
    let path = [{ row: 0, col: 0 }];
    path = extendPath(path, { row: 0, col: 1 }); // east
    path = extendPath(path, { row: 0, col: 2 }); // east
    path = extendPath(path, { row: 1, col: 2 }); // south — the bend
    expect(path).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
    ]);
  });

  it("is a no-op (same reference) when the pointer re-enters the current last cell", () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    expect(extendPath(path, { row: 0, col: 1 })).toBe(path);
  });

  it("pops the last cell when the pointer backtracks onto the second-to-last cell", () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
    expect(extendPath(path, { row: 0, col: 1 })).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  it("ignores a non-adjacent jump", () => {
    const path = [{ row: 0, col: 0 }];
    expect(extendPath(path, { row: 5, col: 5 })).toBe(path);
  });

  it("ignores revisiting a cell already in the path (other than backtracking one step)", () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }];
    // (0,0) is adjacent to the last cell (1,1) but already used earlier —
    // must not be re-added (would make an invalid self-intersecting path).
    expect(extendPath(path, { row: 0, col: 0 })).toBe(path);
  });
});

describe("extendPathStraight", () => {
  it("starts a new path from an empty one", () => {
    expect(extendPathStraight([], { row: 1, col: 1 })).toEqual([{ row: 1, col: 1 }]);
  });

  it("lets the second cell pick any adjacent direction", () => {
    const path = [{ row: 2, col: 2 }];
    expect(extendPathStraight(path, { row: 3, col: 3 })).toEqual([
      { row: 2, col: 2 },
      { row: 3, col: 3 },
    ]);
  });

  it("continues straight along the locked diagonal ray", () => {
    let path = [{ row: 0, col: 0 }];
    path = extendPathStraight(path, { row: 1, col: 1 });
    path = extendPathStraight(path, { row: 2, col: 2 });
    path = extendPathStraight(path, { row: 3, col: 3 });
    expect(path).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
    ]);
  });

  it("ignores a cell that strays off the locked ray, even though it's 8-adjacent to the last cell", () => {
    // Locked onto the SE diagonal from (0,0). (2,3) is adjacent to (2,2)
    // but is NOT the next cell on the ray (which would be (3,3)) — this
    // is exactly the reported bug: a real mouse drag along a diagonal
    // occasionally samples a neighboring row/col for one pointermove
    // event, and that stray sample must not derail the selection.
    let path = [{ row: 0, col: 0 }];
    path = extendPathStraight(path, { row: 1, col: 1 });
    path = extendPathStraight(path, { row: 2, col: 2 });
    const strayed = extendPathStraight(path, { row: 2, col: 3 });
    expect(strayed).toBe(path); // unchanged — the stray sample was ignored
  });

  it("resumes extending once the pointer returns to the locked ray after a stray sample", () => {
    let path = [{ row: 0, col: 0 }];
    path = extendPathStraight(path, { row: 1, col: 1 });
    path = extendPathStraight(path, { row: 2, col: 2 });
    path = extendPathStraight(path, { row: 2, col: 3 }); // stray, ignored
    path = extendPathStraight(path, { row: 3, col: 3 }); // back on the ray
    expect(path).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
    ]);
  });

  it("is a no-op (same reference) when the pointer re-enters the current last cell", () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    expect(extendPathStraight(path, { row: 0, col: 1 })).toBe(path);
  });

  it("pops the last cell when the pointer backtracks onto the second-to-last cell, keeping the ray locked", () => {
    let path = [{ row: 0, col: 0 }];
    path = extendPathStraight(path, { row: 0, col: 1 });
    path = extendPathStraight(path, { row: 0, col: 2 });
    const backed = extendPathStraight(path, { row: 0, col: 1 });
    expect(backed).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
    // The ray (horizontal, east) is still locked after backtracking —
    // a diagonal cell must still be rejected.
    expect(extendPathStraight(backed, { row: 1, col: 2 })).toBe(backed);
  });

  it("ignores a non-adjacent jump as the second cell", () => {
    const path = [{ row: 0, col: 0 }];
    expect(extendPathStraight(path, { row: 5, col: 5 })).toBe(path);
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
