import { describe, expect, it } from "vitest";
import { buildSnakeWordSearch, buildSnakeWordSearchWithGrowth, countBends, isAdjacentPath, MIN_BENDS } from "./snake-word-search";
import { makeRng } from "./generation";
import type { WordCandidate } from "./generation";

// Every word here is 4+ letters — a snake word needs at least
// MIN_BENDS+2 = 4 letters to have enough segments to physically bend
// twice (a 3-letter path has only 1 possible bend point, geometrically
// incapable of clearing MIN_BENDS=2, so shorter words are permanently
// unplaceable by design — see buildSnakeWordSearch's length guard).
const POOL: WordCandidate[] = [
  { word: "мода", clue: "fashion" },
  { word: "город", clue: "city" },
  { word: "торт", clue: "cake" },
  { word: "стол", clue: "table" },
  { word: "стул", clue: "chair" },
  { word: "парк", clue: "park" },
  { word: "школа", clue: "school" },
  { word: "музей", clue: "museum" },
  { word: "книга", clue: "book" },
  { word: "окно", clue: "window" },
  { word: "стена", clue: "wall" },
  { word: "полка", clue: "shelf" },
];

describe("countBends", () => {
  it("counts 0 for a straight line", () => {
    expect(countBends([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }])).toBe(0);
  });

  it("counts each direction change", () => {
    // right, right, down, down, left — 2 bends (E->S, S->W)
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 1 },
    ];
    expect(countBends(path)).toBe(2);
  });
});

describe("isAdjacentPath", () => {
  it("accepts a path where every step is an 8-neighbor", () => {
    expect(
      isAdjacentPath([
        { row: 0, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 0, col: 2 },
      ])
    ).toBe(true);
  });

  it("rejects a non-adjacent jump", () => {
    expect(
      isAdjacentPath([
        { row: 0, col: 0 },
        { row: 5, col: 5 },
      ])
    ).toBe(false);
  });

  it("rejects a repeated cell", () => {
    expect(
      isAdjacentPath([
        { row: 0, col: 0 },
        { row: 0, col: 0 },
      ])
    ).toBe(false);
  });
});

describe("buildSnakeWordSearch", () => {
  it("places every word along a path that actually spells it out", () => {
    const built = buildSnakeWordSearch(POOL, 10, 8, makeRng("snake-test-1"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const w of built.words) {
      expect(w.path).toBeDefined();
      const path = w.path!;
      expect(path.length).toBe(w.word.length);
      const read = path.map((c) => built.grid.grid[c.row][c.col]).join("");
      expect(read).toBe(w.word);
    }
  });

  it("every word's path is a valid 8-adjacent, non-self-intersecting walk", () => {
    const built = buildSnakeWordSearch(POOL, 10, 8, makeRng("snake-test-2"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const w of built.words) {
      const path = w.path!;
      expect(isAdjacentPath(path)).toBe(true);
      const keys = path.map((c) => `${c.row},${c.col}`);
      expect(new Set(keys).size).toBe(keys.length); // no self-revisit
    }
  });

  it("every placed word actually bends (meets the minimum bend count)", () => {
    const built = buildSnakeWordSearch(POOL, 10, 8, makeRng("snake-test-3"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const w of built.words) {
      expect(countBends(w.path!)).toBeGreaterThanOrEqual(MIN_BENDS);
    }
  });

  it("never places two conflicting letters in the same cell (words can cross)", () => {
    const built = buildSnakeWordSearch(POOL, 8, 8, makeRng("snake-test-4"));
    expect(built).not.toBeNull();
    if (!built) return;
    const seen = new Map<string, string>();
    for (const w of built.words) {
      for (let i = 0; i < w.path!.length; i++) {
        const c = w.path![i];
        const key = `${c.row},${c.col}`;
        const letter = w.word[i];
        if (seen.has(key)) expect(seen.get(key)).toBe(letter);
        else seen.set(key, letter);
      }
    }
  });

  it("fills every remaining cell with a filler letter", () => {
    const built = buildSnakeWordSearch(POOL, 10, 8, makeRng("snake-test-5"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const row of built.grid.grid) for (const cell of row) expect(cell).not.toBe("");
  });

  it("is deterministic for a given seed", () => {
    const built1 = buildSnakeWordSearch(POOL, 10, 8, makeRng("same-snake-seed"));
    const built2 = buildSnakeWordSearch(POOL, 10, 8, makeRng("same-snake-seed"));
    expect(built1).toEqual(built2);
  });

  it("rejects a degenerate placement (too few words fit)", () => {
    const tinyPool: WordCandidate[] = [{ word: "кот", clue: "cat" }];
    const built = buildSnakeWordSearch(tinyPool, 8, 8, makeRng("too-few-snake"));
    expect(built).toBeNull();
  });
});

describe("buildSnakeWordSearchWithGrowth", () => {
  it("grows the grid until the full target word count fits", () => {
    const built = buildSnakeWordSearchWithGrowth(POOL, 6, 8, "snake-growth-test");
    expect(built).not.toBeNull();
    if (!built) return;
    expect(built.words.length).toBe(8);
  });

  it("is deterministic for a given seed prefix", () => {
    const built1 = buildSnakeWordSearchWithGrowth(POOL, 6, 8, "snake-growth-determinism");
    const built2 = buildSnakeWordSearchWithGrowth(POOL, 6, 8, "snake-growth-determinism");
    expect(built1).toEqual(built2);
  });
});
