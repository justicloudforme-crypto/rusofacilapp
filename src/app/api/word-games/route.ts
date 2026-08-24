import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isWordGameType } from "@/lib/word-games/types";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import { canAccessCurvedPuzzle, getEntitlementTier, isFreeWordGamePuzzle } from "@/lib/entitlement";

// A non-entitled visitor can only load one of the fixed free-trial puzzles
// (see isFreeWordGamePuzzle) — everything else 403s, same as before, just
// no longer an unconditional block for every puzzle.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const level = searchParams.get("level") ?? "";
  const sequence = Number(searchParams.get("sequence") ?? "");

  if (!isWordGameType(type) || !isFlashcardLevel(level) || !Number.isInteger(sequence) || sequence < 1) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const tier = await getEntitlementTier();
  const entitled = tier !== "free";
  if (!entitled && !isFreeWordGamePuzzle({ type, level, sequence })) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const puzzle = await getPuzzle(type, level, sequence);
  if (!puzzle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // ★ (curved) puzzles are Premium-exclusive regardless of whether the
  // caller is otherwise entitled — a standard subscriber gets the same
  // subscription_required response a free visitor would.
  if (puzzle.curved && !canAccessCurvedPuzzle(tier)) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  return NextResponse.json({ puzzle: toPublicPuzzle(puzzle), limited: !entitled });
}
