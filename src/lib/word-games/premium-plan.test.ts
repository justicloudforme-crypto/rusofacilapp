// Правило «добавить платность можно, снять — нельзя», проверенное без
// базы. Ситуация, которая привела к появлению этого файла, воспроизведена
// в первом же тесте: лестница, у которой хвост дописан разгрузкой.
import { describe, expect, it } from "vitest";
import { PREMIUM_SHARE, planLadder, wouldRemovePremium } from "./premium-plan";

function ladder(count: number, premiumFrom: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    sequence: i + 1,
    premiumOnly: i + 1 >= premiumFrom,
  }));
}

describe("planLadder", () => {
  it("на нетронутой лестнице не меняет ничего", () => {
    // 100 рунгов, платные — верхние 32 (69…100).
    const plan = planLadder("WORD_SEARCH", "B2", ladder(100, 69));
    expect(plan.premiumCount).toBe(32);
    expect(plan.toPremium).toHaveLength(0);
    expect(plan.toFree).toHaveLength(0);
  });

  it("ловит ровно ту ситуацию, ради которой писался: хвост дописан разгрузкой", () => {
    // Было 100 рунгов, платные 69…100. Разгрузка дописала 10 новых строк
    // (101…110) — по номеру они старшие, по трудности это половинки
    // разгруженных рунгов. Верхние 32% теперь начинаются с 76, и рунги
    // 69…75 прогон объявил бы бесплатными.
    const rows = [...ladder(100, 69), ...ladder(110, 999).slice(100)];
    const plan = planLadder("WORD_SEARCH", "B2", rows);
    expect(plan.toFree.map((r) => r.sequence)).toEqual([75, 74, 73, 72, 71, 70, 69]);
    expect(wouldRemovePremium([plan])).toBe(true);
  });

  it("добавление платности снятием не считается", () => {
    // Ни одна строка не платная — прогон обязан поставить платность и не
    // обязан ни у кого её снимать.
    const plan = planLadder("WORD_SEARCH", "A1", ladder(50, 999));
    expect(plan.toPremium).toHaveLength(16);
    expect(plan.toFree).toHaveLength(0);
    expect(wouldRemovePremium([plan])).toBe(false);
  });

  it("порядок строк на входе ничего не решает", () => {
    const rows = ladder(100, 69);
    const forward = planLadder("WORD_SEARCH", "B2", rows);
    const backward = planLadder("WORD_SEARCH", "B2", [...rows].reverse());
    expect(backward.premiumCount).toBe(forward.premiumCount);
    expect(backward.toFree).toEqual(forward.toFree);
  });

  it("доля не менялась в этом заходе", () => {
    expect(PREMIUM_SHARE).toBe(0.32);
  });
});
