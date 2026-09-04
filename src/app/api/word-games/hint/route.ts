import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPuzzleById, crosswordLetterMap } from "@/lib/word-games/data";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { canAccessCurvedPuzzle, getEntitlementTier, isFreeWordGamePuzzle } from "@/lib/entitlement";

// Tighter than /check — a hint is meant to be an occasional "I'm stuck"
// action, not a way to solve the whole puzzle one request at a time
// (this cap is generous for a real stuck moment, tight enough that
// scripting through every cell isn't practical without hitting it).
const hintLimiter = getRateLimiter("word-games-hint", 60_000, 20);

export async function POST(request: NextRequest) {
  if (await hintLimiter.check(requestIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : null;
  const row = typeof body?.row === "number" ? body.row : null;
  const col = typeof body?.col === "number" ? body.col : null;
  if (!puzzleId || row === null || col === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle || puzzle.type !== "CROSSWORD") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Checked against the puzzle itself, not just a page-level gate — see
  // isFreeWordGamePuzzle's doc comment for why puzzleId alone isn't safe
  // to trust. Both clauses of the page's rule, same as /check: a hint hands
  // over a letter outright, so it must never answer for a puzzle the page
  // would have redirected this caller away from.
  const tier = await getEntitlementTier();
  if (tier === "free" && !isFreeWordGamePuzzle(puzzle)) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }
  if ((puzzle.curved || puzzle.premiumOnly) && !canAccessCurvedPuzzle(tier)) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

  const letter = crosswordLetterMap(puzzle).get(`${row},${col}`);
  if (!letter) {
    return NextResponse.json({ error: "not_a_cell" }, { status: 400 });
  }

  return NextResponse.json({ row, col, letter });
}
