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
import { isStoryLevel, type StoryLevel } from "@/lib/stories";

export interface StoryCatalogRow {
  id: string;
  title: string;
  author: string;
  level: StoryLevel;
  isPremium: boolean;
  premiumOnly: boolean;
  description: string | null;
}

const storyCatalogCache = getOrCreateGlobalSingleton(
  "storyCatalogCache",
  () => new TtlCache<StoryCatalogRow[]>(60_000, "storyCatalog")
);

export async function getStoryCatalog(): Promise<StoryCatalogRow[]> {
  return cached(storyCatalogCache, "all", async () => {
    const rows = await db.story.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, author: true, level: true, isPremium: true, premiumOnly: true, description: true },
    });
    return rows
      .filter((row) => isStoryLevel(row.level))
      .map((row) => ({ ...row, level: row.level as StoryLevel }));
  });
}

/** Call after any write to a Story row (admin save or delete) so the next
 * catalog read reflects it immediately instead of waiting out the TTL. */
export async function invalidateStoryCatalogCache(): Promise<void> {
  await storyCatalogCache.del("all");
}
