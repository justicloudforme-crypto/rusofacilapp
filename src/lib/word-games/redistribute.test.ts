import { describe, it, expect } from "vitest";
import { boardSizeMismatches, dealWords, splitPuzzle, SPLIT_TARGET_OCCUPANCY, MIN_PART_OCCUPANCY } from "./redistribute";
import { DENSITY_SPLITS, densityTailCount, isDensityOwnedRung, findDensitySplit } from "./density-rungs";
import { occupancyStats } from "./word-search-audit";

const WORDS = [
  "жаропонижающее","обескураженный","госпитализация","самоуправление","плиссированный",
  "определённость","самозанятость","решительность","самопринятие","галлюцинация",
  "оптимизация","психоанализ","калорийный","ипохондрия","сублимация",
  "рвануться","метеорит","подделка","принятие","плацебо",
  "зачатие","ветеран","пульсар","циклон","сюжет","склад","кураж",
].map((word) => ({ word, clue: `clue for ${word}` }));

describe("splitting an over-packed puzzle", () => {
  it("deals every word exactly once, and balances the long ones", () => {
    const buckets = dealWords(WORDS, 3);
    expect(buckets.flat().map((w) => w.word).sort()).toEqual(WORDS.map((w) => w.word).sort());
    const letters = buckets.map((b) => b.reduce((n, w) => n + w.word.length, 0));
    expect(Math.max(...letters) - Math.min(...letters)).toBeLessThanOrEqual(14);
  });

  it("keeps every word and lands every part under the split target", () => {
    const result = splitPuzzle(WORDS, 16, "test-seed");
    expect(result).not.toBeNull();
    expect([...result!.wordsOut].sort()).toEqual(WORDS.map((w) => w.word).sort());
    for (const part of result!.parts) {
      expect(part.occupancy).toBeLessThanOrEqual(SPLIT_TARGET_OCCUPANCY);
      expect(part.occupancy).toBeGreaterThanOrEqual(MIN_PART_OCCUPANCY);
      expect(part.maxOverlap).toBeLessThanOrEqual(3);
      // Every stored placement in a part really spells its word.
      expect(occupancyStats(part.grid.grid, part.words).placementMismatches).toEqual([]);
    }
  });

  it("is deterministic — the same seed gives the same grids", () => {
    const a = splitPuzzle(WORDS, 16, "same-seed")!;
    const b = splitPuzzle(WORDS, 16, "same-seed")!;
    expect(JSON.stringify(a.parts.map((p) => p.grid))).toBe(JSON.stringify(b.parts.map((p) => p.grid)));
  });

  it("refuses rather than dropping a word it cannot place", () => {
    // A grid this small cannot hold these words; the splitter must return
    // null, not a part with words missing.
    expect(splitPuzzle(WORDS, 4, "tiny")).toBeNull();
  });
});

describe("the redistribution manifest", () => {
  it("names twenty paid rungs, none of them free or themed", () => {
    // Two rounds of ten: 7.78 and 7.80.
    expect(DENSITY_SPLITS).toHaveLength(20);
    for (const s of DENSITY_SPLITS) expect(s.sequence).toBeGreaterThan(10);
  });

  it("gives every leftover part its own tail sequence, with no collisions", () => {
    const all = DENSITY_SPLITS.flatMap((s) => s.tailSequences.map((n) => `${s.level}/${n}`));
    expect(new Set(all).size).toBe(all.length);
    for (const s of DENSITY_SPLITS) expect(s.tailSequences).toHaveLength(s.parts - 1);
    // A tail sequence must never collide with a split source either.
    const sources = new Set(DENSITY_SPLITS.map((s) => `${s.level}/${s.sequence}`));
    for (const t of all) expect(sources.has(t)).toBe(false);
  });

  it("counts the tail per level the way the generator's cleanup needs", () => {
    expect(densityTailCount("B2")).toBe(13);
    expect(densityTailCount("B1")).toBe(1);
    expect(densityTailCount("C1")).toBe(10);
    expect(densityTailCount("A1")).toBe(0);
  });

  it("claims ownership of both a split source and its tail, and of nothing else", () => {
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 44)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 328)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", "B2", 45)).toBe(false);
    // Same numbers on the other game type must not be claimed.
    expect(isDensityOwnedRung("CROSSWORD", "B2", 44)).toBe(false);
    expect(findDensitySplit("C1", 139)?.parts).toBe(3);
  });
});

describe("boardSizeMismatches", () => {
  const grid = (rows: number, cols: number) => ({
    grid: { grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "а")) },
  });

  it("молчит, когда все части того же размера, что источник", () => {
    expect(boardSizeMismatches({ rows: 18, cols: 18 }, [grid(18, 18), grid(18, 18)])).toEqual([]);
  });

  it("ловит уменьшенную доску — случай 18×18, пересобранной в 16×16", () => {
    const out = boardSizeMismatches({ rows: 18, cols: 18 }, [grid(18, 18), grid(16, 16)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("часть 2");
    expect(out[0]).toContain("16×16");
  });

  it("ловит раздутую доску — лёгкий рунг 10×10, пересобранный в 16×16", () => {
    expect(boardSizeMismatches({ rows: 10, cols: 10 }, [grid(16, 16)])).toHaveLength(1);
  });

  it("ловит подмену в ПЕРВОЙ части — она пишется в существующую строку", () => {
    const out = boardSizeMismatches({ rows: 16, cols: 16 }, [grid(14, 14), grid(16, 16)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("часть 1");
  });
});
