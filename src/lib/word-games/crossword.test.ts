import { describe, expect, it } from "vitest";
import { buildCrossword } from "./crossword";
import { makeRng } from "./generation";
import type { WordCandidate } from "./generation";

const DELTAS: Record<string, [number, number]> = {
  E: [0, 1],
  S: [1, 0],
};

function readWordFromGrid(grid: string[][], word: { word: string; row: number; col: number; direction: string }): string {
  const [dr, dc] = DELTAS[word.direction];
  let read = "";
  for (let i = 0; i < word.word.length; i++) {
    read += grid[word.row + dr * i]?.[word.col + dc * i] ?? "";
  }
  return read;
}

// A pool with real overlap potential (shares letters across several
// words), roughly mirroring a real FlashcardCard-derived pool — mirrors
// what prisma/generate-word-games.ts hands buildCrossword at generation
// time. Kept smallish so a wordCount-of-6 target is meaningfully
// achievable but not guaranteed trivially.
const POOL: WordCandidate[] = [
  { word: "кот", clue: "cat" },
  { word: "код", clue: "code" },
  { word: "дом", clue: "house" },
  { word: "мода", clue: "fashion" },
  { word: "дорога", clue: "road" },
  { word: "город", clue: "city" },
  { word: "рот", clue: "mouth" },
  { word: "торт", clue: "cake" },
  { word: "нос", clue: "nose" },
  { word: "сон", clue: "sleep" },
  { word: "стол", clue: "table" },
  { word: "стул", clue: "chair" },
];

describe("buildCrossword", () => {
  it("places every word so it reads correctly off the returned grid", () => {
    const rng = makeRng("crossword-test-1");
    const built = buildCrossword(POOL, 6, 4, rng);
    expect(built).not.toBeNull();
    if (!built) return;

    for (const w of built.words) {
      expect(readWordFromGrid(built.grid.grid, w)).toBe(w.word);
    }
  });

  it("never places two different letters in the same cell", () => {
    const rng = makeRng("crossword-test-2");
    const built = buildCrossword(POOL, 8, 4, rng);
    expect(built).not.toBeNull();
    if (!built) return;

    const seen = new Map<string, string>();
    for (const w of built.words) {
      const [dr, dc] = DELTAS[w.direction];
      for (let i = 0; i < w.word.length; i++) {
        const key = `${w.row + dr * i},${w.col + dc * i}`;
        const letter = w.word[i];
        if (seen.has(key)) {
          expect(seen.get(key)).toBe(letter);
        } else {
          seen.set(key, letter);
        }
      }
    }
  });

  it("every non-blank grid cell belongs to at least one placed word (no orphan letters)", () => {
    const rng = makeRng("crossword-test-3");
    const built = buildCrossword(POOL, 6, 4, rng);
    expect(built).not.toBeNull();
    if (!built) return;

    const covered = new Set<string>();
    for (const w of built.words) {
      const [dr, dc] = DELTAS[w.direction];
      for (let i = 0; i < w.word.length; i++) covered.add(`${w.row + dr * i},${w.col + dc * i}`);
    }
    const { grid } = built.grid;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const isBlank = grid[r][c] === "";
        expect(covered.has(`${r},${c}`)).toBe(!isBlank);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const built1 = buildCrossword(POOL, 6, 4, makeRng("same-seed"));
    const built2 = buildCrossword(POOL, 6, 4, makeRng("same-seed"));
    expect(built1).toEqual(built2);
  });

  it("assigns crossword-standard numbering (a start cell shared by across+down gets one number)", () => {
    const rng = makeRng("crossword-test-4");
    const built = buildCrossword(POOL, 6, 4, rng);
    expect(built).not.toBeNull();
    if (!built) return;

    const byStart = new Map<string, number[]>();
    for (const w of built.words) {
      const key = `${w.row},${w.col}`;
      const list = byStart.get(key) ?? [];
      if (w.number !== undefined) list.push(w.number);
      byStart.set(key, list);
    }
    for (const numbers of byStart.values()) {
      if (numbers.length === 2) expect(numbers[0]).toBe(numbers[1]);
    }
  });

  it("returns null rather than a sparse puzzle when the pool can't reach minWords", () => {
    const tinyPool: WordCandidate[] = [
      { word: "кот", clue: "cat" },
      { word: "дом", clue: "house" },
    ];
    const built = buildCrossword(tinyPool, 6, 6, makeRng("too-small"));
    expect(built).toBeNull();
  });
});
