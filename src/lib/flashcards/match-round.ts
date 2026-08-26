import type { FlashcardRow } from "./index";
import { shuffle } from "./shuffle";

/** The cards a match round could actually draw from: one card per distinct
 * Russian word — two tiles reading the exact same word would be genuinely
 * ambiguous to match, not just a cosmetic repeat. Shared by buildMatchRound
 * and countPlayableCards so "how many pairs could this pool make" and
 * "which cards actually get used" never drift apart.
 *
 * Used to filter on the card's *icon* instead (one card per distinct
 * emoji), back when the round matched an emoji tile against a word tile.
 * That constraint collapsed some categories down to almost nothing — many
 * cards in the same category legitimately share one emoji (e.g. several
 * "shopping" words under a single 🛍️), so a whole category could produce
 * only 1-2 "distinct icon" cards even with hundreds of real words in it.
 * Matching by word text instead of icon removes that artificial ceiling. */
function distinctByWord(cards: FlashcardRow[]): FlashcardRow[] {
  const seen = new Set<string>();
  const result: FlashcardRow[] = [];
  for (const card of cards) {
    const key = card.russian.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

/** Builds one match-game round: `size` cards, no two sharing the same
 * Russian word. Returns fewer than `size` cards if the category doesn't
 * have enough distinct words at the current level filter — the caller is
 * responsible for telling the player there aren't enough cards rather than
 * running a round with too few pairs. */
export function buildMatchRound(cards: FlashcardRow[], size: number): FlashcardRow[] {
  return shuffle(distinctByWord(cards)).slice(0, size);
}

/** How many pairs a card pool could ever make — used to disable a level
 * filter button before the player picks it, rather than letting them
 * switch into a level with too few cards and only finding out from an
 * empty board. */
export function countPlayableCards(cards: FlashcardRow[]): number {
  return distinctByWord(cards).length;
}
