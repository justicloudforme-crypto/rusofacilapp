import "server-only";
import { db } from "./db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "./ttl-cache";
import { getFlashcardIndex } from "./flashcards/cache";
import type { FlashcardRow } from "./flashcards";

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
