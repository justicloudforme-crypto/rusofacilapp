import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { WordGameGrid } from "@/lib/word-games/types";

/**
 * Test-only: which WORD_SEARCH board is the WIDEST in the database this
 * server is actually serving.
 *
 * Why this exists. `e2e/word-games.spec.ts` measures the rule "every
 * column of the widest board is on screen at a phone width". Until
 * 08.09.2026 it did that by opening a hard-coded rung (`C1/91`) and
 * asserting `cols >= 18` — two literals copied out of one snapshot of one
 * database. Both went stale the moment the density corridor re-laid the
 * bank: on production `C1/91` became 16 columns on 04.09.2026 at 19:44
 * (its 18-column half moved to the freshly created `C1/287`), while
 * `C1/5` went the other way, 16 -> 18, at 18:36 the same evening. The
 * test then failed on a prod-shaped database and passed in CI — green on
 * a board production does not serve. See PROGRESS.md 7.141.
 *
 * The rule under test does not mention a number, so neither should the
 * test: it asks here which board is widest and measures THAT one. The
 * fixture keeps defining the SHAPE (its ladder still carries an 18-column
 * board so CI measures a wide one), and no number from production is
 * written down anywhere in `e2e/`.
 *
 * `curved` and `premiumOnly` rows are excluded for the same reason
 * `isPubliclyOpenableWordGamePuzzle` exists: those need the Premium tier,
 * and the spec's account is a standard subscriber, so pointing it at one
 * would measure a redirect to /pricing instead of a board.
 *
 * 404s unless E2E_TEST_SEED is set — true only for the server
 * playwright.config.ts spawns, never on a real deployment (a NODE_ENV
 * check cannot do this job: `next start` always forces production). Same
 * guard, same reasoning as /api/test/grant-subscription.
 */
export async function GET() {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rows = await db.wordGamePuzzle.findMany({
    where: { type: "WORD_SEARCH", curved: false, premiumOnly: false },
    select: { level: true, sequence: true, gridData: true },
  });

  let widest: { level: string; sequence: number; cols: number } | null = null;
  let considered = 0;
  for (const row of rows) {
    let grid: WordGameGrid;
    try {
      grid = JSON.parse(row.gridData) as WordGameGrid;
    } catch {
      continue;
    }
    const cols = grid.grid?.[0]?.length ?? 0;
    if (cols <= 0) continue;
    considered += 1;
    // Ties broken by (level, sequence) so two runs against the same data
    // name the same board — a flapping target would make a failure here
    // unreproducible.
    if (
      !widest ||
      cols > widest.cols ||
      (cols === widest.cols &&
        (row.level < widest.level || (row.level === widest.level && row.sequence < widest.sequence)))
    ) {
      widest = { level: row.level, sequence: row.sequence, cols };
    }
  }

  // `considered` is the honest denominator: a caller that gets `null` has
  // to be able to tell "no WORD_SEARCH rows at all" from "rows exist and
  // none of them parsed".
  return NextResponse.json({ widest, considered });
}
