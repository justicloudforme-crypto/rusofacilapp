// Invariants the density manifest has to satisfy BEFORE anything runs it
// against production. Everything here is checkable without a database:
// the manifest is a promise about a final state, and a promise that
// contradicts itself should fail in CI, not in a prod write.
import { describe, expect, it } from "vitest";
import {
  DENSITY_SPLITS,
  densityLevels,
  densityTailCount,
  densityTails,
  findDensitySplit,
  isDensityOwnedRung,
  ladderGaps,
} from "./density-rungs";
import { FREE_TRIAL_LIMITS } from "@/lib/entitlement";
import { isFreeWordGamePuzzle } from "./free-tier";

describe("density-rungs manifest", () => {
  it("promises exactly as many tail rungs as it promises parts", () => {
    for (const s of DENSITY_SPLITS) {
      expect(s.tailSequences.length, `${s.level}/${s.sequence}`).toBe(s.parts - 1);
    }
  });

  // Через isFreeWordGamePuzzle, а не через `sequence > лимит`. Бесплатность
  // — это `level !== "C1" && sequence <= 10`, и сравнение по одному номеру
  // объявляло бы бесплатным C1/10, который бесплатным не был никогда: у C1
  // бесплатных рунгов нет вовсе. Тест, повторяющий правило своими словами,
  // сторожит свою копию правила, а не правило.
  it("never splits a free rung — the sitemap and robots rule must not move", () => {
    for (const s of DENSITY_SPLITS) {
      for (const seq of [s.sequence, ...s.tailSequences]) {
        expect(
          isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: s.level, sequence: seq }),
          `${s.level}/${seq} is a free rung`,
        ).toBe(false);
      }
    }
  });

  // Та же проверка с другой стороны: правило не должно молчать, если рунг
  // ДЕЙСТВИТЕЛЬНО бесплатный. Без этого предыдущий тест зелен и на пустом
  // манифесте, и на сломанной isFreeWordGamePuzzle.
  it("would catch a genuinely free rung", () => {
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "B2", sequence: 10 })).toBe(true);
    expect(isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: "C1", sequence: 10 })).toBe(false);
    expect(FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel).toBe(10);
  });

  it("names no rung twice — neither as a source nor as a tail", () => {
    const seen = new Set<string>();
    for (const s of DENSITY_SPLITS) {
      for (const seq of [s.sequence, ...s.tailSequences]) {
        const key = `${s.level}/${seq}`;
        expect(seen.has(key), `${key} appears twice in the manifest`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("keeps every level's tail block contiguous with the ladder it extends", () => {
    // The manifest cannot know how long a level's ladder is — that is a
    // database fact — but it CAN be checked for a gap inside its own tail
    // block: 328,329,331 is wrong no matter what the ladder ends at.
    for (const level of densityLevels()) {
      const tails = densityTails(level);
      const expected = Array.from({ length: tails.length }, (_, i) => tails[0] + i);
      expect(tails, `${level} tail block has a hole`).toEqual(expected);
    }
  });

  it("counts tails per level the way the generator's ladder maths does", () => {
    for (const level of densityLevels()) {
      expect(densityTailCount(level)).toBe(densityTails(level).length);
    }
    expect(densityTailCount("A1")).toBe(0);
  });

  it("owns exactly the rungs it names, and only for WORD_SEARCH", () => {
    const s = DENSITY_SPLITS[0];
    expect(isDensityOwnedRung("WORD_SEARCH", s.level, s.sequence)).toBe(true);
    expect(isDensityOwnedRung("WORD_SEARCH", s.level, s.tailSequences[0])).toBe(true);
    expect(isDensityOwnedRung("CROSSWORD", s.level, s.sequence)).toBe(false);
    expect(findDensitySplit(s.level, s.sequence)).toBe(s);
    expect(findDensitySplit(s.level, 999_999)).toBeUndefined();
  });
});

describe("ladderGaps", () => {
  it("is silent on a ladder that stays 1…N", () => {
    expect(ladderGaps([1, 2, 3], [4, 5])).toEqual([]);
  });

  it("names the missing numbers when the tail starts past the end", () => {
    // The real failure: 3 rows, a tail written at 5 — the picker renders
    // links 1…4, so row 5 is unreachable and link 4 is a 404.
    expect(ladderGaps([1, 2, 3], [5])).toEqual([4]);
  });

  it("names a hole left inside an existing ladder too", () => {
    expect(ladderGaps([1, 3], [])).toEqual([2]);
  });

  it("treats an empty ladder as gapless rather than as a hole at 1", () => {
    expect(ladderGaps([], [])).toEqual([]);
  });
});
