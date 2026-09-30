import { describe, expect, it } from "vitest";
import { skipTarget } from "./story-skip";

/**
 * ⏪ / ⏩ ПО ДОРОЖКЕ РАССКАЗА — ЗАХОД 7.255. Правило — в шапке
 * `story-skip.ts`. Числа — «Дня стирки»: место на шестой строке 26,208 с,
 * дорожка 80,82 с.
 */
describe("skipTarget", () => {
  it("до первого «▶» ⏪ считает от сохранённого места, а не от нуля", () => {
    expect(skipTarget(0, 26.208, -15, 80.82)).toBeCloseTo(11.208, 3);
  });

  it("до первого «▶» ⏩ считает от сохранённого места", () => {
    expect(skipTarget(0, 26.208, 15, 80.82)).toBeCloseTo(41.208, 3);
  });

  it("место ближе 15 с к началу — ⏪ даёт ноль, не меньше", () => {
    expect(skipTarget(0, 10, -15, 80.82)).toBe(0);
  });

  it("⏩ у конца — не дальше длины", () => {
    expect(skipTarget(0, 75, 15, 80.82)).toBe(80.82);
  });

  it("во время игры — от того, где дорожка, ровно 15 с", () => {
    expect(skipTarget(40, null, -15, 80.82)).toBe(25);
    expect(skipTarget(40, null, 15, 80.82)).toBe(55);
  });

  it("длина ещё неизвестна — вперёд без потолка", () => {
    expect(skipTarget(0, 26.208, 15, Number.NaN)).toBeCloseTo(41.208, 3);
    expect(skipTarget(10, null, 15, 0)).toBe(25);
  });

  it("контроль: старое правило (от currentTime) дало бы ноль — новое нет", () => {
    const old = Math.min(Math.max(0, 0 - 15), 80.82);
    expect(old).toBe(0);
    expect(skipTarget(0, 26.208, -15, 80.82)).not.toBe(old);
  });
});
