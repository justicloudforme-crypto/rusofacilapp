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
import { BOARD_SIZES } from "./quality";

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

  // Добавлено 03.09.2026 (PROGRESS 7.101). Размер доски перестал быть
  // наследством и стал ЧАСТЬЮ манифеста (7.85), а сторож на него так и
  // не завели: `sizes` мог разойтись с `parts` или назвать сторону,
  // которой банк не держит, и поймалось бы это только у прода.
  it("gives every part a side, and only a side the bank actually has", () => {
    for (const s of DENSITY_SPLITS) {
      expect(s.sizes, `${s.level}/${s.sequence}`).toHaveLength(s.parts);
      for (const size of s.sizes) {
        expect(BOARD_SIZES, `${s.level}/${s.sequence}`).toContain(size);
      }
    }
  });

  // Смена размера доски — часть, не создающая строки (7.85). Раньше
  // такой записи в манифесте не бывало, и `parts: 1` с непустым хвостом
  // ничем не отлавливался.
  it("asks for no tail when one board is enough", () => {
    const sizeOnly = DENSITY_SPLITS.filter((s) => s.parts === 1);
    expect(sizeOnly.length).toBeGreaterThan(0);
    for (const s of sizeOnly) expect(s.tailSequences, `${s.level}/${s.sequence}`).toEqual([]);
  });

  // Сторож против ровно того расхождения, которое уже случилось:
  // код-PR захода 7.85/7.86 не был смёржен, `DENSITY_SPLITS` в main
  // описывал 20 записей при 78 строках, тронутых в проде, и первый
  // полный прогон генератора удалил бы 38 из них как «устаревшие»
  // (PROGRESS 7.101). Числа тут — про ПРИМЕНЁННОЕ, то есть про то, что
  // прод носит прямо сейчас; неприменённые порции сюда не входят
  // намеренно.
  it("describes every row already written to production", () => {
    const applied = DENSITY_SPLITS.filter((s) => s.applied);
    expect(applied).toHaveLength(605);
    expect(applied.reduce((n, s) => n + s.tailSequences.length, 0)).toBe(58);
    expect(applied.filter((s) => s.level === "B1").flatMap((s) => s.tailSequences)).toHaveLength(9);
    expect(applied.filter((s) => s.level === "B2").flatMap((s) => s.tailSequences)).toHaveLength(22);
    expect(applied.filter((s) => s.level === "C1").flatMap((s) => s.tailSequences)).toHaveLength(27);
  });

  // Порция 1 (124 рунга, записана 03.09) хвостов не создаёт вовсе:
  // parts: 1 — это UPDATE существующей строки и ничего больше. Число
  // хвостов выше поэтому осталось 58, хотя применённых записей стало
  // 184, — и именно это здесь и проверяется, чтобы «184 против 58» не
  // выглядело опечаткой в следующем заходе.
  it("counts the 03.09 portion as applied without adding a single tail", () => {
    const p1 = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-03");
    expect(p1).toHaveLength(124);
    expect(p1.every((s) => s.parts === 1 && s.tailSequences.length === 0)).toBe(true);
    expect(p1.filter((s) => s.sizes.includes(18))).toHaveLength(0);
    expect(Object.entries(
      p1.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 39], ["A2", 51], ["B1", 24], ["B2", 6], ["C1", 4]]);
  });

  // Порция 2 целиком: 421 рунг, каждый — одна доска 18×18 и ноль новых
  // строк. Сторож ровно на цену порции: если сюда однажды заедет запись
  // с parts > 1, порция перестанет быть бесплатной по строкам и URL, а
  // таблицы в PROGRESS 7.106 и 7.107 будут врать молча. Утверждение
  // адресуется группе по дате, а не «всем неприменённым»: с записью
  // 04.09 неприменённых не осталось вовсе, и версия «через !applied»
  // проходила бы на пустом множестве — тот самый ноль без контроля.
  // Поэтому непустота группы проверяется отдельной строкой, ПЕРЕД
  // утверждениями «каждый из них такой-то»: без неё все три `every`
  // зелены на пустом массиве.
  it("keeps all of portion 2 at zero new rows and one board each", () => {
    const portion2 = DENSITY_SPLITS.filter((s) => s.applied === "2026-09-04");
    expect(portion2.length).toBeGreaterThan(0);
    expect(portion2).toHaveLength(421);
    expect(portion2.every((s) => s.parts === 1)).toBe(true);
    expect(portion2.every((s) => s.tailSequences.length === 0)).toBe(true);
    expect(portion2.every((s) => s.sizes.length === 1 && s.sizes[0] === 18)).toBe(true);
    expect(new Set(portion2.map((s) => s.level))).toEqual(new Set(["A1", "A2", "B1", "B2", "C1"]));
    // Разбивка по уровням — перемер против живого прода 04.09 (7.107):
    // пилот A1 3 / A2 3 / B1 6 / B2 5 / C1 3 плюс остаток
    // A1 20 / A2 86 / B1 140 / B2 95 / C1 60.
    expect(Object.entries(
      portion2.reduce<Record<string, number>>((a, s) => ({ ...a, [s.level]: (a[s.level] ?? 0) + 1 }), {}),
    ).sort()).toEqual([["A1", 23], ["A2", 89], ["B1", 146], ["B2", 100], ["C1", 63]]);
  });

  // Весь манифест применён — значит прогон разгрузки без --only= сейчас
  // не выбрал бы ни одного рунга. Порции 3–5 в манифест НЕ внесены
  // намеренно и ждут решения владельца (7.107).
  it("has nothing pending — portions 3-5 are deliberately absent", () => {
    expect(DENSITY_SPLITS.filter((s) => !s.applied)).toHaveLength(0);
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
