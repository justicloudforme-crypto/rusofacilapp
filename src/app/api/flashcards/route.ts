import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  FLASHCARD_LIST_CACHE_PREFIX,
  isFlashcardCategory,
  isFlashcardLevel,
  parseWordRelationsJson,
  type FlashcardRow,
} from "@/lib/flashcards";
import { cacheGet, cacheSet } from "@/lib/cache";

// Flashcard content changes rarely (admin edits, or a new seed batch) and is
// read on every /vocabulary category switch — same caching rationale as
// /api/glossary.
const FLASHCARD_CACHE_TTL_MS = 5 * 60_000;
// A full ?search= sweep needs to scan every card's russian/translationEs/
// transcription text, and SQLite's LIKE only case-folds ASCII — it would
// silently miss "Холодильник" for a query of "холодильник". Filtering in
// JS after one cached fetch of the whole bank gets correct Cyrillic
// case-insensitivity, and 5 minutes is an acceptable staleness window for
// a rarely-edited content table (same TTL as the per-category cache above).
const FLASHCARD_SEARCH_INDEX_CACHE_KEY = "flashcards:search-index";
const SEARCH_RESULT_LIMIT = 50;

async function attachAudio(cards: Awaited<ReturnType<typeof db.flashcardCard.findMany>>): Promise<FlashcardRow[]> {
  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) }, itemKey: "word" },
    select: { contentId: true, audioUrl: true },
  });
  const audioByCardId = new Map(audioRows.map((row) => [row.contentId, row.audioUrl]));

  return cards.map((card) => ({
    ...card,
    category: card.category as FlashcardRow["category"],
    level: card.level as FlashcardRow["level"],
    synonyms: parseWordRelationsJson(card.synonyms),
    antonyms: parseWordRelationsJson(card.antonyms),
    audioUrl: audioByCardId.get(card.id) ?? null,
  }));
}

async function searchFlashcards(query: string, level: string): Promise<{ cards: FlashcardRow[] }> {
  let index = cacheGet<FlashcardRow[]>(FLASHCARD_SEARCH_INDEX_CACHE_KEY);
  if (!index) {
    const cards = await db.flashcardCard.findMany({ orderBy: { createdAt: "asc" } });
    index = await attachAudio(cards);
    cacheSet(FLASHCARD_SEARCH_INDEX_CACHE_KEY, index, FLASHCARD_CACHE_TTL_MS);
  }

  const needle = query.toLowerCase();
  const levelFilter = level && isFlashcardLevel(level) ? level : null;

  const matches = index.filter((card) => {
    if (levelFilter && card.level !== levelFilter) return false;
    return (
      card.russian.toLowerCase().includes(needle) ||
      card.translationEs.toLowerCase().includes(needle) ||
      card.transcription.toLowerCase().includes(needle)
    );
  });

  return { cards: matches.slice(0, SEARCH_RESULT_LIMIT) };
}

// Public and unauthenticated: flashcards are reference content, not user
// data (per-card "known" state lives separately in FlashcardProgress).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  if (search) {
    return NextResponse.json(await searchFlashcards(search, level));
  }

  const where: { category?: string; level?: string } = {};
  if (category && isFlashcardCategory(category)) {
    where.category = category;
  }
  if (level && isFlashcardLevel(level)) {
    where.level = level;
  }

  const cacheKey = FLASHCARD_LIST_CACHE_PREFIX + searchParams.toString();
  const cached = cacheGet<{ cards: FlashcardRow[] }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const cards = await db.flashcardCard.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const body = { cards: await attachAudio(cards) };
  cacheSet(cacheKey, body, FLASHCARD_CACHE_TTL_MS);
  return NextResponse.json(body);
}
