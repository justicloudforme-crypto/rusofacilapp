import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFlashcardCategory, isFlashcardLevel, type FlashcardRow } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { isEntitled, FREE_TRIAL_LIMITS } from "@/lib/entitlement";

const SEARCH_RESULT_LIMIT = 50;

// NFC-normalize before comparing so accented Spanish text matches regardless
// of whether the DB or the user's keyboard produced a precomposed ("ó") or
// decomposed ("o" + combining acute) codepoint sequence — both look
// identical on screen but fail a naive .includes() against each other.
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFC");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Plain substring .includes() ranks a match buried mid-word (e.g. "mil"
// inside "familia") exactly the same as a real match — this scores matches
// into tiers so an exact/prefix/whole-word hit always outranks a substring
// found by accident inside an unrelated word. 0 means no match.
function fieldScore(haystack: string, needle: string): number {
  const h = normalize(haystack);
  if (!h.includes(needle)) return 0;
  if (h === needle) return 4;
  if (h.startsWith(needle)) return 3;
  if (new RegExp(`\\b${escapeRegExp(needle)}`, "u").test(h)) return 2;
  return 1;
}

function cardScore(card: FlashcardRow, needle: string): number {
  return Math.max(
    fieldScore(card.russian, needle),
    fieldScore(card.translationEs, needle),
    fieldScore(card.transcription, needle)
  );
}

function searchIndex(index: FlashcardRow[], query: string, level: string | null): FlashcardRow[] {
  const needle = normalize(query);
  const scored = index
    .filter((card) => !level || card.level === level)
    .map((card) => ({ card, score: cardScore(card, needle) }))
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.card);
}

// A non-entitled visitor (logged out, or logged in without an active
// subscription) gets a free sample instead of a hard 403 — capped to
// FREE_TRIAL_LIMITS.flashcards cards, but the cap is applied AFTER
// category/level/search filtering, not before.
//
// This used to cap the raw, unfiltered index first and filter afterwards —
// which broke the actual UX entirely: every flashcard mode here
// (FillBlankApp/RecallApp/MatchApp/FlashcardsApp) is category-first
// (CategoryGrid → pick a category → THEN fetch its cards), so a global
// "earliest 10 cards site-wide" sample almost always missed whichever
// category the visitor picked, producing a real "no words in this
// category" bug for any category other than the lucky few landing in that
// fixed slice. Capping per-filtered-request instead means every category
// a free-trial visitor opens shows up to 10 real words from THAT category.
export async function GET(request: NextRequest) {
  const entitled = await isEntitled();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  const index = await getFlashcardIndex();
  const levelFilter = level && isFlashcardLevel(level) ? level : null;

  if (search) {
    const results = searchIndex(index, search, levelFilter);
    return NextResponse.json({
      cards: entitled ? results : results.slice(0, FREE_TRIAL_LIMITS.flashcards),
      limited: !entitled,
    });
  }

  const categoryFilter = category && isFlashcardCategory(category) ? category : null;
  const filtered = index.filter(
    (card) => (!categoryFilter || card.category === categoryFilter) && (!levelFilter || card.level === levelFilter)
  );
  const cards = entitled ? filtered : filtered.slice(0, FREE_TRIAL_LIMITS.flashcards);

  return NextResponse.json({ cards, limited: !entitled });
}
