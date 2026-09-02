import { describe, expect, it } from "vitest";
import { classifyRung, medianOccupancy, selectSplits } from "./rung-class";
import type { PuzzleAudit } from "./word-search-audit";

function audit(level: string, sequence: number, occupancy: number, maxOverlap: number): PuzzleAudit {
  return {
    id: `${level}-${sequence}`,
    level,
    sequence,
    curved: false,
    rows: 16,
    cols: 16,
    cells: 256,
    wordCount: 20,
    letters: 100,
    density: occupancy,
    longestWord: "слово",
    longestLength: 5,
    minSide: 16,
    maxSide: 16,
    longestOverMinSide: 0.3,
    impossibleByLength: false,
    missing: [],
    undecided: [],
    placementMismatches: [],
    occupiedCells: Math.round(occupancy * 256),
    occupancy,
    fillerCells: 256 - Math.round(occupancy * 256),
    fillerShare: 1 - occupancy,
    overlap: { one: 0, two: 0, three: 0, fourPlus: 0 },
    maxOverlap,
  };
}

describe("medianOccupancy", () => {
  it("нечётное число — средний элемент", () => {
    expect(medianOccupancy([audit("A1", 1, 0.4, 1), audit("A1", 2, 0.6, 1), audit("A1", 3, 0.5, 1)])).toBeCloseTo(0.5);
  });
  it("чётное — среднее двух средних", () => {
    expect(medianOccupancy([audit("A1", 1, 0.4, 1), audit("A1", 2, 0.6, 1)])).toBeCloseTo(0.5);
  });
});

describe("classifyRung", () => {
  it("занятость выше медианы — разгрузка", () => {
    expect(classifyRung(audit("C1", 1, 0.92, 2), 0.65)).toBe("разгрузка");
  });

  it("перекрытие 4 при занятости НИЖЕ медианы — класс размещения, не разгрузка", () => {
    expect(classifyRung(audit("C1", 114, 0.6, 4), 0.65)).toBe("размещение");
  });

  it("перекрытие 4 при занятости ВЫШЕ медианы — всё-таки разгрузка: рунгу тесно", () => {
    expect(classifyRung(audit("C1", 114, 0.9, 4), 0.65)).toBe("разгрузка");
  });

  it("ровно медиана — не выше её, значит не разгрузка", () => {
    expect(classifyRung(audit("B1", 5, 0.65, 2), 0.65)).toBe("здоров");
    expect(classifyRung(audit("B1", 6, 0.65, 3), 0.65)).toBe("размещение");
  });
});

describe("selectSplits", () => {
  it("узел с низкой занятостью вытесняется следующим по тяжести", () => {
    const audits = [
      // Тяжесть 0.6 + 0.2 = 0.80 — первый по тяжести, но занятость ниже медианы.
      audit("C1", 114, 0.6, 4),
      audit("B2", 1, 0.78, 2),
      audit("B2", 2, 0.76, 2),
      audit("A1", 1, 0.3, 1),
      audit("A1", 2, 0.31, 1),
    ];
    const { chosen, skipped, median } = selectSplits(audits, 2);
    expect(median).toBeCloseTo(0.6);
    expect(chosen.map((c) => `${c.audit.level}/${c.audit.sequence}`)).toEqual(["B2/1", "B2/2"]);
    expect(skipped.map((c) => `${c.audit.level}/${c.audit.sequence}`)).toEqual(["C1/114"]);
    expect(skipped[0].klass).toBe("размещение");
    expect(skipped[0].rank).toBe(1);
  });

  it("берёт не больше, чем попросили", () => {
    const audits = Array.from({ length: 30 }, (_, i) => audit("B2", i + 1, 0.5 + i * 0.01, 2));
    expect(selectSplits(audits, 5).chosen).toHaveLength(5);
  });
});
