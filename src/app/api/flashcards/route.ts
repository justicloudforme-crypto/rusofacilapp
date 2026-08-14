import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { FLASHCARD_LIST_CACHE_PREFIX, isFlashcardCategory, isFlashcardLevel, parseWordRelationsJson } from "@/lib/flashcards";
import { cacheGet, cacheSet } from "@/lib/cache";

// Flashcard content changes rarely (admin edits, or a new seed batch) and is
// read on every /vocabulary category switch — same caching rationale as
// /api/glossary.
const FLASHCARD_CACHE_TTL_MS = 5 * 60_000;

// Public and unauthenticated: flashcards are reference content, not user
// data (per-card "known" state lives separately in FlashcardProgress).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";

  const where: { category?: string; level?: string } = {};
  if (category && isFlashcardCategory(category)) {
    where.category = category;
  }
  if (level && isFlashcardLevel(level)) {
    where.level = level;
  }

  const cacheKey = FLASHCARD_LIST_CACHE_PREFIX + searchParams.toString();
  const cached = cacheGet<{ cards: unknown[] }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const cards = await db.flashcardCard.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const body = {
    cards: cards.map((card) => ({
      ...card,
      synonyms: parseWordRelationsJson(card.synonyms),
      antonyms: parseWordRelationsJson(card.antonyms),
    })),
  };
  cacheSet(cacheKey, body, FLASHCARD_CACHE_TTL_MS);
  return NextResponse.json(body);
}
