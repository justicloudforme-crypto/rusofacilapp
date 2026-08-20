import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isWordGameType } from "@/lib/word-games/types";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";

// Public and unauthenticated, same reasoning as GET /api/flashcards —
// puzzle shapes/clues are reference content, not user data (per-user
// completion lives separately in WordGameProgress).
export async function GET(request: NextRequest) {
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
