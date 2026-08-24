import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPuzzleById, crosswordLetterMap } from "@/lib/word-games/data";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { hasContentAccess } from "@/lib/entitlement";

// Tighter than /check — a hint is meant to be an occasional "I'm stuck"
// action, not a way to solve the whole puzzle one request at a time
// (this cap is generous for a real stuck moment, tight enough that
// scripting through every cell isn't practical without hitting it).
const hintLimiter = getRateLimiter("word-games-hint", 60_000, 20);

export async function POST(request: NextRequest) {
  if (!(await hasContentAccess())) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }
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

  const letter = crosswordLetterMap(puzzle).get(`${row},${col}`);
  if (!letter) {
    return NextResponse.json({ error: "not_a_cell" }, { status: 400 });
  }

  return NextResponse.json({ row, col, letter });
}
