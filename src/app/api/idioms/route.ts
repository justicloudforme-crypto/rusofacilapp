import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { IDIOM_LIST_CACHE_PREFIX, isIdiomCategory, isIdiomLevel } from "@/lib/idioms";
import { cacheGet, cacheSet } from "@/lib/cache";

const IDIOM_CACHE_TTL_MS = 5 * 60_000;

// Public and unauthenticated, same rationale as /api/flashcards. No
// category/level param is passed by IdiomsList today (it fetches the whole
// set once and filters/searches/paginates client-side), but both filters
// are supported for future callers (e.g. gating idiom exposure by student
// level, per the content audit's level-tagging gap).
export async function GET(request: NextRequest) {
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
  const cached = cacheGet<{ idioms: unknown[] }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const idioms = await db.idiom.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const body = { idioms };
  cacheSet(cacheKey, body, IDIOM_CACHE_TTL_MS);
  return NextResponse.json(body);
}
