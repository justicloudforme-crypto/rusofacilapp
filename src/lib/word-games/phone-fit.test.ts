import { describe, expect, it } from "vitest";
import {
  MAX_COLS_FULLY_VISIBLE,
  MAX_COLS_WITHIN_LIMIT,
  PAN_STEP_LIMIT,
  boardWidth,
  cellSize,
  gridAvailableWidth,
  hiddenWidth,
  panSteps,
  scrollWidth,
  scrollportWidth,
  withinPhoneLimit,
} from "./phone-fit";

/**
 * Каждое число здесь — это то, что браузер показал на прод-сборке при
 * 320×780 (WebKit и Chromium совпали до сотых, PROGRESS.md 7.94). Тест
 * держит модель прижатой к замеру: если вёрстка изменится, а слагаемые в
 * phone-fit.ts — нет, красным станет здесь, а не в отчёте владельцу.
 */
describe("слагаемые ширины совпадают с замером в браузере", () => {
  it("clientWidth скроллера — 270px", () => {
    expect(scrollportWidth()).toBe(270);
  });

  it("под сетку остаётся 246px", () => {
    expect(gridAvailableWidth()).toBe(246);
  });

  it("клетка у A1/1 (6 столбцов) — 39,33px", () => {
    expect(cellSize(6)).toBeCloseTo(39.33, 2);
  });

  it("клетка у десяти столбцов — 22,8px, у одиннадцати уже пол 22,0px", () => {
    expect(cellSize(10)).toBeCloseTo(22.8, 2);
    expect(cellSize(11)).toBe(22);
  });

  it("самый широкий пазл банка (B1/91, 46 столбцов) — доска 1102px, scrollWidth 1126px", () => {
    expect(boardWidth(46)).toBe(1102);
    expect(scrollWidth(46)).toBe(1126);
    expect(hiddenWidth(46)).toBe(856);
  });
});

describe("метрика «протягиваний до дальнего края»", () => {
  it("доска, которая помещается целиком, требует нуля движений", () => {
    expect(panSteps(6)).toBe(0);
    expect(panSteps(10)).toBe(0);
  });

  it("порог проходит 21 столбец и не проходит 22", () => {
    expect(panSteps(21)).toBe(1);
    expect(panSteps(22)).toBe(2);
    expect(withinPhoneLimit(21)).toBe(true);
    expect(withinPhoneLimit(22)).toBe(false);
  });

  it("границы посчитаны, а не зашиты", () => {
    expect(MAX_COLS_WITHIN_LIMIT).toBe(21);
    expect(MAX_COLS_FULLY_VISIBLE).toBe(10);
    expect(PAN_STEP_LIMIT).toBe(1);
  });

  it("самый широкий пазл банка требует четырёх движений", () => {
    expect(panSteps(46)).toBe(4);
  });

  it("метрика не убывает с ростом числа столбцов", () => {
    for (let n = 2; n <= 60; n += 1) expect(panSteps(n)).toBeGreaterThanOrEqual(panSteps(n - 1));
  });
});
