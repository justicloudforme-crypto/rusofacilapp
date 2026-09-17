import "server-only";
import { db } from "./db";
import { cached, getOrCreateGlobalSingleton, isPlainObject, TtlCache } from "./ttl-cache";
import { attachNarration, peekFlashcardIndex } from "./flashcards/cache";
import type { FlashcardRow } from "./flashcards";
import { isStoryLevel, type StoryLevel } from "./stories";

export interface HomepageStats {
  wordCount: number;
  storyCount: number;
}

// Real counts for the homepage trust strip, not hardcoded copy that drifts
// from the actual content bank the moment a batch of cards/stories is
// added. Same 5-minute TTL pattern as stories-catalog.ts/streaks.ts.
const homepageStatsCache = getOrCreateGlobalSingleton(
  "homepageStatsCache",
  () => new TtlCache<HomepageStats>(5 * 60_000, "homepage-stats", isPlainObject)
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

/**
 * Real greeting-category, A1-level flashcards for the hero demo deck.
 *
 * ДОЛГ 250, ШАГ 1 (18.09.2026). До этой правки здесь строился ВЕСЬ банк
 * (`getFlashcardIndex()`) ради пяти карточек: замер боевой базы
 * 17.09.2026 — 5771 строка `FlashcardCard` плюс 11 542 строки
 * `AudioAsset`. Теперь спрашивается ровно тот срез, который показывается.
 *
 * Порядок тот же (`createdAt asc`), поэтому какие именно пять карточек
 * попадут в колоду, правка не меняет — это доказано побайтовым сличением
 * HTML главной до и после.
 *
 * Тёплый экземпляр не платит ничего: если полный банк уже прочитан ЭТИМ
 * процессом, срез берётся из него и запроса нет вовсе.
 */
export async function getHomepageWordSample(count = 5): Promise<FlashcardRow[]> {
  // Empty on failure; the homepage already renders the hero deck only when
  // `words.length > 0`, so this costs the deck and nothing else.
  try {
    const warm = peekFlashcardIndex();
    if (warm) return warm.filter((card) => card.category === "greetings" && card.level === "A1").slice(0, count);
    const cards = await db.flashcardCard.findMany({
      where: { category: "greetings", level: "A1" },
      orderBy: { createdAt: "asc" },
      take: count,
    });
    // Озвучка спрашивается только про ЭТИ строки. Та же деградация, что у
    // полного банка: без записи карточка остаётся карточкой.
    const audioRows = cards.length
      ? await db.audioAsset.findMany({
          where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) } },
          select: { contentId: true, itemKey: true, audioUrl: true },
        })
      : [];
    return attachNarration(cards, audioRows);
  } catch (error) {
    console.error("[home-stats] could not read the flashcard bank; serving the homepage without the hero deck", error);
    return [];
  }
}

/** Ровно те поля рассказа, которые главная печатает, — и ни одного
 *  сверх того. Это НЕ `StoryCatalogRow`: каталог несёт ещё восемь колонок
 *  и одну группировку по озвучке, которых на главной не видно (долг 250). */
export interface HomepagePreviewStory {
  id: string;
  title: string;
  titleEs: string | null;
  author: string;
  level: StoryLevel;
  description: string | null;
}

export interface HomepagePreviewData {
  /** A real A1 flashcard from a different category than the hero deck
   * (which already uses "greetings"), for the vocabulary section preview. */
  previewWord: FlashcardRow | null;
  /** A real, currently free-to-read story for the stories section preview —
   * filtered to isPremium: false so the preview never shows something the
   * visitor can't actually open for free. */
  previewStory: HomepagePreviewStory | null;
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
  //
  // ДОЛГ 250, ШАГ 1 (18.09.2026). До правки здесь звались
  // `getFlashcardIndex()` и `getStoryCatalog()` — 5771 карточка, 11 542
  // строки озвучки и 325 рассказов ради ОДНОГО слова, СЕМИ слов для плиток
  // игры и ОДНОЙ карточки рассказа. Условия отбора и порядок повторены
  // буквально, чтобы на главной остались те же самые строки:
  //   слово-образец  — первая A1-карточка темы `food` по `createdAt asc`;
  //   слова для игры — первые семь A1-карточек темы `city`, тем же порядком;
  //   рассказ        — первый A1 без `isPremium` по `createdAt desc`, и
  //                    строка с неизвестным уровнем отбрасывается ровно
  //                    так же, как её отбрасывает каталог (`isStoryLevel`).
  try {
    const warm = peekFlashcardIndex();
    const sliceOf = async (category: string, take: number, narration: boolean): Promise<FlashcardRow[]> => {
      if (warm) return warm.filter((card) => card.category === category && card.level === "A1").slice(0, take);
      const cards = await db.flashcardCard.findMany({
        where: { category, level: "A1" },
        orderBy: { createdAt: "asc" },
        take,
      });
      if (!narration || cards.length === 0) return attachNarration(cards, []);
      const audioRows = await db.audioAsset.findMany({
        where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) } },
        select: { contentId: true, itemKey: true, audioUrl: true },
      });
      return attachNarration(cards, audioRows);
    };
    const [words, gameCards, storyRows] = await Promise.all([
      sliceOf("food", 1, true),
      // Слова для плиток игры печатаются ТЕКСТОМ: озвучка им не нужна, и
      // спрашивать её значило бы платить за то, чего на экране нет.
      sliceOf("city", 7, false),
      db.story.findMany({
        where: { level: "A1", isPremium: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, titleEs: true, author: true, level: true, description: true },
        take: 5,
      }),
    ]);
    const row = storyRows.find((candidate) => isStoryLevel(candidate.level));
    return {
      previewWord: words[0] ?? null,
      previewStory: row ? { ...row, level: row.level as StoryLevel } : null,
      previewGameWords: gameCards.map((card) => card.russian),
    };
  } catch (error) {
    console.error("[home-stats] could not read cards/stories; serving the homepage without the previews", error);
    return { previewWord: null, previewStory: null, previewGameWords: [] };
  }
}
