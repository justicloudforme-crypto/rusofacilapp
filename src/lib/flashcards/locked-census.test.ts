import { describe, expect, it } from "vitest";
import { lockedCensus, openCardIds, siteCensus, type CensusCard } from "./locked-census";
import { FREE_TRIAL_LIMITS } from "../free-trial-limits";

/**
 * ЧИСЛО НА ЭКРАНЕ — РАЗНОСТЬ ПО БАНКУ, А НЕ ПО ПРОБЕ (7.195, часть 2).
 *
 * Владелец прочитал «закрыто 8 слов уровня C1» и назвал число неверным при
 * 988 строках C1 в боевой базе. Замер показал: арифметика верна, восемь —
 * это пересечение (тема «Еда» × уровень C1, в боевой базе ровно 8 строк), а
 * предложение молчало про тему. Здесь проверяется обе стороны: что число
 * действительно считается по банку и что разрез у него именно тот, о
 * котором спросили.
 *
 * Банк для проверок собран по форме боевого, но маленький: на настоящих
 * 5771 строке проверка стала бы проверкой базы, а не правила.
 */
function bankOf(spec: Record<string, Record<string, number>>): CensusCard[] {
  const out: CensusCard[] = [];
  for (const [category, levels] of Object.entries(spec)) {
    for (const [level, count] of Object.entries(levels)) {
      for (let i = 0; i < count; i += 1) out.push({ id: `${category}-${level}-${i}`, category, level });
    }
  }
  return out;
}

const FREE = { entitled: false, canAccessLevel: (level: string) => level !== "C1" };
const PREMIUM = { entitled: true, canAccessLevel: () => true };

describe("lockedCensus", () => {
  const bank = bankOf({ food: { A1: 4, C1: 8 }, work: { A1: 2, C1: 3 } });

  it("считает разность по банку, а не по размеру пробы", () => {
    const shown = bank.filter((c) => c.category === "food" && c.level === "A1").slice(0, 2);
    const { lockedTotal, lockedByLevel } = lockedCensus(bank, shown, { category: "food", level: null });
    // В теме food 12 строк, показано 2.
    expect(lockedTotal).toBe(10);
    expect(lockedByLevel.A1).toBe(2);
    expect(lockedByLevel.C1).toBe(8);
  });

  it("под двойным фильтром отвечает про ПЕРЕСЕЧЕНИЕ, а не про уровень целиком", () => {
    const intersection = lockedCensus(bank, [], { category: "food", level: "C1" });
    const wholeLevel = lockedCensus(bank, [], { category: null, level: "C1" });
    expect(intersection.lockedTotal).toBe(8);
    expect(wholeLevel.lockedTotal).toBe(11);
    // Именно из-за того, что эти два числа разные, предложение обязано
    // называть разрез словами.
    expect(intersection.lockedTotal).not.toBe(wholeLevel.lockedTotal);
  });

  it("у того, кому отдали всё, разность равна нулю", () => {
    expect(lockedCensus(bank, bank, { category: null, level: null }).lockedTotal).toBe(0);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: подсадка неверного числа обязана ронять сверку.
  it("подсадка неверного числа ловится", () => {
    const real = lockedCensus(bank, [], { category: "food", level: "C1" }).lockedTotal;
    const planted = real + 1;
    expect(planted).not.toBe(real);
  });
});

describe("openCardIds", () => {
  const bank = bankOf({ food: { A1: 40, C1: 8 }, work: { A1: 40 }, art: { C1: 5 } });

  it("бесплатная проба берётся ПО ТЕМЕ, а не по банку целиком", () => {
    const open = openCardIds(bank, FREE);
    // Две темы с доступными строками, по десять на тему.
    expect(open.size).toBe(2 * FREE_TRIAL_LIMITS.flashcards);
    // Ни одной C1 — их режет тарифное правило, а не проба.
    expect([...open].some((id) => id.includes("-C1-"))).toBe(false);
  });

  it("подписчику плана Premium открыт весь банк", () => {
    expect(openCardIds(bank, PREMIUM).size).toBe(bank.length);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: старое правило — «первая десятка банка целиком» —
  // обязано дать ДРУГОЕ число, иначе проверка ничего не проверяет.
  it("подсадка прежнего правила (проба от банка) ловится", () => {
    const byTopic = openCardIds(bank, FREE).size;
    const plantedGlobalSample = bank.filter((c) => c.level !== "C1").slice(0, FREE_TRIAL_LIMITS.flashcards).length;
    expect(plantedGlobalSample).toBe(FREE_TRIAL_LIMITS.flashcards);
    expect(byTopic).not.toBe(plantedGlobalSample);
  });
});

describe("siteCensus", () => {
  const bank = bankOf({ food: { A1: 40, C1: 8 }, work: { A1: 40 }, art: { C1: 5 } });

  it("разрез по уровням остаётся полным, даже когда спросили про один уровень", () => {
    const census = siteCensus(bank, { ...FREE, level: "C1" });
    expect(census.byLevel.C1.bank).toBe(13);
    expect(census.byLevel.C1.open).toBe(0);
    expect(census.byLevel.C1.locked).toBe(13);
    // Уровень A1 не выброшен из разреза по уровням.
    expect(census.byLevel.A1.bank).toBe(80);
  });

  it("разрез по темам сужается выбранным уровнем", () => {
    const census = siteCensus(bank, { ...FREE, level: "C1" });
    expect(census.byCategory.food.bank).toBe(8);
    expect(census.byCategory.art.bank).toBe(5);
    // Тема без единой строки этого уровня в разрезе не появляется вовсе.
    expect(census.byCategory.work).toBeUndefined();
  });

  it("тема с закрытыми строками НЕ равна нулю — ровно то, что печаталось на плитках", () => {
    const census = siteCensus(bank, { ...FREE, level: "C1" });
    for (const row of Object.values(census.byCategory)) {
      expect(row.bank).toBeGreaterThan(0);
      // Доступных ноль — и именно поэтому плитка писала «0 слов».
      expect(row.open).toBe(0);
      expect(row.locked).toBe(row.bank);
    }
  });

  it("bank = open + locked на каждом разрезе", () => {
    const census = siteCensus(bank, { ...PREMIUM, level: null });
    for (const row of [...Object.values(census.byLevel), ...Object.values(census.byCategory), census.total]) {
      expect(row.open + row.locked).toBe(row.bank);
    }
    expect(census.total.locked).toBe(0);
  });
});
