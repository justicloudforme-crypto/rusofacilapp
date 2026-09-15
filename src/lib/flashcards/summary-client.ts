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

const EMPTY_RESPONSE: CategorySummaryResponse = {
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
export async function fetchCategorySummary(level: FlashcardLevel | "all"): Promise<CategorySummaryResponse> {
  try {
    const res = await fetch("/api/flashcards/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: level === "all" ? undefined : level,
        entries: getProgressEntries(),
      }),
    });
    if (!res.ok) return EMPTY_RESPONSE;
    const body = (await res.json()) as Partial<CategorySummaryResponse>;
    return {
      // `body.level` приходит `null` для разреза «все уровни», и это
      // законное значение: `??` здесь съел бы его и превратил в «ответа
      // нет». Поэтому поле берётся ровно как приехало.
      level: "level" in body ? body.level : undefined,
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
    return EMPTY_RESPONSE;
  }
}
