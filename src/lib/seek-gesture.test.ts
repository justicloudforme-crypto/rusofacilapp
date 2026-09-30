import { describe, expect, it } from "vitest";
import { SEEK_SLOP_PX, SEEK_TAP_MAX_MS, seekGestureStep, seekIndexAt, type SeekGestureEvent, type SeekGestureState } from "./seek-gesture";

/**
 * ЖЕСТ ПО ПОЛОСКЕ ПЛЕЕРА — ЗАХОД 7.254. Правила — в шапке
 * `seek-gesture.ts`; здесь каждое правило в обе стороны: что перематывает
 * и что НЕ перематывает.
 */

function play(events: SeekGestureEvent[]) {
  let state: SeekGestureState | null = null;
  const commits: number[] = [];
  const previews: (number | null)[] = [];
  for (const event of events) {
    const step = seekGestureStep(state, event);
    state = step.state;
    if (step.commit !== null) commits.push(step.commit);
    previews.push(step.preview);
  }
  return { commits, previews, state };
}

const down = (x: number, y: number, t: number, fraction: number, pointer: "touch" | "mouse" = "touch", pointerId = 1, isPrimary = true): SeekGestureEvent => ({
  type: "down",
  pointerId,
  pointer,
  isPrimary,
  x,
  y,
  t,
  fraction,
});
const move = (x: number, y: number, t: number, fraction: number, pointerId = 1): SeekGestureEvent => ({ type: "move", pointerId, x, y, t, fraction });
const up = (x: number, y: number, t: number, fraction: number, pointerId = 1): SeekGestureEvent => ({ type: "up", pointerId, x, y, t, fraction });

describe("палец по полоске", () => {
  it("тап — один переход в точку тапа, при отпускании", () => {
    const r = play([down(100, 600, 0, 0.4), up(101, 601, 120, 0.41)]);
    expect(r.commits).toEqual([0.41]);
    expect(r.state).toBeNull();
  });

  it("перетаскивание — бегунок за пальцем, переход ОДИН и только при отпускании", () => {
    const r = play([down(300, 600, 0, 0.8), move(280, 601, 30, 0.7), move(200, 602, 60, 0.4), move(120, 603, 90, 0.1), up(110, 603, 950, 0.05)]);
    expect(r.commits).toEqual([0.05]);
    expect(r.previews.slice(1, 4)).toEqual([0.7, 0.4, 0.1]);
  });

  it("лесенка 7.253 (палец ведёт влево по полоске) больше не перематывает на каждом шаге", () => {
    const steps = [0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];
    const r = play([down(298, 609, 0, 0.62), ...steps.map((f, i) => move(298 - (i + 1) * 20, 609, (i + 1) * 13, f))]);
    expect(r.commits).toEqual([]);
  });

  it("прокрутка страницы, начатая на полоске, не перематывает — ни вверх, ни вниз", () => {
    for (const dy of [-60, 60]) {
      const r = play([down(250, 600, 0, 0.5), move(252, 600 + dy / 4, 20, 0.51), move(255, 600 + dy, 60, 0.52), up(255, 600 + dy, 200, 0.52)]);
      expect(r.commits, `dy=${dy}`).toEqual([]);
    }
  });

  it("прокрутка дугой (палец ушёл вниз, потом вбок) — всё ещё прокрутка", () => {
    const r = play([down(250, 600, 0, 0.5), move(252, 630, 20, 0.5), move(300, 634, 40, 0.7), up(300, 634, 200, 0.7)]);
    expect(r.commits).toEqual([]);
  });

  it("прокрутка, которую браузер забрал себе (pointercancel), не перематывает", () => {
    const r = play([down(250, 600, 0, 0.5), move(251, 605, 20, 0.5), { type: "cancel", pointerId: 1 }, up(251, 640, 200, 0.5)]);
    expect(r.commits).toEqual([]);
  });

  it("край ладони: долгое касание без сдвига не перематывает", () => {
    const r = play([down(60, 610, 0, 0.02), up(61, 611, SEEK_TAP_MAX_MS + 400, 0.02)]);
    expect(r.commits).toEqual([]);
  });

  it("второй палец на экране — ни один не перематывает", () => {
    const r = play([down(200, 600, 0, 0.3), down(40, 610, 30, 0, "touch", 2, false), up(40, 610, 80, 0, 2), up(200, 600, 120, 0.3)]);
    expect(r.commits).toEqual([]);
  });

  it("сдвиг меньше порога — всё ещё тап", () => {
    const r = play([down(200, 600, 0, 0.3), move(200 + SEEK_SLOP_PX - 1, 600, 40, 0.33), up(200 + SEEK_SLOP_PX - 1, 600, 150, 0.33)]);
    expect(r.commits).toEqual([0.33]);
  });
});

describe("мышь — как раньше", () => {
  it("переход сразу при нажатии и на каждом шаге", () => {
    const r = play([down(100, 600, 0, 0.2, "mouse"), move(150, 600, 20, 0.4), move(200, 600, 40, 0.6), up(200, 600, 60, 0.6)]);
    expect(r.commits).toEqual([0.2, 0.4, 0.6]);
  });
});

describe("доля полоски → строка", () => {
  // «Репка»: начала строк, с; длина дорожки 89,208 с.
  const offsets = [0, 2.616, 7.584, 13.9, 17.064, 23.976, 27.432, 35.448, 38.352, 50, 60, 70, 78, 85];
  const timeline = { offsets, duration: 89.208 };

  it("по времени — строка, которая звучит в этой точке", () => {
    expect(seekIndexAt(0, 14, timeline)).toBe(0);
    expect(seekIndexAt(25 / 89.208, 14, timeline)).toBe(5);
    expect(seekIndexAt(1, 14, timeline)).toBe(13);
  });

  it("без дорожки — по номеру строки, как прежний ползунок", () => {
    expect(seekIndexAt(0.5, 14, null)).toBe(7);
    expect(seekIndexAt(1, 14, null)).toBe(13);
  });
});
