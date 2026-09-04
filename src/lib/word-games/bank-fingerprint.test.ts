import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  PROD_BASELINE_PATH,
  bankFingerprint,
  fingerprintMismatch,
  isLegacyBaseline,
} from "./bank-fingerprint";

const bankA = [
  { id: "cuid-a1", level: "A1" },
  { id: "cuid-a2", level: "A1" },
  { id: "cuid-b1", level: "B2" },
];

describe("bankFingerprint", () => {
  it("не зависит от порядка строк", () => {
    expect(bankFingerprint(bankA).idsSha256).toBe(bankFingerprint([...bankA].reverse()).idsSha256);
  });

  it("считает форму банка по уровням", () => {
    expect(bankFingerprint(bankA).byLevel).toEqual({ A1: 2, B2: 1 });
    expect(bankFingerprint(bankA).puzzles).toBe(3);
  });

  it("меняется от одной подменённой строки", () => {
    const other = [...bankA.slice(0, 2), { id: "cuid-другой", level: "B2" }];
    expect(bankFingerprint(other).idsSha256).not.toBe(bankFingerprint(bankA).idsSha256);
  });
});

describe("fingerprintMismatch", () => {
  it("молчит на том же банке", () => {
    expect(fingerprintMismatch(bankFingerprint(bankA), bankFingerprint([...bankA].reverse()))).toEqual([]);
  });

  it("ловит чужой банк той же формы — ровно случай прод против dev.db", () => {
    // Столько же строк, те же уровни, все id другие: две независимые
    // прогонки генератора по разным выборкам из банка карточек.
    const foreign = bankA.map((r) => ({ ...r, id: `${r.id}-чужой` }));
    const reasons = fingerprintMismatch(bankFingerprint(bankA), bankFingerprint(foreign));
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("хэш отсортированных id");
  });

  it("ловит другую форму банка и называет уровень", () => {
    const grown = [...bankA, { id: "cuid-c1", level: "C1" }];
    const reasons = fingerprintMismatch(bankFingerprint(bankA), bankFingerprint(grown));
    expect(reasons[0]).toContain("строк WORD_SEARCH");
    expect(reasons.some((r) => r.startsWith("C1:"))).toBe(true);
  });
});

describe("isLegacyBaseline", () => {
  it("узнаёт плоский снимок без отпечатка", () => {
    expect(isLegacyBaseline({ "WORD_SEARCH/A1/1": { occupancy: 0.5 } })).toBe(true);
  });

  it("не ругается на снимок нового формата", () => {
    expect(
      isLegacyBaseline({ source: "prod", takenAt: "2026-09-02", bank: bankFingerprint(bankA), puzzles: {} }),
    ).toBe(false);
  });
});

/**
 * Сторож против того, что уже случилось однажды: путь к продовому снимку
 * был литералом в двух скриптах сразу, снимок переименовали, поправили
 * один — и `prisma/verify-density-rungs.ts` три дня держал умолчанием
 * путь к удалённому файлу. Дефект молчал, потому что скрипт всегда звали
 * с явным `--baseline=`.
 *
 * Проверяется не «путь равен такой-то строке» — это переписывало бы
 * литерал в тест и ловило бы факт правки, а не дефект. Проверяется, что
 * файл по этому пути СУЩЕСТВУЕТ и читается как снимок, и что литерала с
 * этим путём в скриптах больше нет.
 */
describe("PROD_BASELINE_PATH", () => {
  it("указывает на снимок, который действительно лежит в репозитории", () => {
    expect(existsSync(PROD_BASELINE_PATH), `${PROD_BASELINE_PATH} не существует`).toBe(true);
    const parsed = JSON.parse(readFileSync(PROD_BASELINE_PATH, "utf8"));
    expect(parsed.bank?.idsSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(parsed.puzzles ?? {}).length).toBeGreaterThan(0);
  });

  it("позитивный контроль: несуществующий путь эта проверка обязана поймать", () => {
    expect(existsSync("docs/word-search-baseline-prod-2026-09-02.json")).toBe(false);
  });

  it("остаётся единственным местом, где путь записан строкой", () => {
    // Оба скрипта обязаны ехать за константой, а не носить свою копию.
    for (const file of ["prisma/check-word-search.ts", "prisma/verify-density-rungs.ts"]) {
      const src = readFileSync(file, "utf8");
      const literals = src.match(/"docs\/word-search-baseline-prod-[^"]*"/g) ?? [];
      expect(literals, `${file} держит свою копию пути: ${literals.join(", ")}`).toEqual([]);
      expect(src, `${file} не импортирует PROD_BASELINE_PATH`).toContain("PROD_BASELINE_PATH");
    }
  });
});
