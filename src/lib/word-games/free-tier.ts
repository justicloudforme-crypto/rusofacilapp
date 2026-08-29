/**
 * Which word-game puzzles are free, as a plain rule with no dependencies.
 *
 * Extracted from src/lib/entitlement.ts on 02.09.2026 for the same reason
 * isExamSlugFormat was extracted from the server-only exams/content.ts:
 * the rule is needed where that module cannot be imported. Three callers
 * now share it — the runtime entitlement checks (which re-export it, so
 * every existing import keeps working), src/app/robots.ts, and
 * prisma/generate-word-games.ts, an offline Node script that crashes on
 * `import "server-only"`.
 *
 * Keeping one definition matters more than the import convenience: the
 * generator's --only=free scope, the robots.txt Allow lines, and the
 * paywall redirect all have to mean the same 80 URLs. A second copy of
 * "sequence <= 10, not C1" would drift and open or hide puzzles silently.
 */
export const WORD_GAME_FREE_RUNGS_PER_LEVEL = 10;

/**
 * Free-trial word games: the first N rungs of every (type, level) ladder
 * except C1 — 80 puzzles, 2 types x 4 levels x N.
 *
 * Checked against the puzzle itself rather than a page-level gate in every
 * route that serves puzzle data or grades an answer: a puzzleId is a plain
 * string a client could otherwise pass straight to
 * /api/word-games/check|hint|complete to solve a locked puzzle without
 * ever fetching it through the gated GET route.
 */
export function isFreeWordGamePuzzle(puzzle: { type: string; level: string; sequence: number }): boolean {
  return (
    (puzzle.type === "WORD_SEARCH" || puzzle.type === "CROSSWORD") &&
    puzzle.level !== "C1" &&
    puzzle.sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL
  );
}
