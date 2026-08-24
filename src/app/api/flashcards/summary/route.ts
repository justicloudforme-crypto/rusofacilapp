import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { userHasActiveSubscription } from "@/lib/subscription";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";

// Powers the category grid on /vocabulary: total card count per category
// (public) plus, for a logged-in user, how many of those cards they already
// know, so each tile can show its own progress bar without the client
// fetching every category's full card list up front. Accepts an optional
// ?level= so the tile counts track the same A1/A2/B1/all filter the
// flip-card and recall trainer views use — omitting it here was the bug
// where every tile kept showing the all-levels total no matter which level
// filter was selected.
//
// Totals are derived from the same shared, Redis-backed flashcard index
// GET /api/flashcards itself reads (see src/lib/flashcards/cache.ts) rather
// than a separate DB query + separate cache entry — one invalidation point
// for the whole FlashcardCard table instead of two that could drift apart.

interface CategoryStat {
  total: number;
  known: number;
}

export async function GET(request: NextRequest) {
  // Vocabulary now requires an active subscription (or staff) — same gate
  // as GET /api/flashcards, checked with the user fetched below rather
  // than duplicating the lookup via the shared hasContentAccess() helper.
  const user = await getCurrentUser();
  if (!user || !(isStaff(user.role) || (await userHasActiveSubscription(user.id)))) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const levelParam = new URL(request.url).searchParams.get("level") ?? "";
  const level = levelParam && isFlashcardLevel(levelParam) ? levelParam : null;

  const index = await getFlashcardIndex();
  const categories: Record<string, CategoryStat> = {};
  for (const card of index) {
    if (level && card.level !== level) continue;
    const stat = (categories[card.category] ??= { total: 0, known: 0 });
    stat.total += 1;
  }

  if (user) {
    const knownProgress = await db.flashcardProgress.findMany({
      where: { userId: user.id, known: true },
      select: { cardId: true },
    });
    if (knownProgress.length > 0) {
      const knownIds = new Set(knownProgress.map((p) => p.cardId));
      for (const card of index) {
        if (level && card.level !== level) continue;
        if (knownIds.has(card.id) && categories[card.category]) {
          categories[card.category].known += 1;
        }
      }
    }
  }

  return NextResponse.json({ categories });
}
