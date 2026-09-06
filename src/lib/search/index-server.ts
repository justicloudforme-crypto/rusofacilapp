import { cached, getOrCreateGlobalSingleton, TtlCache } from "@/lib/ttl-cache";
import { buildSearchRecords } from "./records";
import { loadSearchSources } from "./sources";
import type { SearchRecord } from "./types";

/**
 * Кеш индекса поиска.
 *
 * Пометки `server-only` здесь нет, и намеренно. Сброс обязаны звать не
 * только админские маршруты, но и CLI-скрипты, которые пишут содержимое
 * своим процессом (`db:add-flashcards`, `generate:word-games`, сиды,
 * `sync:to-production`), — а модуль с `import "server-only"` под `tsx` не
 * разрешается вовсе. Ровно этот барьер и породил в своё время «новая
 * пачка карточек не появляется на живом сайте»: сбросить общий кеш было
 * некому. Ничего запросного (куки, сессия, секрет) модуль не трогает —
 * только Redis и публичный каталог.
 *
 * Устройство списано с `src/lib/flashcards/cache.ts` не из подражания, а
 * потому, что там уже оплачены два урока, которые иначе пришлось бы
 * получить второй раз:
 *
 *  1. Кеш обязан быть общим для процессов, а не `Map` внутри одного.
 *     Содержимое, которое печатает индекс, правят и админские маршруты, и
 *     CLI-скрипты (`db:add-flashcards`, `generate:word-games`, сиды) — из
 *     чужого процесса `Map` не сбросить никак.
 *  2. Поверх Redis нужен короткий локальный слой. Замер там же: КАЖДОЕ
 *     чтение через Redis REST стоило 1–1,3 с сетевого round-trip, даже
 *     попадание. 30 секунд локального слоя убирают это для повторных
 *     чтений одного инстанса.
 */

const SEARCH_INDEX_TTL_MS = 5 * 60_000;
const SEARCH_INDEX_KEY = "all";
const LOCAL_LAYER_TTL_MS = 30_000;

export const searchIndexCache = getOrCreateGlobalSingleton(
  "searchIndexCache",
  () => new TtlCache<SearchRecord[]>(SEARCH_INDEX_TTL_MS, "searchIndex", Array.isArray),
);

const localLayer = getOrCreateGlobalSingleton<{ entry: { value: SearchRecord[]; expiresAt: number } | null }>(
  "searchIndexLocalLayer",
  () => ({ entry: null }),
);

async function fetchSearchIndex(): Promise<SearchRecord[]> {
  return buildSearchRecords(await loadSearchSources());
}

export async function getSearchIndex(): Promise<SearchRecord[]> {
  const local = localLayer.entry;
  if (local && local.expiresAt > Date.now()) return local.value;

  const value = await cached(searchIndexCache, SEARCH_INDEX_KEY, fetchSearchIndex);
  localLayer.entry = { value, expiresAt: Date.now() + LOCAL_LAYER_TTL_MS };
  return value;
}

/** Сброс после ЛЮБОЙ записи в содержимое, название которого печатает
 * индекс. Вызывается из админских маршрутов сохранения и удаления. */
export async function invalidateSearchIndex(): Promise<void> {
  localLayer.entry = null;
  await searchIndexCache.del(SEARCH_INDEX_KEY);
}
