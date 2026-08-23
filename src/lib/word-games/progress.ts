import "server-only";
import { db } from "@/lib/db";

/** Which sequences this user has completed, across every (type, level)
 * pair at once, keyed by `${type}:${level}` — powers the checkmark badge
 * on /word-games' sequence picker. Deliberately not a lock: this app's
 * established pattern (see src/lib/flashcards/level-progress.ts) is
 * self-paced, every rung stays playable regardless of status. Batched
 * into one query instead of one per (type, level) pair for the same
 * reason as data.ts's countAllSequences/getAllCurvedSequences — the
 * picker page needs this for 10 pairs at once, and each round trip to
 * Turso costs real cross-region latency. */
export async function getAllCompletedSequences(userId: string): Promise<Map<string, Set<number>>> {
  const rows = await db.wordGameProgress.findMany({
    where: { userId },
    select: { puzzle: { select: { type: true, level: true, sequence: true } } },
  });
  const byPair = new Map<string, Set<number>>();
  for (const row of rows) {
    const key = `${row.puzzle.type}:${row.puzzle.level}`;
    const existing = byPair.get(key);
    if (existing) existing.add(row.puzzle.sequence);
    else byPair.set(key, new Set([row.puzzle.sequence]));
  }
  return byPair;
}
