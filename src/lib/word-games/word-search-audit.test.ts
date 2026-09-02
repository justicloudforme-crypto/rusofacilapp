import { describe, it, expect } from "vitest";
import {
  auditPuzzle,
  findStraight,
  findCurved,
  occupancyStats,
  placementAgrees,
  placementCells,
  puzzleInputFromRow,
} from "./word-search-audit";
import type { WordPlacement, WordSearchDirection } from "./types";

const GRID = [
  ["к", "о", "т", "а", "б", "в"],
  ["г", "д", "е", "ж", "з", "и"],
  ["д", "о", "м", "к", "л", "м"],
  ["н", "о", "п", "р", "с", "т"],
  ["с", "ы", "р", "у", "ф", "х"],
  ["ц", "ч", "ш", "щ", "ъ", "ы"],
];

const DIRECTION_NAME: Record<string, WordSearchDirection> = {
  "0,1": "E",
  "0,-1": "W",
  "1,0": "S",
  "-1,0": "N",
  "1,1": "SE",
  "1,-1": "SW",
  "-1,1": "NE",
  "-1,-1": "NW",
};

/** Builds the placement the solver finds, so the test fixtures carry real
 * coordinates rather than made-up ones — occupancy is measured from the
 * stored placement, so a fixture with fake coordinates would measure
 * nothing. A word that is not in the grid gets a deliberately impossible
 * placement (off the board), which is what a broken row looks like. */
function placementFor(word: string): WordPlacement {
  const hit = findStraight(GRID, word);
  if (!hit) return { word, row: -1, col: -1, direction: "E" };
  return { word, row: hit.row, col: hit.col, direction: DIRECTION_NAME[`${hit.dr},${hit.dc}`] };
}

function puzzle(words: string[], curved = false) {
  return {
    id: "t",
    level: "A1",
    sequence: 1,
    curved,
    grid: GRID,
    words: words.map(placementFor),
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

describe("occupancy, overlap and filler", () => {
  it("counts a shared cell once, unlike the old density", () => {
    // "кот" (row 0) and "темп" (column 2) cross at (0,2). Letters: 3 + 4
    // = 7, but only 6 distinct cells are occupied.
    const a = auditPuzzle(puzzle(["кот", "темп"]));
    expect(a.letters).toBe(7);
    expect(a.occupiedCells).toBe(6);
    expect(a.overlap).toEqual({ one: 5, two: 1, three: 0, fourPlus: 0 });
    expect(a.maxOverlap).toBe(2);
  });

  it("filler is the complement of occupancy, and both are reported", () => {
    const a = auditPuzzle(puzzle(["кот", "дом", "сыр"]));
    expect(a.cells).toBe(36);
    expect(a.occupiedCells).toBe(9);
    expect(a.fillerCells).toBe(27);
    expect(a.occupancy).toBeCloseTo(0.25, 5);
    expect(a.fillerShare).toBeCloseTo(0.75, 5);
  });

  // The planted case the check script injects with --plant: four words
  // through one cell, no filler at all.
  const PLANT_GRID = [
    ["а", "б", "в"],
    ["г", "х", "д"],
    ["е", "ж", "з"],
  ];
  const PLANT_WORDS: WordPlacement[] = [
    { word: "гхд", row: 1, col: 0, direction: "E" },
    { word: "бхж", row: 0, col: 1, direction: "S" },
    { word: "ахз", row: 0, col: 0, direction: "SE" },
    { word: "вхе", row: 0, col: 2, direction: "SW" },
  ];

  it("positive control: four words on one cell and zero filler are both seen", () => {
    const stats = occupancyStats(PLANT_GRID, PLANT_WORDS);
    expect(stats.maxOverlap).toBe(4);
    expect(stats.overlap.fourPlus).toBe(1);
    expect(stats.fillerCells).toBe(0);
    expect(stats.occupancy).toBe(1);
    expect(stats.placementMismatches).toEqual([]);
  });

  it("negative control: the same grid with one word is neither full nor overlapped", () => {
    const stats = occupancyStats(PLANT_GRID, [PLANT_WORDS[0]]);
    expect(stats.maxOverlap).toBe(1);
    expect(stats.fillerCells).toBe(6);
    expect(stats.overlap.fourPlus).toBe(0);
  });

  it("a stored placement that does not spell its word is reported, not counted", () => {
    const bogus: WordPlacement = { word: "кот", row: 3, col: 3, direction: "E" };
    const stats = occupancyStats(GRID, [bogus]);
    expect(stats.placementMismatches).toEqual(["кот"]);
    expect(stats.occupiedCells).toBe(0);
    expect(placementAgrees(GRID, bogus)).toBe(false);
  });

  it("a curved word's cells come from its path, not from row/col/direction", () => {
    const bent: WordPlacement = {
      word: "одом",
      row: 0,
      col: 1,
      direction: "S",
      path: [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
      ],
    };
    expect(placementAgrees(GRID, bent)).toBe(true);
    expect(placementCells(bent)).toHaveLength(4);
    // Without the path it would read down column 1: о, д, о, о — not the word.
    expect(placementAgrees(GRID, { ...bent, path: undefined })).toBe(false);
  });
});
