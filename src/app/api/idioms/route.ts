import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { IDIOM_LIST_CACHE_PREFIX, isIdiomCategory, isIdiomLevel } from "@/lib/idioms";
import { cacheGet, cacheSet } from "@/lib/cache";
import { hasContentAccess } from "@/lib/entitlement";

// IMPORTANT: only the raw idiom rows go in this cache, never the audio join
// below — same real, confirmed bug and fix as /api/glossary/route.ts (see
// its comment for the full story): prisma/generate-idiom-audio.ts runs as
// a separate OS process with no way to invalidate this in-process Map, so
// caching the audio join meant freshly-narrated idioms kept serving stale
// audio-less responses (SpeakButton falling back to the free browser
// voice) for up to IDIOM_CACHE_TTL_MS after every generation run.
const IDIOM_CACHE_TTL_MS = 5 * 60_000;

// Idioms are part of Vocabulary (IdiomsList is one of VocabularyApp's
// modes) and now require the same active-subscription gate as
// /api/flashcards. No category/level param is passed by IdiomsList today
// (it fetches the whole set once and filters/searches/paginates
// client-side), but both filters are supported for future callers (e.g.
// gating idiom exposure by student level, per the content audit's
// level-tagging gap).
export async function GET(request: NextRequest) {
  if (!(await hasContentAccess())) {
    return NextResponse.json({ error: "subscription_required" }, { status: 403 });
  }

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

  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "idiom", contentId: { in: idioms.map((idiom) => idiom.id) } },
    select: { contentId: true, itemKey: true, audioUrl: true },
  });
  const phraseAudioById = new Map<string, string>();
  const contextAudioById = new Map<string, string>();
  for (const row of audioRows) {
    if (row.itemKey === "phrase") phraseAudioById.set(row.contentId, row.audioUrl);
    else if (row.itemKey === "context") contextAudioById.set(row.contentId, row.audioUrl);
  }
  const withAudio = idioms.map((idiom) => ({
    ...idiom,
    audioUrl: phraseAudioById.get(idiom.id),
    contextExampleAudioUrl: contextAudioById.get(idiom.id),
  }));

  return NextResponse.json({ idioms: withAudio });
}
