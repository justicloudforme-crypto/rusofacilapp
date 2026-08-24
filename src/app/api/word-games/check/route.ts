import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPuzzleById, crosswordLetterMap } from "@/lib/word-games/data";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { hasContentAccess } from "@/lib/entitlement";

interface GuessCell {
  row: number;
  col: number;
  letter: string;
}

function isGuessCell(value: unknown): value is GuessCell {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.row === "number" && typeof v.col === "number" && typeof v.letter === "string";
}

// Generous: a player actively solving can easily re-check after every
// keystroke — this only stops a runaway client, not normal play.
const checkLimiter = getRateLimiter("word-games-check", 60_000, 120);

// Same active-subscription gate as GET /api/word-games: this endpoint
// only ever confirms/denies letters the caller already sent, but repeated
// calls (one letter at a time, one cell at a time) turn it into an oracle
// that reconstructs the whole solution — a real leak vector even without
// returning puzzle content directly.
export async function POST(request: NextRequest) {
  if (!(await hasContentAccess())) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }
  if (await checkLimiter.check(requestIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : null;
  const rawGuesses: unknown[] = Array.isArray(body?.guesses) ? body.guesses : [];
  const guesses: GuessCell[] = rawGuesses.filter(isGuessCell);
  if (!puzzleId || guesses.length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle || puzzle.type !== "CROSSWORD") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const answers = crosswordLetterMap(puzzle);
  const results = guesses.map((g) => ({
    row: g.row,
    col: g.col,
    correct: answers.get(`${g.row},${g.col}`) === g.letter.toLowerCase(),
  }));

  // Solved only once every answer cell in the puzzle (not just the ones
  // the client happened to send) has a matching, correct guess — a
  // partial submission can never report solved:true.
  const guessedByKey = new Map(guesses.map((g) => [`${g.row},${g.col}`, g.letter.toLowerCase()]));
  const solved = Array.from(answers.entries()).every(([key, letter]) => guessedByKey.get(key) === letter);

  return NextResponse.json({ results, solved });
}
