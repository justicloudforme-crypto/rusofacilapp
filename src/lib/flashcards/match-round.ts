import type { FlashcardRow } from "./index";
import { shuffle } from "./shuffle";

/** The cards a match round could actually draw from: has an icon, and only
 * one card per distinct icon (two tiles showing the same emoji would be
 * genuinely ambiguous to match, not just a cosmetic repeat) — shared by
 * buildMatchRound and countPlayableCards so "how many pairs could this
 * pool make" and "which cards actually get used" never drift apart. */
function distinctIconCards(cards: FlashcardRow[]): FlashcardRow[] {
  const seenEmoji = new Set<string>();
  const result: FlashcardRow[] = [];
  for (const card of cards) {
    const emoji = card.emoji.trim();
    if (!emoji || seenEmoji.has(emoji)) continue;
    seenEmoji.add(emoji);
    result.push(card);
  }
  return result;
}

/** Builds one match-game round: `size` cards, each with a usable emoji icon
 * and no two sharing the same emoji. Returns fewer than `size` cards if the
 * category doesn't have enough distinct-icon words at the current level
 * filter — the caller is responsible for telling the player there aren't
 * enough cards rather than running a round with too few pairs. */
export function buildMatchRound(cards: FlashcardRow[], size: number): FlashcardRow[] {
  return shuffle(distinctIconCards(cards)).slice(0, size);
}

/** How many pairs a card pool could ever make — used to disable a level
 * filter button before the player picks it, rather than letting them
 * switch into a level with too few cards and only finding out from an
 * empty board. */
export function countPlayableCards(cards: FlashcardRow[]): number {
  return distinctIconCards(cards).length;
}
