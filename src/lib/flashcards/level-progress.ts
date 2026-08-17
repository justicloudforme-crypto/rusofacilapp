import { flashcardLevels, type FlashcardLevel } from "./index";

/** A learner is considered to have a level well in hand once this share of
 * a category's words at that level are marked known — the threshold for
 * CategoryGrid's soft "try the next level" nudge. Deliberately just a
 * suggestion, never a gate: this app doesn't lock levels behind mastery
 * (see the rusofasil discussion this shipped from — locking was
 * considered and explicitly rejected as too restrictive for a
 * self-paced course). */
export const NEXT_LEVEL_SUGGESTION_THRESHOLD = 0.8;

/** The next level up in CEFR order, or null at the top (C1) or for any
 * value outside flashcardLevels (defensive — FlashcardLevel is a closed
 * union so this only matters if the list itself ever changes shape). */
export function getNextLevel(level: FlashcardLevel): FlashcardLevel | null {
  const index = flashcardLevels.indexOf(level);
  if (index === -1 || index === flashcardLevels.length - 1) return null;
  return flashcardLevels[index + 1];
}

/** Whether a category tile should show the "try {nextLevel}" nudge.
 * `null`/`"all"` for `levelFilter` means no nudge — there's no single
 * "current level" to suggest moving on from, and no known/total pair
 * scoped to one level to test against the threshold. */
export function shouldSuggestNextLevel(
  levelFilter: FlashcardLevel | "all",
  known: number,
  total: number
): boolean {
  if (levelFilter === "all") return false;
  if (total <= 0) return false;
  if (getNextLevel(levelFilter) === null) return false;
  return known / total >= NEXT_LEVEL_SUGGESTION_THRESHOLD;
}
