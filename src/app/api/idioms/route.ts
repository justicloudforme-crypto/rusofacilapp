import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { IDIOM_LIST_CACHE_PREFIX, isIdiomCategory } from "@/lib/idioms";
import { cacheGet, cacheSet } from "@/lib/cache";

const IDIOM_CACHE_TTL_MS = 5 * 60_000;

// Public and unauthenticated, same rationale as /api/flashcards. No
// category param is passed by IdiomsList today (it fetches the whole set
// once and filters/searches/paginates client-side), but the filter is
// still supported for future callers.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";

  const where: { category?: string } = {};
  if (category && isIdiomCategory(category)) {
    where.category = category;
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
