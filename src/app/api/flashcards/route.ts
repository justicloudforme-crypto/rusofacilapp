import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFlashcardCategory, isFlashcardLevel, type FlashcardRow } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { hasContentAccess } from "@/lib/entitlement";

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

// Vocabulary now requires an active subscription (or staff), matching the
// /vocabulary page's own gate in proxy.ts — this route used to be public
// on the theory that flashcards are reference content, not user data
// (per-card "known" state lives separately in FlashcardProgress), but the
// page-level gate alone doesn't stop a direct request here.
export async function GET(request: NextRequest) {
  if (!(await hasContentAccess())) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  const index = await getFlashcardIndex();
  const levelFilter = level && isFlashcardLevel(level) ? level : null;

  if (search) {
    return NextResponse.json({ cards: searchIndex(index, search, levelFilter) });
  }

  const categoryFilter = category && isFlashcardCategory(category) ? category : null;
  const cards = index.filter(
    (card) => (!categoryFilter || card.category === categoryFilter) && (!levelFilter || card.level === levelFilter)
  );

  return NextResponse.json({ cards });
}
