import "server-only";
import { db } from "./db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";
import { getFlashcardIndex } from "./flashcards/cache";
import type { FlashcardRow } from "./flashcards";
import { getStoryCatalog, type StoryCatalogRow } from "./stories-catalog";

export interface HomepageStats {
  wordCount: number;
  storyCount: number;
}

// Real counts for the homepage trust strip, not hardcoded copy that drifts
// from the actual content bank the moment a batch of cards/stories is
// added. Same 5-minute TTL pattern as stories-catalog.ts/streaks.ts.
const homepageStatsCache = getOrCreateGlobalSingleton(
  "homepageStatsCache",
  () => new TtlCache<HomepageStats>(5 * 60_000, "homepage-stats")
);

export async function getHomepageStats(): Promise<HomepageStats> {
  return cached(homepageStatsCache, "all", async () => {
    const [wordCount, storyCount] = await Promise.all([db.flashcardCard.count(), db.story.count()]);
    return { wordCount, storyCount };
  });
}

/** Real greeting-category, A1-level flashcards for the hero demo deck —
 * reuses the same cached full bank getFlashcardIndex() already builds
 * (word/example audioUrl already joined from AudioAsset), just filtered
 * and sliced. No new query, no new content invented. */
export async function getHomepageWordSample(count = 5): Promise<FlashcardRow[]> {
  const all = await getFlashcardIndex();
  return all.filter((card) => card.category === "greetings" && card.level === "A1").slice(0, count);
}

export interface HomepagePreviewData {
  /** A real A1 flashcard from a different category than the hero deck
   * (which already uses "greetings"), for the vocabulary section preview. */
  previewWord: FlashcardRow | null;
  /** A real, currently free-to-read story for the stories section preview —
   * filtered to isPremium: false so the preview never shows something the
   * visitor can't actually open for free. */
  previewStory: StoryCatalogRow | null;
  /** Real Russian words (not invented) rendered as static tiles for the
   * word-games section preview. Deliberately NOT wired to real crossword/
   * word-search generation logic (buildCrossword etc.) — per the redesign
   * brief, the homepage shows real words as a taste of the game, not a
   * playable game. */
  previewGameWords: string[];
}

export async function getHomepagePreviewData(): Promise<HomepagePreviewData> {
  const [flashcards, stories] = await Promise.all([getFlashcardIndex(), getStoryCatalog()]);

  const previewWord = flashcards.find((card) => card.category === "food" && card.level === "A1") ?? null;
  const previewStory = stories.find((story) => story.level === "A1" && !story.isPremium) ?? null;
  const previewGameWords = flashcards
    .filter((card) => card.category === "city" && card.level === "A1")
    .slice(0, 7)
    .map((card) => card.russian);

  return { previewWord, previewStory, previewGameWords };
}
