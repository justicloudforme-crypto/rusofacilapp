/**
 * Single shared cache for the whole FlashcardCard bank (with narration audio
 * URLs attached) — every list/search/summary read derives from this one
 * cached array instead of each endpoint keeping its own separately-keyed
 * in-memory cache.
 *
 * Backed by Upstash Redis via TtlCache (see src/lib/ttl-cache.ts), which is
 * the real fix for the "new batch of cards doesn't show up on the live
 * site" bug: the old src/lib/cache.ts was a plain in-process Map, correct
 * only behind a single server instance. On Vercel, multiple concurrent
 * serverless instances each had their own independent copy — an admin
 * save/delete only busted the instance that handled that one request, and a
 * bulk `npm run db:add-flashcards` import (a CLI script in a totally
 * separate process) could never reach any live instance's Map at all, so a
 * freshly-inserted batch stayed invisible until each instance's own 5-minute
 * TTL happened to expire. Redis is a real network service every process
 * (deployed server AND the CLI script) can reach, so a single invalidation
 * call here is immediately visible everywhere.
 */
import { cached, getOrCreateGlobalSingleton, TtlCache } from "../ttl-cache";
import { db } from "../db";
import { parseWordRelationsJson } from "./index";
import type { FlashcardRow } from "./index";

const FLASHCARD_INDEX_TTL_MS = 5 * 60_000;
const FLASHCARD_INDEX_KEY = "all";

export const flashcardIndexCache = getOrCreateGlobalSingleton(
  "flashcardIndexCache",
  () => new TtlCache<FlashcardRow[]>(FLASHCARD_INDEX_TTL_MS, "flashcards")
);

async function fetchFlashcardIndex(): Promise<FlashcardRow[]> {
  const cards = await db.flashcardCard.findMany({ orderBy: { createdAt: "asc" } });
  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) }, itemKey: "word" },
    select: { contentId: true, audioUrl: true },
  });
  const audioByCardId = new Map(audioRows.map((row) => [row.contentId, row.audioUrl]));

  return cards.map((card) => ({
    ...card,
    category: card.category as FlashcardRow["category"],
    level: card.level as FlashcardRow["level"],
    synonyms: parseWordRelationsJson(card.synonyms),
    antonyms: parseWordRelationsJson(card.antonyms),
    audioUrl: audioByCardId.get(card.id) ?? null,
  }));
}

/** Returns the cached full card bank, loading it from the DB on a cold
 * cache/miss. Used by both GET /api/flashcards and GET /api/flashcards/summary
 * so they always agree and share one invalidation point. */
export async function getFlashcardIndex(): Promise<FlashcardRow[]> {
  return cached(flashcardIndexCache, FLASHCARD_INDEX_KEY, fetchFlashcardIndex);
}

/** Call after ANY write to FlashcardCard — admin save/delete routes, or the
 * prisma/add-flashcards.ts bulk-import CLI script. */
export async function invalidateFlashcardIndex(): Promise<void> {
  await flashcardIndexCache.del(FLASHCARD_INDEX_KEY);
}
