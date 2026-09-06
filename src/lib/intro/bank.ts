import "server-only";
import { db } from "@/lib/db";
import { cached, getOrCreateGlobalSingleton, isPlainObject, TtlCache } from "@/lib/ttl-cache";
import { introStatsFrom, type IntroBankCounts, type IntroStats } from "./stats";

/**
 * The database half of the introduction deck's numbers.
 *
 * Same shape and same 5-minute TTL as src/lib/home-stats.ts, and the same
 * failure rule: a bank that cannot be counted returns null, not zero and
 * not a number written down here. `0 relatos` is a worse thing to show a
 * visitor than showing nothing, and a stand-in constant is the very defect
 * this whole module set exists to remove — see the header of ./stats.ts.
 *
 * Seven counts in one round trip each; the page that calls it
 * (/[lang]/courses) already reads the dictionary and the level list, and
 * the PDF route reads nothing else at all.
 */
const introBankCache = getOrCreateGlobalSingleton(
  "introBankCache",
  () => new TtlCache<IntroBankCounts>(5 * 60_000, "intro-bank", isPlainObject),
);

export async function getIntroBankCounts(): Promise<IntroBankCounts | null> {
  try {
    return await cached(introBankCache, "all", async () => {
      const [flashcards, stories, freeStories, idioms, glossaryTerms, wordSearchPuzzles, crosswordPuzzles] =
        await Promise.all([
          db.flashcardCard.count(),
          db.story.count(),
          db.story.count({ where: { isPremium: false } }),
          db.idiom.count(),
          db.glossaryTerm.count(),
          db.wordGamePuzzle.count({ where: { type: "WORD_SEARCH" } }),
          db.wordGamePuzzle.count({ where: { type: "CROSSWORD" } }),
        ]);
      return { flashcards, stories, freeStories, idioms, glossaryTerms, wordSearchPuzzles, crosswordPuzzles };
    });
  } catch (error) {
    console.error("[intro] could not count the content bank; the deck drops those sentences", error);
    return null;
  }
}

export async function getIntroStats(): Promise<IntroStats> {
  return introStatsFrom(await getIntroBankCounts());
}
