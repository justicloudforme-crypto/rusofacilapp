"use client";

import type { FlashcardCategory, FlashcardLevel } from "./types";
import { getProgressEntries } from "../flashcard-progress";
import type { ViewerTier } from "../access-marks";

export interface CategorySummary {
  total: number;
  known: number;
}

export interface RecentCategory {
  category: FlashcardCategory;
  total: number;
  known: number;
  lastActivityAt: number;
  /** Карточка, на которой человек остановился в этой теме, — строка с
   * наибольшим `updatedAt`. `null`, если под текущим фильтром уровня её
   * нет; тогда «Продолжить» открывает тему с начала. */
  lastCardId: string | null;
  /** Русское слово этой карточки, чтобы блок мог его назвать. */
  lastCardWord: string | null;
  /**
   * Сколько строк ЕСТЬ в этой теме под текущим разрезом уровня —
   * 7.196, часть 2б. `total` выше считает ДОСТУПНОЕ, и на уровне C1 у
   * неоплатившего это ноль: строка «Продолжить» печатала «0/0 · 0 %» при
   * непустом банке. Читает это число только оболочка.
   */
  bankTotal: number;
}

export interface CategorySummaryResponse {
  /**
   * РАЗРЕЗ ЭТОГО ОТВЕТА — 7.196, часть 2а. `null` — все уровни,
   * `undefined` — ответа ещё нет вовсе (или он не пришёл).
   *
   * Без этого поля сетка тем не могла отличить свои числа от чужих и всё
   * время ожидания печатала числа ПРЕДЫДУЩЕГО уровня: замер с задержкой
   * 3000 мс показал «266 слов» и отсутствие знака на уровне C1, где в
   * банке 8 строк и они все премиальные.
   */
  level?: string | null;
  /** Тариф спрашивающего — нужен общему правилу знака (`accessSignFor`). */
  tier: ViewerTier;
  categories: Record<string, CategorySummary>;
  recent: RecentCategory[];
  totalKnown: number;
  /** Cards this visitor can open at their current tier — the denominator
   * the result panel prints. NOT the whole bank: 896 C1 cards are behind
   * the Premium plan, and counting them here is what made "6 of 5683"
   * dishonest for everyone who is not Premium. See PROGRESS.md 7.76. */
  availableWords: number;
  /** Cards that exist but need Premium. 0 for a Premium/staff visitor,
   * which is how the UI knows to print the short sentence. */
  premiumOnlyWords: number;
  hasAnyProgress: boolean;
  /**
   * Перепись БАНКА по темам под текущим фильтром уровня — 7.195, часть 3.
   *
   * `categories` выше считает доступное, и на уровне C1 у неоплатившего
   * это ноль по каждой теме. Здесь — сколько строк там ЕСТЬ и сколько из
   * них закрыто; читает только сетка внутри оболочки.
   */
  bankCategories: Record<string, { bank: number; open: number; locked: number }>;
  /** Сколько закрыто на каждом уровне по ВСЕМУ банку (без фильтра темы). */
  lockedByLevel: Record<string, number>;
  /** Сколько закрыто во всём банке. */
  lockedTotal: number;
}

export const EMPTY_SUMMARY: CategorySummaryResponse = {
  // undefined, а НЕ null: null означал бы «ответ про все уровни»,
  // то есть сетка приняла бы пустоту за готовые числа.
  level: undefined,
  tier: "free",
  categories: {},
  recent: [],
  totalKnown: 0,
  availableWords: 0,
  premiumOnlyWords: 0,
  hasAnyProgress: false,
  bankCategories: {},
  lockedByLevel: {},
  lockedTotal: 0,
};

/** Shared by every vocabulary study mode's category grid (flip cards,
 * recall, fill-blank, match) — sends this device's local progress map
 * (see flashcard-progress.ts's getProgressEntries) so the server can fold
 * a guest's (or not-yet-synced) local "known" state into the per-category
 * counts and the "Continue" strip, which it otherwise has no way to see.
 * POST /api/flashcards/summary treats this as untrusted input and never
 * lets it override a logged-in user's real server-side progress — see
 * that route's own comment for the full trust rule. */
/** Разрез, к которому ответ обязан относиться. `null` — «все уровни»:
 *  именно так этот разрез называет и сервер, и поле `level` ответа. */
export function requestedCut(level: FlashcardLevel | "all"): string | null {
  return level === "all" ? null : level;
}

/**
 * ОТВЕТ ВСЕГДА ПОДПИСАН ЗАПРОШЕННЫМ РАЗРЕЗОМ — 7.199, часть 1.
 *
 * До 15.09.2026 поле `level` бралось ровно как приехало, а неудачный
 * запрос возвращал пустой ответ с `level: undefined`. Оба случая
 * оставляли на экране заглушку, снять которую было уже нечем: сетка тем и
 * строка «Продолжить» печатают числа только тогда, когда разрез ответа
 * совпадает с выбранным уровнем, а «ответа нет» от «ответ про чужой
 * разрез» они не отличают.
 *
 * Теперь подпись ставится ЗДЕСЬ и по запросу, а не по ответу:
 *
 *   — ответ приехал и его разрез совпал с запрошенным → числа те самые;
 *   — ответ приехал про ЧУЖОЙ разрез (ошибка сервера) → числа не берутся
 *     вовсе, но подпись стоит: заглушка снимается, врать ей нечем;
 *   — запрос не доехал → то же самое, пустые числа под своей подписью.
 *
 * Цена названа честно: при неудачном запросе внутри оболочки плитка
 * напечатает «0 слов» вместо вечной серой полосы. Это состояние «сеть
 * молчит», и в приложении поверх него стоит собственный экран ошибки
 * оболочки; вечная заглушка на этот счёт не говорила ничего.
 */
export async function fetchCategorySummary(level: FlashcardLevel | "all"): Promise<CategorySummaryResponse> {
  const cut = requestedCut(level);
  try {
    const res = await fetch("/api/flashcards/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: level === "all" ? undefined : level,
        entries: getProgressEntries(),
      }),
    });
    if (!res.ok) return { ...EMPTY_SUMMARY, level: cut };
    const body = (await res.json()) as Partial<CategorySummaryResponse>;
    // `body.level` приходит `null` для разреза «все уровни», и это
    // законное значение. Сверяется оно с ЗАПРОШЕННЫМ разрезом: ответ про
    // чужой уровень — это чужие числа, и печатать их нельзя ни секунды.
    const answered = "level" in body ? (body.level ?? null) : undefined;
    if (answered !== cut) return { ...EMPTY_SUMMARY, level: cut };
    return {
      level: cut,
      tier: body.tier ?? "free",
      categories: body.categories ?? {},
      recent: body.recent ?? [],
      totalKnown: body.totalKnown ?? 0,
      availableWords: body.availableWords ?? 0,
      premiumOnlyWords: body.premiumOnlyWords ?? 0,
      hasAnyProgress: body.hasAnyProgress ?? false,
      bankCategories: body.bankCategories ?? {},
      lockedByLevel: body.lockedByLevel ?? {},
      lockedTotal: body.lockedTotal ?? 0,
    };
  } catch {
    return { ...EMPTY_SUMMARY, level: cut };
  }
}
