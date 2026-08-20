import { describe, expect, it } from "vitest";
import { buildWordSearch, buildWordSearchWithGrowth, DIRECTIONS } from "./word-search";
import { makeRng } from "./generation";
import type { WordCandidate } from "./generation";

const DELTAS: Record<string, [number, number]> = Object.fromEntries(DIRECTIONS.map((d) => [d.name, [d.dr, d.dc]]));

function readWord(grid: string[][], row: number, col: number, direction: string, length: number): string {
  const [dr, dc] = DELTAS[direction];
  let read = "";
  for (let i = 0; i < length; i++) read += grid[row + dr * i]?.[col + dc * i] ?? "";
  return read;
}

const POOL: WordCandidate[] = [
  { word: "кот", clue: "cat" },
  { word: "дом", clue: "house" },
  { word: "мода", clue: "fashion" },
  { word: "город", clue: "city" },
  { word: "рот", clue: "mouth" },
  { word: "торт", clue: "cake" },
  { word: "нос", clue: "nose" },
  { word: "сон", clue: "sleep" },
  { word: "стол", clue: "table" },
  { word: "стул", clue: "chair" },
];

describe("buildWordSearch", () => {
  it("places every word so it reads correctly off the returned grid", () => {
    const built = buildWordSearch(POOL, 10, 8, makeRng("word-search-test-1"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const w of built.words) {
      expect(readWord(built.grid.grid, w.row, w.col, w.direction, w.word.length)).toBe(w.word);
    }
  });

  it("fills every remaining cell with a filler letter (no blanks left)", () => {
    const built = buildWordSearch(POOL, 10, 8, makeRng("word-search-test-2"));
    expect(built).not.toBeNull();
    if (!built) return;
    for (const row of built.grid.grid) {
      for (const cell of row) expect(cell).not.toBe("");
    }
  });

  it("never places two conflicting letters in the same cell", () => {
    const built = buildWordSearch(POOL, 8, 8, makeRng("word-search-test-3"));
    expect(built).not.toBeNull();
    if (!built) return;
    const seen = new Map<string, string>();
    for (const w of built.words) {
      const [dr, dc] = DELTAS[w.direction];
      for (let i = 0; i < w.word.length; i++) {
        const key = `${w.row + dr * i},${w.col + dc * i}`;
        const letter = w.word[i];
        if (seen.has(key)) expect(seen.get(key)).toBe(letter);
        else seen.set(key, letter);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const built1 = buildWordSearch(POOL, 10, 8, makeRng("same-seed"));
    const built2 = buildWordSearch(POOL, 10, 8, makeRng("same-seed"));
    expect(built1).toEqual(built2);
  });

  it("rejects a degenerate placement (too few words fit)", () => {
    const tinyPool: WordCandidate[] = [{ word: "кот", clue: "cat" }];
    const built = buildWordSearch(tinyPool, 8, 8, makeRng("too-few"));
    expect(built).toBeNull();
  });

  it("balances direction usage rather than defaulting to cardinal directions", () => {
    // A larger pool + larger grid gives every direction real room, so a
    // balanced placer should use more than just 1-2 of the 8 directions —
    // this is the regression guard for the cardinal-bias bug fixed
    // earlier (see tryPlaceWord's doc comment).
    const bigPool: WordCandidate[] = POOL.concat(
      { word: "лес", clue: "forest" },
      { word: "сад", clue: "garden" },
      { word: "река", clue: "river" },
      { word: "море", clue: "sea" },
    );
    const built = buildWordSearch(bigPool, 14, 12, makeRng("balance-test"));
    expect(built).not.toBeNull();
    if (!built) return;
    const directionsUsed = new Set(built.words.map((w) => w.direction));
    expect(directionsUsed.size).toBeGreaterThan(2);
  });
});

describe("buildWordSearchWithGrowth", () => {
  it("grows the grid until the full target word count fits", () => {
    // 8 words needing a target of 8 in a base size that's too tight to
    // fit them all straight-line without growing.
    const built = buildWordSearchWithGrowth(POOL, 6, 8, "growth-test");
    expect(built).not.toBeNull();
    if (!built) return;
    expect(built.words.length).toBe(8);
    expect(built.grid.size).toBeGreaterThanOrEqual(6);
  });

  it("is deterministic for a given seed prefix", () => {
    const built1 = buildWordSearchWithGrowth(POOL, 6, 8, "growth-determinism");
    const built2 = buildWordSearchWithGrowth(POOL, 6, 8, "growth-determinism");
    expect(built1).toEqual(built2);
  });
});
