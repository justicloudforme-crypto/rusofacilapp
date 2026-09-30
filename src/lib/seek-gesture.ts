/**
 * ЖЕСТ ПО ПОЛОСКЕ ПЛЕЕРА РАССКАЗА — ЗАХОД 7.254.
 *
 * Решение владельца 30.09.2026: перемотка пальцем по полоске НУЖНА, её
 * отключение в 7.253 — не починка. Здесь — правила, по которым касание
 * полоски становится (или НЕ становится) перемоткой. Чистая функция без
 * DOM: её гоняют юнит-тест и сторож R8 `check:story-player-truth`
 * (последний — прямо этот файл, без сборки).
 *
 * Палец (и стилус):
 *   * короткий тап без сдвига — переход в точку тапа, при отпускании;
 *   * перетаскивание (сдвиг по горизонтали раньше, чем по вертикали) —
 *     бегунок едет за пальцем, переход — ОДИН, при отпускании, в точку
 *     отпускания;
 *   * прокрутка страницы, начатая на полоске (сдвиг по вертикали первым),
 *     не перематывает — это и был случай 7.253 (лесенка 8 → 0);
 *   * долгое касание без сдвига (край ладони лёг на полоску) не
 *     перематывает;
 *   * второй палец на экране или отмена жеста браузером — не перематывают.
 *
 * Мышь — как было у ползунка до 7.253: переход сразу при нажатии и на
 * каждом шаге движения с зажатой кнопкой.
 */

/** Сдвиг, после которого жест решён — перетаскивание или прокрутка, CSS px. */
export const SEEK_SLOP_PX = 10;
/** Касание длиннее этого без сдвига — лежащая ладонь, а не тап, мс. */
export const SEEK_TAP_MAX_MS = 500;

export type SeekPointer = "mouse" | "touch";

export interface SeekGestureState {
  pointerId: number;
  pointer: SeekPointer;
  x0: number;
  y0: number;
  t0: number;
  /** pending — ещё не ясно; drag — перетаскивание; void — не перемотка. */
  mode: "pending" | "drag" | "void";
  /** Доля полоски под указателем сейчас (0..1). */
  fraction: number;
}

export type SeekGestureEvent =
  | { type: "down"; pointerId: number; pointer: SeekPointer; isPrimary: boolean; x: number; y: number; t: number; fraction: number }
  | { type: "move"; pointerId: number; x: number; y: number; t: number; fraction: number }
  | { type: "up"; pointerId: number; x: number; y: number; t: number; fraction: number }
  | { type: "cancel"; pointerId: number };

export interface SeekGestureStep {
  state: SeekGestureState | null;
  /** Перейти в эту долю полоски сейчас. */
  commit: number | null;
  /** Где рисовать бегунок, пока палец на полоске (null — как играет). */
  preview: number | null;
}

/** Любой указатель, кроме мыши, — палец: так же ведёт себя стилус. */
export function seekPointerOf(pointerType: string): SeekPointer {
  return pointerType === "mouse" ? "mouse" : "touch";
}

export function seekGestureStep(state: SeekGestureState | null, event: SeekGestureEvent): SeekGestureStep {
  if (event.type === "down") {
    if (state) {
      // Второй указатель, пока первый на полоске, — ладонь с пальцем или
      // двумя пальцами масштаб: ни один не перематывает.
      return { state: { ...state, mode: "void" }, commit: null, preview: null };
    }
    if (!event.isPrimary) return { state: null, commit: null, preview: null };
    const next: SeekGestureState = {
      pointerId: event.pointerId,
      pointer: event.pointer,
      x0: event.x,
      y0: event.y,
      t0: event.t,
      mode: event.pointer === "mouse" ? "drag" : "pending",
      fraction: event.fraction,
    };
    if (event.pointer === "mouse") return { state: next, commit: event.fraction, preview: null };
    return { state: next, commit: null, preview: null };
  }

  if (!state || event.pointerId !== state.pointerId) return { state, commit: null, preview: null };

  if (event.type === "cancel") return { state: null, commit: null, preview: null };

  if (event.type === "move") {
    if (state.pointer === "mouse") {
      const next = { ...state, fraction: event.fraction };
      return { state: next, commit: event.fraction, preview: null };
    }
    if (state.mode === "void") return { state, commit: null, preview: null };
    if (state.mode === "drag") {
      return { state: { ...state, fraction: event.fraction }, commit: null, preview: event.fraction };
    }
    const dx = Math.abs(event.x - state.x0);
    const dy = Math.abs(event.y - state.y0);
    if (dy >= SEEK_SLOP_PX && dy >= dx) return { state: { ...state, mode: "void" }, commit: null, preview: null };
    if (dx >= SEEK_SLOP_PX && dx > dy) {
      return { state: { ...state, mode: "drag", fraction: event.fraction }, commit: null, preview: event.fraction };
    }
    return { state, commit: null, preview: null };
  }

  // up
  if (state.pointer === "mouse") return { state: null, commit: null, preview: null };
  if (state.mode === "drag") return { state: null, commit: event.fraction, preview: null };
  if (state.mode === "pending") {
    const dx = Math.abs(event.x - state.x0);
    const dy = Math.abs(event.y - state.y0);
    const short = event.t - state.t0 <= SEEK_TAP_MAX_MS;
    if (short && dx < SEEK_SLOP_PX && dy < SEEK_SLOP_PX) return { state: null, commit: event.fraction, preview: null };
  }
  return { state: null, commit: null, preview: null };
}

/**
 * Доля полоски → строка рассказа. У рассказа с одной дорожкой полоска
 * идёт по ВРЕМЕНИ (как шкала в шторке), и точке соответствует строка,
 * которая в это время звучит; без дорожки — по номеру строки, как у
 * прежнего ползунка.
 */
export function seekIndexAt(fraction: number, queueLength: number, timeline: { offsets: number[]; duration: number } | null): number {
  const f = Math.min(1, Math.max(0, fraction));
  if (queueLength <= 0) return 0;
  if (timeline && timeline.duration > 0 && timeline.offsets.length === queueLength) {
    const time = f * timeline.duration;
    for (let i = timeline.offsets.length - 1; i >= 0; i--) {
      if (timeline.offsets[i] <= time) return i;
    }
    return 0;
  }
  return Math.round(f * (queueLength - 1));
}
