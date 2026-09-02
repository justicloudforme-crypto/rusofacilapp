"use client";

import type { FlashcardCategory, FlashcardLevel } from "./types";
import { getProgressEntries } from "../flashcard-progress";

export interface CategorySummary {
  total: number;
  known: number;
}

export interface RecentCategory {
  category: FlashcardCategory;
  total: number;
  known: number;
  lastActivityAt: number;
}

export interface CategorySummaryResponse {
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
}

const EMPTY_RESPONSE: CategorySummaryResponse = {
  categories: {},
  recent: [],
  totalKnown: 0,
  availableWords: 0,
  premiumOnlyWords: 0,
  hasAnyProgress: false,
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
      categories: body.categories ?? {},
      recent: body.recent ?? [],
      totalKnown: body.totalKnown ?? 0,
      availableWords: body.availableWords ?? 0,
      premiumOnlyWords: body.premiumOnlyWords ?? 0,
      hasAnyProgress: body.hasAnyProgress ?? false,
    };
  } catch {
    return EMPTY_RESPONSE;
  }
}
