import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isWordGameType } from "@/lib/word-games/types";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import { hasContentAccess } from "@/lib/entitlement";

// Word games now require an active subscription (or staff), matching
// /word-games's own gate in proxy.ts.
export async function GET(request: NextRequest) {
  if (!(await hasContentAccess())) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const level = searchParams.get("level") ?? "";
  const sequence = Number(searchParams.get("sequence") ?? "");

  if (!isWordGameType(type) || !isFlashcardLevel(level) || !Number.isInteger(sequence) || sequence < 1) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const puzzle = await getPuzzle(type, level, sequence);
  if (!puzzle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ puzzle: toPublicPuzzle(puzzle) });
}
