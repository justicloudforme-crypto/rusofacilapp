import type { FlashcardRow } from "./index";
import type { SrsEntry } from "../flashcard-progress";
import { shuffle } from "./shuffle";

/** Target composition of a recall-mode round: mostly words the learner has
 * seen but not yet mastered (where active recall pays off most), a slice of
 * brand-new words to keep the deck growing, and a slice of already-mastered
 * words so they don't silently decay. See rusofasil discussion: "60% на
 * грани / 20% новые / 20% повторение". */
const LEARNING_SHARE = 0.6;
const NEW_SHARE = 0.2;
const MASTERED_BOX = 2;

/** Picks `count` cards from `pool`, falling back to `fallbacks` (in order)
 * for any shortfall, without ever picking the same card twice. */
function fill(pool: FlashcardRow[], count: number, fallbacks: FlashcardRow[][], taken: Set<string>): FlashcardRow[] {
  const picked: FlashcardRow[] = [];
  for (const card of pool) {
    if (picked.length >= count) break;
    if (taken.has(card.id)) continue;
    picked.push(card);
    taken.add(card.id);
  }
  for (const fallbackPool of fallbacks) {
    for (const card of fallbackPool) {
      if (picked.length >= count) break;
      if (taken.has(card.id)) continue;
      picked.push(card);
      taken.add(card.id);
    }
    if (picked.length >= count) break;
  }
  return picked;
}

/** Builds one recall-trainer round from a category's cards and the
 * learner's SRS progress. Cards missing from `srsMap` are "new" (never
 * attempted); box 0-1 with an entry is "learning"; box 2 is "mastered".
 * Returns fewer than `size` cards if the category itself has fewer. */
export function buildRecallRound(cards: FlashcardRow[], srsMap: Record<string, SrsEntry>, size = 10): FlashcardRow[] {
  if (cards.length <= size) return shuffle(cards);

  const newCards: FlashcardRow[] = [];
  const learningCards: FlashcardRow[] = [];
  const masteredCards: FlashcardRow[] = [];
  for (const card of cards) {
    const entry = srsMap[card.id];
    if (!entry) newCards.push(card);
    else if (entry.box >= MASTERED_BOX) masteredCards.push(card);
    else learningCards.push(card);
  }

  const shuffledNew = shuffle(newCards);
  const shuffledLearning = shuffle(learningCards);
  const shuffledMastered = shuffle(masteredCards);

  const learningTarget = Math.round(size * LEARNING_SHARE);
  const newTarget = Math.round(size * NEW_SHARE);
  const masteredTarget = size - learningTarget - newTarget;

  const taken = new Set<string>();
  const round: FlashcardRow[] = [
    ...fill(shuffledLearning, learningTarget, [shuffledNew, shuffledMastered], taken),
    ...fill(shuffledNew, newTarget, [shuffledLearning, shuffledMastered], taken),
    ...fill(shuffledMastered, masteredTarget, [shuffledLearning, shuffledNew], taken),
  ];

  return shuffle(round);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

/** Case-insensitive, ё/е-insensitive comparison, with a one-typo tolerance
 * band on words of 4+ letters ("almost") between an exact match and a
 * miss. Minimum length is loaded to avoid two genuinely different 2-3
 * letter words (e.g. "он"/"она") reading as "almost". */
export type RecallResult = "correct" | "almost" | "incorrect";

function normalize(word: string): string {
  return word.trim().toLowerCase().replaceAll("ё", "е");
}

export function checkRecallAnswer(input: string, correctWord: string): RecallResult {
  const normalizedInput = normalize(input);
  const normalizedCorrect = normalize(correctWord);
  if (!normalizedInput) return "incorrect";
  if (normalizedInput === normalizedCorrect) return "correct";
  if (normalizedCorrect.length >= 4 && levenshtein(normalizedInput, normalizedCorrect) <= 1) return "almost";
  return "incorrect";
}
