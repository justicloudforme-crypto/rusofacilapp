import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { IDIOM_LIST_CACHE_PREFIX, isIdiomCategory, isIdiomLevel } from "@/lib/idioms";
import { buildFreeIdiomSample, capLiteraryIdioms } from "@/lib/idioms/free-sample";
import { cacheGet, cacheSet } from "@/lib/cache";
import { canAccessLevel, getEntitlementTier, getLiteraryIdiomLimit, FREE_TRIAL_LIMITS } from "@/lib/entitlement";

// IMPORTANT: only the raw idiom rows go in this cache, never the audio join
// below — same real, confirmed bug and fix as /api/glossary/route.ts (see
// its comment for the full story): prisma/generate-idiom-audio.ts runs as
// a separate OS process with no way to invalidate this in-process Map, so
// caching the audio join meant freshly-narrated idioms kept serving stale
// audio-less responses (SpeakButton falling back to the free browser
// voice) for up to IDIOM_CACHE_TTL_MS after every generation run.
const IDIOM_CACHE_TTL_MS = 5 * 60_000;

// Бесплатный образец (`buildFreeIdiomSample`) и потолок `literary`
// (`capLiteraryIdioms`) с 7.294 живут в src/lib/idioms/free-sample.ts: их же
// спрашивает индекс поиска, чтобы не ставить 🔒 на фразы, которые аноним
// откроет (долг 104). Поведение маршрута не менялось ни на строку.

// Idioms are part of Vocabulary (IdiomsList is one of VocabularyApp's
// modes) and now require the same active-subscription gate as
// /api/flashcards. No category/level param is passed by IdiomsList today
// (it fetches the whole set once and filters/searches/paginates
// client-side), but both filters are supported for future callers (e.g.
// gating idiom exposure by student level, per the content audit's
// level-tagging gap).
export async function GET(request: NextRequest) {
  const tier = await getEntitlementTier();
  const entitled = tier !== "free";

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

  // C1 idioms are Premium-exclusive (see entitlement.ts canAccessLevel),
  // filtered out up front so it applies uniformly to the entitled, free-
  // sample, and category-sliced paths below.
  const accessibleIdioms = idioms.filter((idiom) => canAccessLevel(tier, idiom.level));

  // Non-entitled visitors get a free sample instead of a hard 403. If the
  // caller already filtered to one category (where.category set), a plain
  // slice is correct — every row is already that one category. Otherwise
  // (IdiomsList's default fetch-everything-then-filter-client-side call),
  // spread the sample across categories so every tab has something to show.
  const sampledIdioms = entitled
    ? accessibleIdioms
    : where.category
      ? accessibleIdioms.slice(0, FREE_TRIAL_LIMITS.idioms)
      : buildFreeIdiomSample(accessibleIdioms, FREE_TRIAL_LIMITS.idioms);

  const literaryLimit = getLiteraryIdiomLimit(tier);
  const visibleIdioms = capLiteraryIdioms(sampledIdioms, literaryLimit);
  // Whether this response actually hid any literary idioms behind the cap
  // — used by IdiomsList to show an upgrade prompt on the literary tab
  // specifically, distinct from (and possibly true even when) `limited`
  // is false, since a "standard" subscriber is otherwise fully entitled.
  const literaryLocked =
    literaryLimit !== null && sampledIdioms.some((idiom) => idiom.category === "literary" && !visibleIdioms.includes(idiom))
      ? tier
      : null;

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

  // Перепись закрытого (долг 191): сколько строк под этим же фильтром
  // лежит в базе и НЕ ушло в ответ. Число — разность, а не литерал, и
  // считается для любой роли: у подписчика оно честно равно нулю.
  const shownIds = new Set(visibleIdioms.map((idiom) => idiom.id));
  const lockedByLevel: Record<string, number> = {};
  let lockedTotal = 0;
  for (const idiom of idioms) {
    if (shownIds.has(idiom.id)) continue;
    lockedByLevel[idiom.level] = (lockedByLevel[idiom.level] ?? 0) + 1;
    lockedTotal += 1;
  }

  return NextResponse.json({
    idioms: withAudio,
    limited: !entitled,
    literaryLocked,
    lockedTotal,
    lockedByLevel,
  });
}
