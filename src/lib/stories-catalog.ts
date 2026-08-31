/**
 * Server-only story catalog fetch — kept out of src/lib/stories.ts on
 * purpose, since that file is imported by client components (StoryEditor,
 * StoriesCatalog, StoryText) and pulling `db` into it would bundle Prisma
 * into the browser build. Same split as src/lib/lessons/content.ts vs.
 * src/lib/lessons/types.ts.
 *
 * The catalog page only ever needs title/author/level/isPremium/description
 * for the card grid — not the full story `text`/`translationEs`, which on
 * 315 rows (and growing) is the single most expensive uncached read in the
 * app (see the architecture audit). Cached the same way lesson/exam content
 * already is: 60s TTL, Redis-backed when configured (see ttl-cache.ts),
 * invalidated explicitly by the admin save/delete routes.
 */
import "server-only";
import { db } from "@/lib/db";
import { cached, getOrCreateGlobalSingleton, TtlCache } from "@/lib/ttl-cache";
import { isClassicStory, isStoryLevel, isStoryTopic, type StoryLevel, type StoryTopic } from "@/lib/stories";

export interface StoryCatalogRow {
  id: string;
  title: string;
  author: string;
  level: StoryLevel;
  isPremium: boolean;
  premiumOnly: boolean;
  description: string | null;
  /** Null for every row as of this column's introduction (see
   * schema.prisma) — callers must fall back to `description` (Spanish)
   * on /ru too, never hide the summary block just because this is empty. */
  descriptionRu: string | null;
  /** At least one sentence has a real narrated clip (AudioAsset row) —
   * some stories are only partially narrated (see check-story-audio.ts),
   * so this means "some audio", not "fully narrated". */
  hasAudio: boolean;
  /** Null only for a row written before this column existed and not yet
   * covered by the one-time backfill script (db:backfill-reading-minutes) —
   * callers must treat that as "unknown," not 0. */
  readingMinutes: number | null;
  topic: StoryTopic;
  /** Retelling/adaptation of existing literature (or a folk tale) vs. an
   * original RusoFásil story — a SOURCE distinction, not a topic. See
   * isClassicStory in src/lib/stories.ts. */
  isClassic: boolean;
}

const storyCatalogCache = getOrCreateGlobalSingleton(
  "storyCatalogCache",
  () => new TtlCache<StoryCatalogRow[]>(60_000, "storyCatalog", Array.isArray)
);

export async function getStoryCatalog(): Promise<StoryCatalogRow[]> {
  return cached(storyCatalogCache, "all", async () => {
    // One grouped COUNT rather than a per-story join — cheap regardless of
    // catalog size, and keeps the "don't pull story.text into the list
    // query" cost discipline from the comment above intact.
    const [rows, audioCounts] = await Promise.all([
      db.story.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          author: true,
          level: true,
          isPremium: true,
          premiumOnly: true,
          description: true,
          descriptionRu: true,
          readingMinutes: true,
          topic: true,
        },
      }),
      db.audioAsset.groupBy({
        by: ["contentId"],
        where: { contentType: "story" },
        _count: { _all: true },
      }),
    ]);
    const storyIdsWithAudio = new Set(audioCounts.map((row) => row.contentId));
    return rows
      .filter((row) => isStoryLevel(row.level))
      .map((row) => ({
        ...row,
        level: row.level as StoryLevel,
        hasAudio: storyIdsWithAudio.has(row.id),
        topic: isStoryTopic(row.topic) ? row.topic : "other",
        isClassic: isClassicStory(row.author),
      }));
  });
}

/** Call after any write to a Story row (admin save or delete) so the next
 * catalog read reflects it immediately instead of waiting out the TTL. */
export async function invalidateStoryCatalogCache(): Promise<void> {
  await storyCatalogCache.del("all");
}
