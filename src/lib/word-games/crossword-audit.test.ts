import { describe, expect, it } from "vitest";
import { auditCrossword, crosswordInputFromRow, normalizeBankWord, type CrosswordInput } from "./crossword-audit";

/**
 *   к о т . .
 *   . к . . .
 *   . н . . .
 *   . о . . .
 *   . . . . .
 */
function clean(): CrosswordInput {
  return {
    id: "clean",
    level: "A1",
    sequence: 1,
    grid: [
      ["к", "о", "т", "", ""],
      ["", "к", "", "", ""],
      ["", "н", "", "", ""],
      ["", "о", "", "", ""],
      ["", "", "", "", ""],
    ],
    words: [
      { word: "кот", row: 0, col: 0, direction: "E" },
      { word: "окно", row: 0, col: 1, direction: "S" },
    ],
  };
}

const BANK = new Set(["кот", "окно", "акно", "елка"].map(normalizeBankWord));

describe("auditCrossword", () => {
  it("чистый кроссворд не даёт ни одной проблемы", () => {
    const a = auditCrossword(clean(), BANK);
    expect(a.problems).toEqual([]);
    expect(a.solvable).toBe(true);
    expect(a.isolatedWords).toEqual([]);
    expect(a.orphanCells).toBe(0);
    expect(a.holeCells).toBe(0);
  });

  it("ловит битое пересечение — и ловит его по списку слов, а не по сетке", () => {
    const base = clean();
    const broken: CrosswordInput = {
      ...base,
      words: base.words.map((w) => (w.direction === "S" ? { ...w, word: "акно" } : w)),
    };
    const a = auditCrossword(broken, BANK);
    expect(a.intersectionMismatches).toHaveLength(1);
    expect(a.solvable).toBe(false);
  });

  it("ловит сдвинутую координату", () => {
    const base = clean();
    const shifted: CrosswordInput = {
      ...base,
      words: base.words.map((w) => (w.word === "кот" ? { ...w, col: 1 } : w)),
    };
    const a = auditCrossword(shifted, BANK);
    expect(a.placementMismatches).toContain("кот");
    expect(a.solvable).toBe(false);
  });

  it("ловит лишнюю букву в сетке", () => {
    const base = clean();
    base.grid[4][4] = "щ";
    const a = auditCrossword(base, BANK);
    expect(a.orphanCells).toBe(1);
  });

  it("ловит слово, уходящее за край", () => {
    const base = clean();
    const a = auditCrossword(
      { ...base, words: [...base.words, { word: "кототот", row: 0, col: 0, direction: "E" }] },
      BANK,
    );
    expect(a.placementMismatches).toContain("кототот");
  });

  it("считает изолированным слово без единого пересечения", () => {
    const grid = clean().grid.map((r) => [...r]);
    grid[4][3] = "д";
    grid[4][4] = "а";
    const a = auditCrossword(
      {
        ...clean(),
        grid,
        words: [...clean().words, { word: "да", row: 4, col: 3, direction: "E" }],
      },
      BANK,
    );
    expect(a.isolatedWords).toEqual(["да"]);
  });

  it("«ё» и регистр не считаются словом вне банка", () => {
    const a = auditCrossword(
      {
        ...clean(),
        grid: [["ё", "л", "к", "а", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]],
        words: [{ word: "Ёлка", row: 0, col: 0, direction: "E" }],
      },
      BANK,
    );
    expect(a.wordsNotInBank).toEqual([]);
  });

  it("различает дубль буква в букву и дубль после нормализации «ё»", () => {
    const grid = [
      ["в", "с", "ё", "", ""],
      ["", "", "", "", ""],
      ["в", "с", "е", "", ""],
      ["", "", "", "", ""],
      ["", "", "", "", ""],
    ];
    const a = auditCrossword(
      {
        ...clean(),
        grid,
        words: [
          { word: "всё", row: 0, col: 0, direction: "E" },
          { word: "все", row: 2, col: 0, direction: "E" },
        ],
      },
      new Set(["все"]),
    );
    expect(a.duplicateWords).toEqual([]);
    expect(a.duplicateWordsNormalized).toEqual(["все"]);
  });

  it("направление, которого у кроссворда не бывает, — это дефект", () => {
    const base = clean();
    const a = auditCrossword(
      { ...base, words: base.words.map((w) => (w.word === "кот" ? { ...w, direction: "SE" as const } : w)) },
      BANK,
    );
    expect(a.problems.join(" ")).toContain("SE");
  });

  it("строка с неразбираемым JSON возвращает null, а не бросает", () => {
    expect(crosswordInputFromRow({ id: "x", level: "A1", sequence: 1, gridData: "{", words: "[]" })).toBeNull();
  });
});
