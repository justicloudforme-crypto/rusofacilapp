/**
 * ОКНО ОЦЕНКИ GOOGLE PLAY (In-App Review) — заход 7.266.
 *
 * Только официальный API через плагин оболочки `RfReview` (с 1.0.15,
 * versionCode 16). Показывать ли окно, решает Google (у него своя квота);
 * мы только просим — и не чаще, чем здесь написано.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И БЫТЬ НЕ ДОЛЖНО (правила Google Play):
 *   * своего вопроса перед окном («¿Te gusta la app?») и пропуска к оценке
 *     только довольных — review gating запрещён;
 *   * просьбы о «5 звёздах» или хорошем отзыве, награды за отзыв;
 *   * кнопки «Оценить» — окно может не показаться, и кнопка была бы мёртвой.
 * Своего текста перед окном нет вовсе.
 *
 * КОГДА. Только после явного успеха — урок сдан впервые или рассказ
 * дочитан — и только в спокойный момент (закрыто поздравление, кончился
 * звук рассказа). Пороги:
 *   * успехов на этом устройстве ≥ 3 (`MIN_SUCCESSES`);
 *   * первый успех — не раньше чем за 24 ч (`MIN_AGE_MS`): не в первую сессию;
 *   * прошлая просьба — не ближе 30 дней (`MIN_INTERVAL_MS`);
 *   * покупки (доступ открыт) — не ближе 24 ч (`AFTER_PURCHASE_MS`);
 *   * без сети не просим.
 * После ошибки не просим по построению: зовут только ветки успеха.
 * Состояние — только на устройстве (`safe-storage`), на сервер не уходит.
 * В браузере не делает ничего.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { readLocal, writeLocal } from "@/lib/safe-storage";

export const REVIEW_STATE_KEY = "rf-app-review-v1";
export const PURCHASE_STAMP_KEY = "rf-last-purchase-at";

export const MIN_SUCCESSES = 3;
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const MIN_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
export const AFTER_PURCHASE_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  firstSuccessAt: number | null;
  successes: number;
  lastAskedAt: number | null;
}

interface RfReviewPlugin {
  request(): Promise<{ launched: boolean; reason?: string }>;
}

const RfReview = registerPlugin<RfReviewPlugin>("RfReview");

export function readReviewState(): ReviewState {
  const empty: ReviewState = { firstSuccessAt: null, successes: 0, lastAskedAt: null };
  const raw = readLocal(REVIEW_STATE_KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<ReviewState>;
    return {
      firstSuccessAt: typeof parsed.firstSuccessAt === "number" ? parsed.firstSuccessAt : null,
      successes: typeof parsed.successes === "number" ? parsed.successes : 0,
      lastAskedAt: typeof parsed.lastAskedAt === "number" ? parsed.lastAskedAt : null,
    };
  } catch {
    return empty;
  }
}

function writeReviewState(state: ReviewState): void {
  writeLocal(REVIEW_STATE_KEY, JSON.stringify(state));
}

/** Чистое правило «пора ли попросить». Его гоняет юнит и сторож. */
export function shouldAskForReview(input: {
  state: ReviewState;
  now: number;
  lastPurchaseAt: number | null;
  online: boolean;
}): boolean {
  const { state, now, lastPurchaseAt, online } = input;
  if (!online) return false;
  if (state.successes < MIN_SUCCESSES) return false;
  if (state.firstSuccessAt == null || now - state.firstSuccessAt < MIN_AGE_MS) return false;
  if (state.lastAskedAt != null && now - state.lastAskedAt < MIN_INTERVAL_MS) return false;
  if (lastPurchaseAt != null && now - lastPurchaseAt < AFTER_PURCHASE_MS) return false;
  return true;
}

function reviewPluginAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RfReview");
  } catch {
    return false;
  }
}

/** Успех: урок сдан впервые или рассказ дочитан. Считается только в приложении. */
export function recordAppSuccess(now: number = Date.now()): void {
  if (!reviewPluginAvailable()) return;
  const state = readReviewState();
  writeReviewState({
    ...state,
    successes: state.successes + 1,
    firstSuccessAt: state.firstSuccessAt ?? now,
  });
}

/** Покупка открыла доступ — 24 ч окно оценки не просим. */
export function stampPurchase(now: number = Date.now()): void {
  writeLocal(PURCHASE_STAMP_KEY, String(now));
}

/** Спокойный момент после успеха: если пора — попросить Google показать окно. */
export async function maybeAskForReview(now: number = Date.now()): Promise<boolean> {
  if (!reviewPluginAvailable()) return false;
  const state = readReviewState();
  const stamp = Number(readLocal(PURCHASE_STAMP_KEY));
  const lastPurchaseAt = Number.isFinite(stamp) && stamp > 0 ? stamp : null;
  const online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  if (!shouldAskForReview({ state, now, lastPurchaseAt, online })) return false;
  // Отметка ДО вызова: даже если Google окно не покажет (квота), мы своё
  // «не чаще раза в 30 дней» соблюдаем.
  writeReviewState({ ...state, lastAskedAt: now });
  try {
    const result = await RfReview.request();
    return result.launched;
  } catch {
    return false;
  }
}
