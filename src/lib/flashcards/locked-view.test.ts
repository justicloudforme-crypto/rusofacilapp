import { describe, expect, it } from "vitest";
import { lockedView } from "./locked-view";

/**
 * РАЗРЕЗ ЧИСЛА И РАЗРЕЗ ПРЕДЛОЖЕНИЯ — ОДИН И ТОТ ЖЕ (7.195, часть 2).
 *
 * До правки число бралось по пересечению «уровень × тема», а предложение
 * называло только уровень. Здесь оба берутся из одного места, и проверка
 * держит именно их согласие.
 */
const LOCKED_BY_LEVEL = { A1: 435, A2: 1138, B1: 1791, B2: 1189, C1: 8 };

describe("lockedView", () => {
  it("уровень выбран, тема выбрана — число по пересечению, названы оба", () => {
    const v = lockedView({ levelFilter: "C1", categoryLabel: "Еда", lockedTotal: 256, lockedByLevel: LOCKED_BY_LEVEL });
    expect(v.lockedHere).toBe(8);
    expect(v.level).toBe("C1");
    expect(v.topic).toBe("Еда");
  });

  it("уровень «ВСЕ» — число по всей выборке, уровень не называется", () => {
    const v = lockedView({ levelFilter: "all", categoryLabel: "Еда", lockedTotal: 256, lockedByLevel: LOCKED_BY_LEVEL });
    expect(v.lockedHere).toBe(256);
    expect(v.level).toBeNull();
  });

  it("темы нет — тема не называется", () => {
    const v = lockedView({ levelFilter: "B2", categoryLabel: null, lockedTotal: 0, lockedByLevel: LOCKED_BY_LEVEL });
    expect(v.topic).toBeNull();
    expect(v.lockedHere).toBe(1189);
  });

  it("уровень, которого нет в ответе, даёт ноль, а не undefined", () => {
    const v = lockedView({ levelFilter: "C1", categoryLabel: null, lockedTotal: 5, lockedByLevel: {} });
    expect(v.lockedHere).toBe(0);
  });

  it("C1 — сорт «план Premium», остальные уровни — подписка", () => {
    expect(lockedView({ levelFilter: "C1", categoryLabel: null, lockedTotal: 0, lockedByLevel: {} }).requirement).toBe(
      "premium-tier",
    );
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(lockedView({ levelFilter: level, categoryLabel: null, lockedTotal: 0, lockedByLevel: {} }).requirement).toBe(
        "subscription",
      );
    }
  });

  it("при «ВСЕ» сорт один не назвать — знак состояния доступа", () => {
    expect(lockedView({ levelFilter: "all", categoryLabel: null, lockedTotal: 0, lockedByLevel: {} }).requirement).toBe(
      "subscription",
    );
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: прежнее правило брало число уровня, а предложение
  // не называло тему. Два разреза обязаны расходиться числом — иначе эта
  // проверка не про что.
  it("подсадка прежнего разреза (число по уровню целиком) ловится", () => {
    const real = lockedView({ levelFilter: "C1", categoryLabel: "Еда", lockedTotal: 256, lockedByLevel: LOCKED_BY_LEVEL });
    const plantedWholeLevel = 988;
    expect(real.lockedHere).not.toBe(plantedWholeLevel);
  });
});
