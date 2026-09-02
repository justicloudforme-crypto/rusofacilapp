// Коридор качества — правилом, а не на глаз. Числа в проверках взяты из
// замера по банку прода 02.09.2026 (см. шапку quality.ts).
import { describe, expect, it } from "vitest";
import {
  BOARD_SIZES,
  CURVED_OCCUPANCY_CEILING,
  CURVED_OCCUPANCY_FLOOR,
  corridorFor,
  corridorTarget,
  judge,
  LONGEST_OVER_SIDE_LIMIT,
  minSideForWord,
  minSideForWords,
  OCCUPANCY_CEILING,
  OCCUPANCY_FLOOR,
  occupancyZone,
} from "./quality";

const straight = (occupancy: number, longestOverMinSide = 0.5) => ({
  occupancy,
  longestOverMinSide,
  curved: false,
});

describe("коридор занятости", () => {
  it("тот самый пазл из захода — 75% занятости — вне коридора", () => {
    // 10×10, 10 слов, 78 букв, перекрытий 3, занято 75%: по порогу
    // density.ts (80%) он «нормальный», и ровно поэтому коридор — вторая
    // величина, а не та же самая.
    const verdict = judge(straight(0.75));
    expect(verdict.zone).toBe("перегружен");
    expect(verdict.ok).toBe(false);
  });

  it("разрежённый край наказывается так же, как перегруженный", () => {
    expect(occupancyZone(0.3, false)).toBe("разрежён");
    expect(occupancyZone(0.44, false)).toBe("разрежён");
    expect(occupancyZone(0.45, false)).toBe("коридор");
    expect(occupancyZone(0.65, false)).toBe("коридор");
    expect(occupancyZone(0.66, false)).toBe("перегружен");
  });

  it("★ судится по своему коридору, сдвинутому вниз", () => {
    expect(corridorFor(true).floor).toBe(CURVED_OCCUPANCY_FLOOR);
    expect(corridorFor(true).ceiling).toBe(CURVED_OCCUPANCY_CEILING);
    expect(corridorFor(false).floor).toBe(OCCUPANCY_FLOOR);
    expect(corridorFor(false).ceiling).toBe(OCCUPANCY_CEILING);
    // 60% — коридор для прямого пазла и перегруз для гнутого: гнутое
    // слово не имеет права идти вплотную к себе и съедает больше места.
    expect(occupancyZone(0.6, false)).toBe("коридор");
    expect(occupancyZone(0.6, true)).toBe("перегружен");
    // И наоборот: 40% для ★ — коридор, для прямого — разрежённость.
    expect(occupancyZone(0.4, true)).toBe("коридор");
    expect(occupancyZone(0.4, false)).toBe("разрежён");
  });

  it("цель — середина коридора, а не его потолок", () => {
    expect(corridorTarget(false)).toBeCloseTo(0.55, 10);
    expect(corridorTarget(true)).toBeCloseTo(0.45, 10);
  });

  it("коридор шире шага, которым укладчик умеет двигать занятость", () => {
    // Одно слово в 9 букв — это 9 п.п. на сетке 10×10. Коридор уже 10 п.п.
    // вмещал бы на малой сетке одно допустимое число слов, а часто ни
    // одного. Здесь ширина 20 п.п. — минимум два слова на самой мелкой
    // сетке банка.
    const width = OCCUPANCY_CEILING - OCCUPANCY_FLOOR;
    expect(width).toBeGreaterThanOrEqual(2 * (9 / 100));
  });
});

describe("потолок длиннейшего слова", () => {
  it("ловит слово, лежащее через всю сторону — жалоба захода", () => {
    // Слово 8 букв на стороне 10 = 0,80 — на границе; 8 на 8 = 1,0.
    expect(judge(straight(0.55, 0.88)).longWord).toBe(true);
    expect(judge(straight(0.55, 0.8)).longWord).toBe(false);
    expect(LONGEST_OVER_SIDE_LIMIT).toBe(0.8);
  });

  it("две оси считаются отдельно: они лечатся по-разному", () => {
    // В коридоре, но со слишком длинным словом: лечится размером доски.
    const long = judge(straight(0.55, 0.88));
    expect(long.zone).toBe("коридор");
    expect(long.ok).toBe(false);
    // Перегружен, но слова короткие: лечится числом сеток.
    const packed = judge(straight(0.9, 0.5));
    expect(packed.longWord).toBe(false);
    expect(packed.ok).toBe(false);
  });

  it("потолок достижим при КАЖДОЙ длине слова, которая есть в банке", () => {
    // Банк держит слова до 14 букв (замер 02.09.2026). Если бы для
    // какой-то длины не находилось стороны, правило требовало бы
    // несуществующей доски — а это правило, которое нельзя выполнить.
    for (let length = 3; length <= 14; length++) {
      const side = minSideForWord(length);
      expect(side).not.toBeNull();
      expect(BOARD_SIZES).toContain(side!);
      expect(length / side!).toBeLessThanOrEqual(LONGEST_OVER_SIDE_LIMIT);
    }
    // Именно поэтому потолок 0,80, а не 0,75: слово в 14 букв потребовало
    // бы стороны 19, которой нет (14/18 = 0,778).
    expect(minSideForWord(14)).toBe(18);
    expect(14 / 18).toBeLessThanOrEqual(0.8);
    expect(14 / 18).toBeGreaterThan(0.75);
  });

  it("слово длиннее любой доски — это null, а не молчаливые 18", () => {
    expect(minSideForWord(15)).toBeNull();
    expect(minSideForWords([{ word: "пятнадцатибуквен" }])).toBeNull();
  });

  it("по списку берётся самое длинное слово", () => {
    expect(minSideForWords([{ word: "кот" }, { word: "самоуправление" }])).toBe(18);
    expect(minSideForWords([{ word: "кот" }, { word: "дом" }])).toBe(8);
  });
});
