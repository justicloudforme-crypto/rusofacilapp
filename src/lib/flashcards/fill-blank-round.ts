import type { FlashcardRow } from "./index";
import type { SrsEntry } from "../flashcard-progress";
import { buildRecallRound } from "./recall-round";

const CYRILLIC_LETTER = /[а-яёА-ЯЁ]/;

/** Finds the first case-insensitive, whole-word occurrence of `word` in
 * `sentence`. "Whole word" matters here specifically because Russian is
 * heavily inflected — a card's dictionary-form `russian` field
 * ("холодильник") often does NOT appear verbatim in its example sentence,
 * which naturally uses an inflected form ("В холодильникE..."). A plain
 * substring match would find "холодильник" inside "холодильнике" and blank
 * only part of the word, leaving a stray "е" and an answer that doesn't
 * actually match what's grammatically there. Checking that the characters
 * immediately before/after the match aren't themselves Cyrillic letters
 * rules that out — real data check: ~2500 of ~4000 cards have a clean
 * whole-word match, which is what buildFillBlankRound below filters to. */
export function findWholeWordSpan(sentence: string, word: string): { start: number; end: number } | null {
  const needle = word.trim().toLowerCase();
  if (!needle) return null;
  const haystack = sentence.toLowerCase();

  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return null;
    const before = sentence[idx - 1] ?? " ";
    const after = sentence[idx + needle.length] ?? " ";
    if (!CYRILLIC_LETTER.test(before) && !CYRILLIC_LETTER.test(after)) {
      return { start: idx, end: idx + needle.length };
    }
    from = idx + 1;
  }
  return null;
}

/** Splits a card's example sentence around its dictionary word, ready to
 * render as `{before}____{after}`. Returns null for the ~30% of cards
 * whose example doesn't contain a clean whole-word match — callers filter
 * those out via buildFillBlankRound rather than rendering a broken blank. */
export function getBlankedSentence(card: FlashcardRow): { before: string; after: string } | null {
  const span = findWholeWordSpan(card.exampleRu, card.russian);
  if (!span) return null;
  return { before: card.exampleRu.slice(0, span.start), after: card.exampleRu.slice(span.end) };
}

export function hasFillBlankSentence(card: FlashcardRow): boolean {
  return getBlankedSentence(card) !== null;
}

/** Same box-weighted selection as the typing trainer (buildRecallRound) —
 * fill-in-the-blank shares the same per-word SRS progress, just with a
 * different question format — narrowed first to cards whose example
 * sentence can actually be blanked cleanly. */
export function buildFillBlankRound(cards: FlashcardRow[], srsMap: Record<string, SrsEntry>, size = 10): FlashcardRow[] {
  return buildRecallRound(cards.filter(hasFillBlankSentence), srsMap, size);
}
