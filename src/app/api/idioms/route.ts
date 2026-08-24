import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { IDIOM_LIST_CACHE_PREFIX, idiomCategories, isIdiomCategory, isIdiomLevel } from "@/lib/idioms";
import { cacheGet, cacheSet } from "@/lib/cache";
import { isEntitled, FREE_TRIAL_LIMITS } from "@/lib/entitlement";

// IMPORTANT: only the raw idiom rows go in this cache, never the audio join
// below — same real, confirmed bug and fix as /api/glossary/route.ts (see
// its comment for the full story): prisma/generate-idiom-audio.ts runs as
// a separate OS process with no way to invalidate this in-process Map, so
// caching the audio join meant freshly-narrated idioms kept serving stale
// audio-less responses (SpeakButton falling back to the free browser
// voice) for up to IDIOM_CACHE_TTL_MS after every generation run.
const IDIOM_CACHE_TTL_MS = 5 * 60_000;

// Free-trial sample for the common case where IdiomsList fetches everything
// unfiltered and splits by category client-side (see the GET comment
// below). A plain `.slice(0, limit)` by createdAt order previously handed
// back e.g. 5 idioms that were ALL "daily" (the first-inserted category),
// so every other tab (Refranes/Literarios) showed "no idioms" for any
// free-trial visitor — the exact same bug shape as GET /api/flashcards had.
// Round-robins across categories (one from each, then a second from each,
// ...) so every category with any idioms at all gets at least one.
function buildFreeIdiomSample<T extends { category: string }>(idioms: T[], limit: number): T[] {
  const byCategory = new Map<string, T[]>();
  for (const idiom of idioms) {
    const list = byCategory.get(idiom.category);
    if (list) list.push(idiom);
    else byCategory.set(idiom.category, [idiom]);
  }

  const sample: T[] = [];
  for (let round = 0; sample.length < limit; round++) {
    let addedAny = false;
    for (const category of idiomCategories) {
      const list = byCategory.get(category);
      const next = list?.[round];
      if (next) {
        sample.push(next);
        addedAny = true;
        if (sample.length >= limit) break;
      }
    }
    if (!addedAny) break;
  }
  return sample;
}

// Idioms are part of Vocabulary (IdiomsList is one of VocabularyApp's
// modes) and now require the same active-subscription gate as
// /api/flashcards. No category/level param is passed by IdiomsList today
// (it fetches the whole set once and filters/searches/paginates
// client-side), but both filters are supported for future callers (e.g.
// gating idiom exposure by student level, per the content audit's
// level-tagging gap).
export async function GET(request: NextRequest) {
  const entitled = await isEntitled();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";

  const where: { category?: string; level?: string } = {};
  if (category && isIdiomCategory(category)) {
    where.category = category;
  }
  if (level && isIdiomLevel(level)) {
    where.level = level;
  }

  const cacheKey = IDIOM_LIST_CACHE_PREFIX + searchParams.toString();
  let idioms = cacheGet<Awaited<ReturnType<typeof db.idiom.findMany>>>(cacheKey);
  if (!idioms) {
    idioms = await db.idiom.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
    cacheSet(cacheKey, idioms, IDIOM_CACHE_TTL_MS);
  }

  // Non-entitled visitors get a free sample instead of a hard 403. If the
  // caller already filtered to one category (where.category set), a plain
  // slice is correct — every row is already that one category. Otherwise
  // (IdiomsList's default fetch-everything-then-filter-client-side call),
  // spread the sample across categories so every tab has something to show.
  const visibleIdioms = entitled
    ? idioms
    : where.category
      ? idioms.slice(0, FREE_TRIAL_LIMITS.idioms)
      : buildFreeIdiomSample(idioms, FREE_TRIAL_LIMITS.idioms);

  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "idiom", contentId: { in: visibleIdioms.map((idiom) => idiom.id) } },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const phraseAudioById = new Map<string, string>();
  const contextAudioById = new Map<string, string>();
  for (const row of audioRows) {
    if (row.itemKey === "phrase") phraseAudioById.set(row.contentId, row.audioUrl);
    else if (row.itemKey === "context") contextAudioById.set(row.contentId, row.audioUrl);
  }
  const withAudio = visibleIdioms.map((idiom) => ({
    ...idiom,
    audioUrl: phraseAudioById.get(idiom.id),
    contextExampleAudioUrl: contextAudioById.get(idiom.id),
  }));

  return NextResponse.json({ idioms: withAudio, limited: !entitled });
}
