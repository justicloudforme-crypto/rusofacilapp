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

/**
 * Returns null when the counts cannot be read, and the homepage then drops
 * those two trust-strip items rather than the whole page (29.08.2026).
 *
 * `/es` and `/ru` are the two most valuable URLs on the site and they carry
 * the Organization and WebSite JSON-LD that nothing else does. Before this
 * they were built from `Promise.all` of three database-backed reads with
 * no guard, so any one of them failing returned 500 for the front page —
 * over a pair of numbers in a decorative strip.
 *
 * Null rather than zero on purpose: "0 palabras" is a worse thing to show
 * a visitor than showing nothing, and a fabricated count is the same lie
 * as a fabricated lastmod.
 */
export async function getHomepageStats(): Promise<HomepageStats | null> {
  try {
    return await cached(homepageStatsCache, "all", async () => {
      const [wordCount, storyCount] = await Promise.all([db.flashcardCard.count(), db.story.count()]);
      return { wordCount, storyCount };
    });
  } catch (error) {
    console.error("[home-stats] could not count cards/stories; serving the homepage without them", error);
    return null;
  }
}

/** Real greeting-category, A1-level flashcards for the hero demo deck —
 * reuses the same cached full bank getFlashcardIndex() already builds
 * (word/example audioUrl already joined from AudioAsset), just filtered
 * and sliced. No new query, no new content invented. */
export async function getHomepageWordSample(count = 5): Promise<FlashcardRow[]> {
  // Empty on failure; the homepage already renders the hero deck only when
  // `words.length > 0`, so this costs the deck and nothing else.
  try {
    const all = await getFlashcardIndex();
    return all.filter((card) => card.category === "greetings" && card.level === "A1").slice(0, count);
  } catch (error) {
    console.error("[home-stats] could not read the flashcard bank; serving the homepage without the hero deck", error);
    return [];
  }
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
  // Each of the three previews is independently guarded by the page
  // (`preview.previewWord &&`, `preview.previewStory &&`,
  // `previewGameWords.length > 0`), so the honest failure mode is an empty
  // preview object — the section disappears, the page stays.
  let flashcards: FlashcardRow[] = [];
  let stories: StoryCatalogRow[] = [];
  try {
    [flashcards, stories] = await Promise.all([getFlashcardIndex(), getStoryCatalog()]);
  } catch (error) {
    console.error("[home-stats] could not read cards/stories; serving the homepage without the previews", error);
    return { previewWord: null, previewStory: null, previewGameWords: [] };
  }

  const previewWord = flashcards.find((card) => card.category === "food" && card.level === "A1") ?? null;
  const previewStory = stories.find((story) => story.level === "A1" && !story.isPremium) ?? null;
  const previewGameWords = flashcards
    .filter((card) => card.category === "city" && card.level === "A1")
    .slice(0, 7)
    .map((card) => card.russian);

  return { previewWord, previewStory, previewGameWords };
}
