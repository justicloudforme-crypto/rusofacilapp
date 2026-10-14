import { describe, expect, it } from "vitest";
import { MIN_INTERVAL_MS, shouldAskForReview, type ReviewState } from "./app-review";

const H = 60 * 60 * 1000;
const D = 24 * H;
const now = Date.UTC(2026, 9, 14, 12, 0, 0);
const ready: ReviewState = { firstSuccessAt: now - 2 * D, successes: 3, lastAskedAt: null };
const ask = (state: ReviewState, extra: Partial<{ lastPurchaseAt: number | null; online: boolean }> = {}) =>
  shouldAskForReview({ state, now, lastPurchaseAt: null, online: true, ...extra });

describe("окно оценки — когда просить (7.266)", () => {
  it("третий успех, второй день, сеть есть — просим", () => expect(ask(ready)).toBe(true));
  it("два успеха — рано", () => expect(ask({ ...ready, successes: 2 })).toBe(false));
  it("первая сессия (первый успех час назад) — не просим", () =>
    expect(ask({ ...ready, firstSuccessAt: now - H, successes: 5 })).toBe(false));
  it("просили 29 дней назад — не просим", () => expect(ask({ ...ready, lastAskedAt: now - 29 * D })).toBe(false));
  it("просили 30 дней назад — можно снова", () => expect(ask({ ...ready, lastAskedAt: now - MIN_INTERVAL_MS })).toBe(true));
  it("покупка 2 часа назад — не просим", () => expect(ask(ready, { lastPurchaseAt: now - 2 * H })).toBe(false));
  it("покупка 2 дня назад — можно", () => expect(ask(ready, { lastPurchaseAt: now - 2 * D })).toBe(true));
  it("без сети — не просим", () => expect(ask(ready, { online: false })).toBe(false));
});
