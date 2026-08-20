import "server-only";
import { db } from "@/lib/db";
import type { WordGameType } from "./types";

/** Which sequences of a (type, level) ladder this user has completed —
 * powers the checkmark badge on /word-games' sequence picker. Deliberately
 * not a lock: this app's established pattern (see
 * src/lib/flashcards/level-progress.ts) is self-paced, every rung stays
 * playable regardless of status. */
export async function getCompletedSequences(
  userId: string,
  type: WordGameType,
  level: string,
): Promise<Set<number>> {
  const rows = await db.wordGameProgress.findMany({
    where: { userId, puzzle: { type, level } },
    select: { puzzle: { select: { sequence: true } } },
  });
  return new Set(rows.map((r) => r.puzzle.sequence));
}
