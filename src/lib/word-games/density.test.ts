import { describe, it, expect } from "vitest";
import {
  MAX_WORDS_PER_CELL,
  OCCUPANCY_LIMIT,
  SEVERE_OCCUPANCY,
  exceedsThreshold,
  isSevere,
  severity,
  worstFirst,
} from "./density";
import type { PuzzleAudit } from "./word-search-audit";

function fake(level: string, sequence: number, occupancy: number, maxOverlap: number, extra: Partial<PuzzleAudit> = {}) {
  return {
    level,
    sequence,
    occupancy,
    maxOverlap,
    fillerCells: Math.round(256 * (1 - occupancy)),
    wordCount: 20,
    ...extra,
  } as PuzzleAudit;
}

describe("density thresholds", () => {
  it("passes a dense-but-clean grid and fails a full or over-crossed one", () => {
    expect(exceedsThreshold(fake("B2", 1, 0.79, 3))).toBe(false);
    expect(exceedsThreshold(fake("B2", 2, 0.81, 2))).toBe(true);
    expect(exceedsThreshold(fake("B2", 3, 0.5, 4))).toBe(true);
  });

  it("severe is the narrower tier inside the flagged one", () => {
    const nearlyFull = fake("B2", 4, 0.95, 2);
    expect(exceedsThreshold(nearlyFull)).toBe(true);
    expect(isSevere(nearlyFull)).toBe(true);
    const merelyDense = fake("B2", 5, 0.85, 2);
    expect(exceedsThreshold(merelyDense)).toBe(true);
    expect(isSevere(merelyDense)).toBe(false);
    expect(OCCUPANCY_LIMIT).toBeLessThan(SEVERE_OCCUPANCY);
  });

  // The two cases the brief names by hand, in the brief's own terms.
  it("ranks the brief's two examples the way the brief does", () => {
    // "old density 110% with overlap ≤ 2" — its occupancy is what decides.
    const looseButLongWords = fake("B2", 6, 0.7, 2);
    // "70% with four words on a cell" — must come out worse.
    const crossedFourWays = fake("B2", 7, 0.7, 4);
    expect(severity(crossedFourWays)).toBeGreaterThan(severity(looseButLongWords));
    expect(exceedsThreshold(looseButLongWords)).toBe(false);
    expect(exceedsThreshold(crossedFourWays)).toBe(true);
  });

  it("but does not accept the brief's premise that low overlap means healthy", () => {
    // The real B2/42: never more than 2 words on a cell, and 8 filler
    // cells in the whole grid. Low overlap did not make it fine.
    const b2_42 = fake("B2", 42, 0.969, 2);
    expect(exceedsThreshold(b2_42)).toBe(true);
    expect(isSevere(b2_42)).toBe(true);
  });

  it("orders worst-first deterministically, ties included", () => {
    const a = fake("B2", 10, 0.9, 2, { fillerCells: 26, wordCount: 27 });
    const b = fake("C1", 10, 0.9, 2, { fillerCells: 26, wordCount: 27 });
    const c = fake("B2", 11, 0.9, 2, { fillerCells: 20, wordCount: 27 });
    const d = fake("A1", 1, 0.4, 1, { fillerCells: 150, wordCount: 8 });
    const order = worstFirst([d, b, a, c]).map((x) => `${x.level}/${x.sequence}`);
    // Fewer filler cells first on a severity tie, then level, then sequence.
    expect(order).toEqual(["B2/11", "B2/10", "C1/10", "A1/1"]);
    expect(worstFirst([d, b, a, c]).map((x) => `${x.level}/${x.sequence}`)).toEqual(order);
  });

  it("MAX_WORDS_PER_CELL is the number the check prints", () => {
    expect(MAX_WORDS_PER_CELL).toBe(3);
  });
});
