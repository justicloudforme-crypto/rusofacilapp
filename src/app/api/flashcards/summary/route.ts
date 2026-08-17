import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isFlashcardCategory, isFlashcardLevel } from "@/lib/flashcards";
import { cacheGet, cacheSet } from "@/lib/cache";

// Powers the category grid on /vocabulary: total card count per category
// (public, cached — same rationale as GET /api/flashcards) plus, for a
// logged-in user, how many of those cards they already know, so each tile
// can show its own progress bar without the client fetching every category's
// full card list up front. Accepts an optional ?level= so the tile counts
// track the same A1/A2/B1/all filter the flip-card and recall trainer views
// use — omitting it here was the bug where every tile kept showing the
// all-levels total no matter which level filter was selected.
const TOTALS_CACHE_KEY_PREFIX = "flashcards:category-totals:";
const TOTALS_CACHE_TTL_MS = 5 * 60_000;

interface CategoryStat {
  total: number;
  known: number;
}

export async function GET(request: NextRequest) {
  const levelParam = new URL(request.url).searchParams.get("level") ?? "";
  const level = levelParam && isFlashcardLevel(levelParam) ? levelParam : null;

  const cacheKey = TOTALS_CACHE_KEY_PREFIX + (level ?? "all");
  let totals = cacheGet<Record<string, number>>(cacheKey);
  if (!totals) {
    const grouped = await db.flashcardCard.groupBy({
      by: ["category"],
      where: level ? { level } : undefined,
      _count: { _all: true },
    });
    totals = {};
    for (const row of grouped) {
      if (isFlashcardCategory(row.category)) totals[row.category] = row._count._all;
    }
    cacheSet(cacheKey, totals, TOTALS_CACHE_TTL_MS);
  }

  const categories: Record<string, CategoryStat> = {};
  for (const [category, total] of Object.entries(totals)) {
    categories[category] = { total, known: 0 };
  }

  const user = await getCurrentUser();
  if (user) {
    const knownProgress = await db.flashcardProgress.findMany({
      where: { userId: user.id, known: true },
      select: { cardId: true },
    });
    if (knownProgress.length > 0) {
      const knownCards = await db.flashcardCard.findMany({
        where: { id: { in: knownProgress.map((p) => p.cardId) }, ...(level ? { level } : {}) },
        select: { category: true },
      });
      for (const card of knownCards) {
        if (categories[card.category]) categories[card.category].known += 1;
      }
    }
  }

  return NextResponse.json({ categories });
}
