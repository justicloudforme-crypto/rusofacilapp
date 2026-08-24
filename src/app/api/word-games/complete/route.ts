import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { userHasActiveSubscription } from "@/lib/subscription";
import { getPuzzleById } from "@/lib/word-games/data";
import { isFreeWordGamePuzzle } from "@/lib/entitlement";
import { db } from "@/lib/db";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";

const completeLimiter = getRateLimiter("word-games-complete", 60_000, 30);

// Records that the current user finished a puzzle. Trusted client report
// for WORD_SEARCH (its whole grid/word list is already visible to the
// client, so there's no secret left to fabricate completion around — same
// trust level as LessonProgress.mistakes elsewhere in this app). For
// CROSSWORD, callers are expected to only reach this after POST /check
// returned solved:true, but this route itself doesn't re-verify that (no
// guesses are sent here) — a determined client could call it early, same
// as it could always have just skipped a lesson's exercises. Not a
// security boundary, just progress bookkeeping.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  // Progress is always per-user, so a logged-out free-trial visitor has
  // nothing to record here regardless of which puzzle they solved.
  if (!user) {
    return NextResponse.json({ recorded: false });
  }

  if (await completeLimiter.check(requestIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const puzzleId = typeof body?.puzzleId === "string" ? body.puzzleId : null;
  const timeSeconds = typeof body?.timeSeconds === "number" ? Math.max(0, Math.round(body.timeSeconds)) : null;
  const usedHint = body?.usedHint === true;
  if (!puzzleId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // A logged-in, not-yet-subscribed user can still get credit for a
  // free-trial puzzle (see isFreeWordGamePuzzle) — anything beyond that
  // needs staff or an active subscription, same as the rest of this route
  // family.
  if (!isFreeWordGamePuzzle(puzzle) && !isStaff(user.role) && !(await userHasActiveSubscription(user.id))) {
    return NextResponse.json({ recorded: false });
  }

  await db.wordGameProgress.upsert({
    where: { userId_puzzleId: { userId: user.id, puzzleId } },
    create: { userId: user.id, puzzleId, timeSeconds, usedHint },
    // A replay shouldn't downgrade an earlier hint-free solve to
    // hint-used, or lose a previously recorded time in favor of null.
    update: {
      timeSeconds: timeSeconds ?? undefined,
      usedHint: usedHint ? true : undefined,
    },
  });

  return NextResponse.json({ recorded: true });
}
