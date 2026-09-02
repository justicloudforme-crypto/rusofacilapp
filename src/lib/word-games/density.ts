// The health rule for a WORD_SEARCH grid, and the ranking that says which
// puzzle is worst. Pure and separate from the audit itself so the check
// script, the redistribution script and the tests all read ONE definition.
import type { PuzzleAudit } from "./word-search-audit";

/**
 * Working thresholds.
 *
 * The brief proposed: at most 2 words per cell, filler at least 25%,
 * occupancy at most 70%. Measured against all 1738 puzzles that rejects
 * 666 of them (38.3%), and the rejection is not evenly spread — it takes
 * 147 of C1's 240 (61%) and 170 of B2's 327 (52%). That is not a defect
 * rate, that is the difficulty ramp: WORD_SEARCH_RUNGS deliberately grows
 * word count from 16 to 28 on a fixed 16×16 grid, so mean occupancy climbs
 * A1 49.5% → A2 54.1% → B1 62.0% → B2 68.1% → C1 72.0%. A rule that calls
 * the top half of the intended ramp broken is measuring the ramp, not the
 * defect.
 *
 * Two further facts from the same sweep:
 *
 *  - "filler ≥ 25%" and "occupancy ≤ 70%" are the SAME rule with two
 *    different cutoffs — filler is 1 − occupancy exactly — so as stated
 *    the 70% clause makes the 25% clause dead. There are two axes here,
 *    not three.
 *  - A cell shared by 3 words is the ordinary crossing pattern of a dense
 *    grid: 211 puzzles have one. A cell shared by 4 is the outlier: 12
 *    puzzles, 0.7%. Cutting at "more than 2" flags 223; cutting at "more
 *    than 3" isolates the 12 that are actually strange.
 *
 * So: occupancy ≤ 80% (equivalently filler ≥ 20%) and at most 3 words per
 * cell. That flags 345 (19.9%), and the distribution backs the cut — the
 * band past 80% is where filler collapses below one cell in five (270
 * puzzles at 80–90%, 68 at 90%+).
 *
 * These are REPORTING thresholds, not a gate. The gate is the baseline
 * snapshot (docs/word-search-baseline-*.json): a puzzle may not get worse
 * than it already is. A hard threshold gate would fail on 345 puzzles
 * from the day it landed and teach everyone to ignore it.
 */
export const OCCUPANCY_LIMIT = 0.8;
export const MAX_WORDS_PER_CELL = 3;
/** Beyond this a puzzle is not merely dense, it is a letter soup that
 * happens to contain the word list. */
export const SEVERE_OCCUPANCY = 0.9;

export function exceedsThreshold(a: Pick<PuzzleAudit, "occupancy" | "maxOverlap">): boolean {
  return a.occupancy > OCCUPANCY_LIMIT || a.maxOverlap > MAX_WORDS_PER_CELL;
}

export function isSevere(a: Pick<PuzzleAudit, "occupancy" | "maxOverlap">): boolean {
  return a.occupancy > SEVERE_OCCUPANCY || a.maxOverlap > MAX_WORDS_PER_CELL;
}

/**
 * How bad one puzzle is, on one number, so "the ten worst" is a fact
 * rather than a mood.
 *
 * Occupancy is the continuous axis and carries the ranking; every word on
 * a cell beyond the second adds ten percentage points of it. That weight
 * is a judgement, and it is the one that makes both of the brief's own
 * examples come out right: an old-style density of 110% with overlap ≤ 2
 * scores by its occupancy alone, while 70% occupancy with four words on a
 * cell scores 0.90 and rises into the worst tier.
 *
 * What the sweep also showed, and what the brief's first example gets
 * wrong: a high old density with clean overlap is NOT automatically fine.
 * B2/42 has old density 106.3% and never puts more than 2 words on a
 * cell, yet its occupancy is 96.9% — eight filler cells in the whole
 * 16×16 grid. Overlap explains only part of why the old number ran past
 * 100%; the rest is words simply covering nearly every cell.
 */
export function severity(a: Pick<PuzzleAudit, "occupancy" | "maxOverlap">): number {
  return a.occupancy + 0.1 * Math.max(0, a.maxOverlap - 2);
}

/** Deterministic worst-first order. Ties on severity are broken by the
 * numbers a reader would look at next — fewer filler cells first, then
 * more words, then level/sequence — so "the ten worst" is reproducible
 * rather than dependent on the database's row order. */
export function worstFirst(audits: PuzzleAudit[]): PuzzleAudit[] {
  return [...audits].sort(
    (x, y) =>
      severity(y) - severity(x) ||
      x.fillerCells - y.fillerCells ||
      y.wordCount - x.wordCount ||
      x.level.localeCompare(y.level) ||
      x.sequence - y.sequence,
  );
}
