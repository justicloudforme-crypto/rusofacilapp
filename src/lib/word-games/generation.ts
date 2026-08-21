// Shared, pure helpers for both generators in prisma/generate-word-games.ts
// (WORD_SEARCH and CROSSWORD) — kept here rather than duplicated in the
// script so both algorithms draw from the exact same deterministic RNG and
// word-selection logic.

// mulberry32 — tiny deterministic PRNG so a given seed string always
// produces the same sequence, letting a puzzle regenerate byte-identical
// as long as its source words haven't changed.
export function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let seed = h >>> 0;
  return function rng() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A word is grid-friendly if it's a single unbroken run of Cyrillic
// letters (no spaces/hyphens/compound phrases).
const SINGLE_CYRILLIC_WORD = /^[а-яё]+$/i;

export interface WordCandidate {
  word: string;
  clue: string;
}

export function candidateWords(
  cards: { russian: string; translationEs: string; exampleEs: string }[],
  maxLen: number,
  buildClue: (card: { translationEs: string; exampleEs: string }, word: string) => string | null,
  minLen = 3
): WordCandidate[] {
  const seen = new Set<string>();
  const out: WordCandidate[] = [];
  for (const card of cards) {
    const word = card.russian.trim().toLowerCase();
    if (!SINGLE_CYRILLIC_WORD.test(word)) continue;
    if (word.length < minLen || word.length > maxLen) continue;
    if (seen.has(word)) continue;
    const clue = buildClue(card, word);
    // No good clue for this level (e.g. a masked-example clue that
    // couldn't locate the word in its own example sentence) — skip the
    // word rather than ship a broken or spoiling clue.
    if (!clue) continue;
    seen.add(word);
    out.push({ word, clue });
  }

  // A content-audit finding: two different words occasionally land on the
  // identical clue text (shared/overlapping translationEs, e.g. two
  // synonyms both glossed "caro"). Whichever word a player is actually
  // looking for, an ambiguous clue shared with another word in the SAME
  // puzzle's own word list is a genuine defect, not just noise — drop
  // every word involved in a clue collision rather than arbitrarily
  // keeping one and hoping it was the "right" one.
  const clueCounts = new Map<string, number>();
  for (const c of out) clueCounts.set(c.clue, (clueCounts.get(c.clue) ?? 0) + 1);
  return out.filter((c) => clueCounts.get(c.clue) === 1);
}
