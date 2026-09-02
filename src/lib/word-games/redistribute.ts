// Spreading one over-packed WORD_SEARCH puzzle's words across several
// grids — the same words, fewer per grid.
//
// Why this shape. The words are not the problem (they come straight from
// the FlashcardCard bank and are the level's real vocabulary), and the
// grid cannot grow past 16 columns without breaking the phone layout (see
// WordSearchBoard). So the only lever left is how many words share one
// 16×16 grid. This module takes a puzzle's word list and returns N grids
// that between them contain exactly the same words — none dropped, none
// invented.
import { buildWordSearch } from "./word-search";
import { makeRng, type WordCandidate } from "./generation";
import { occupancyStats } from "./word-search-audit";
import type { WordGameGrid, WordPlacement } from "./types";

/** Chunks are built to land under this, not under OCCUPANCY_LIMIT (0.80):
 * a split that lands at 0.79 is one word away from being flagged again,
 * and the whole point of redistributing is to leave room. */
export const SPLIT_TARGET_OCCUPANCY = 0.75;

/** A word search stops being one when there is nothing left to hide the
 * words in — but it also stops being one when there is nothing to find.
 * A split that drops a part below this is over-thinning, and the splitter
 * prefers fewer, fuller parts over more, emptier ones. */
export const MIN_PART_OCCUPANCY = 0.3;

export const MAX_PARTS = 4;

export interface BuiltPart {
  grid: WordGameGrid;
  words: WordPlacement[];
  occupancy: number;
  maxOverlap: number;
}

/** Deals the words into `parts` buckets longest-first, round-robin and
 * then back (boustrophedon), so every bucket gets a comparable share of
 * the long words instead of one bucket collecting them all. Letter counts
 * come out within a few of each other, which is what makes the parts
 * land at similar occupancy. */
export function dealWords(words: WordCandidate[], parts: number): WordCandidate[][] {
  const byLength = [...words].sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));
  const buckets: WordCandidate[][] = Array.from({ length: parts }, () => []);
  byLength.forEach((w, i) => {
    const lap = Math.floor(i / parts);
    const slot = i % parts;
    buckets[lap % 2 === 0 ? slot : parts - 1 - slot].push(w);
  });
  return buckets;
}

/** Builds one bucket into a 16×16 grid, retrying seeds until every word
 * in it is actually placed. Returns null if none of the attempts fits the
 * whole bucket — the caller then splits further rather than shipping a
 * part that quietly lost a word. */
export function buildPart(
  bucket: WordCandidate[],
  size: number,
  seedPrefix: string,
  attempts = 12,
): BuiltPart | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const built = buildWordSearch(bucket, size, bucket.length, makeRng(`${seedPrefix}-try${attempt}`));
    if (!built || built.words.length < bucket.length) continue;
    const stats = occupancyStats(built.grid.grid, built.words);
    if (stats.placementMismatches.length > 0) continue;
    return { grid: built.grid, words: built.words, occupancy: stats.occupancy, maxOverlap: stats.maxOverlap };
  }
  return null;
}

export interface SplitResult {
  parts: BuiltPart[];
  /** Every word of the input, in the order the parts hold them — checked
   * against the input by the caller. */
  wordsOut: string[];
}

/**
 * Splits into the FEWEST parts that all land under
 * SPLIT_TARGET_OCCUPANCY with at most 3 words on any cell, every word
 * placed. Starts at two parts (one part is what we are fixing) and grows.
 *
 * Returns null when even MAX_PARTS cannot do it — a caller must not
 * silently ship a part that is still over the line.
 */
export function splitPuzzle(
  words: WordCandidate[],
  size: number,
  seedPrefix: string,
): SplitResult | null {
  for (let parts = 2; parts <= MAX_PARTS; parts++) {
    const buckets = dealWords(words, parts);
    if (buckets.some((b) => b.length === 0)) break;
    const built: BuiltPart[] = [];
    let ok = true;
    for (let i = 0; i < buckets.length; i++) {
      const part = buildPart(buckets[i], size, `${seedPrefix}-part${i}`);
      if (!part || part.occupancy > SPLIT_TARGET_OCCUPANCY || part.maxOverlap > 3) {
        ok = false;
        break;
      }
      built.push(part);
    }
    if (!ok) continue;
    // Over-thinning guard: if going one part further would be needed to
    // satisfy the line above we would already have failed; here we only
    // refuse a split whose parts came out emptier than a word search
    // should be.
    if (built.some((p) => p.occupancy < MIN_PART_OCCUPANCY) && parts > 2) continue;
    return { parts: built, wordsOut: built.flatMap((p) => p.words.map((w) => w.word)) };
  }
  return null;
}
