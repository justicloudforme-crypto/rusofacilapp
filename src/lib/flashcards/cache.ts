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
 *
 * Two-tier on top of that: a short-lived (30s) plain in-process value sits
 * in front of the Redis-backed TtlCache below. Measured empirically — with
 * real Upstash credentials configured, EVERY read (including cache hits)
 * was paying a ~1-1.3s network round trip to fetch/re-store the full ~2.3MB
 * JSON blob over Redis's REST API, since TtlCache.get() always hits Redis
 * when it's configured, never a local Map. That made the "fix" for
 * cross-instance staleness slower than the old always-in-memory cache for
 * the common case of repeated reads within one warm instance. The local
 * layer keeps those repeated reads fast (sub-millisecond) while still
 * bounding cross-instance staleness to at most 30s beyond whatever's left
 * of the Redis TTL — a small, deliberate trade against the old "could be
 * stale until an instance restarts" behavior.
 */
import { cached, getOrCreateGlobalSingleton, TtlCache } from "../ttl-cache";
import { db } from "../db";
import { parseWordRelationsJson } from "./index";
import type { FlashcardRow } from "./index";

const FLASHCARD_INDEX_TTL_MS = 5 * 60_000;
const FLASHCARD_INDEX_KEY = "all";
const LOCAL_LAYER_TTL_MS = 30_000;

export const flashcardIndexCache = getOrCreateGlobalSingleton(
  "flashcardIndexCache",
  () => new TtlCache<FlashcardRow[]>(FLASHCARD_INDEX_TTL_MS, "flashcards")
);

interface LocalEntry {
  value: FlashcardRow[];
  expiresAt: number;
}

const localLayer = getOrCreateGlobalSingleton<{ entry: LocalEntry | null }>(
  "flashcardIndexLocalLayer",
  () => ({ entry: null })
);

async function fetchFlashcardIndex(): Promise<FlashcardRow[]> {
  const cards = await db.flashcardCard.findMany({ orderBy: { createdAt: "asc" } });
  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "flashcard", contentId: { in: cards.map((card) => card.id) } },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const wordAudioByCardId = new Map<string, string>();
  const exampleAudioByCardId = new Map<string, string>();
  for (const row of audioRows) {
    if (row.itemKey === "word") wordAudioByCardId.set(row.contentId, row.audioUrl);
    else if (row.itemKey === "example") exampleAudioByCardId.set(row.contentId, row.audioUrl);
  }

  return cards.map((card) => ({
    ...card,
    category: card.category as FlashcardRow["category"],
    level: card.level as FlashcardRow["level"],
    synonyms: parseWordRelationsJson(card.synonyms),
    antonyms: parseWordRelationsJson(card.antonyms),
    audioUrl: wordAudioByCardId.get(card.id) ?? null,
    exampleAudioUrl: exampleAudioByCardId.get(card.id) ?? null,
  }));
}

/** Returns the cached full card bank, loading it from the DB on a cold
 * cache/miss. Used by both GET /api/flashcards and GET /api/flashcards/summary
 * so they always agree and share one invalidation point. */
export async function getFlashcardIndex(): Promise<FlashcardRow[]> {
  const local = localLayer.entry;
  if (local && local.expiresAt > Date.now()) return local.value;

  const value = await cached(flashcardIndexCache, FLASHCARD_INDEX_KEY, fetchFlashcardIndex);
  localLayer.entry = { value, expiresAt: Date.now() + LOCAL_LAYER_TTL_MS };
  return value;
}

/** Call after ANY write to FlashcardCard — admin save/delete routes, or the
 * prisma/add-flashcards.ts bulk-import CLI script. Clears both layers so
 * THIS process sees the change immediately; other instances pick it up
 * within their own local layer's 30s window. */
export async function invalidateFlashcardIndex(): Promise<void> {
  localLayer.entry = null;
  await flashcardIndexCache.del(FLASHCARD_INDEX_KEY);
}
