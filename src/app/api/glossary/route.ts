import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  GLOSSARY_LIST_CACHE_PREFIX,
  isGlossaryCategory,
  parseExamplesJson,
  parseRelatedLessonSlug,
  parseRelatedLessonsJson,
} from "@/lib/glossary";
import { isLevelSlug } from "@/lib/courses";
import { cacheGet, cacheSet } from "@/lib/cache";

// Glossary content changes rarely (admin edits, or a new seed batch) and is
// read on nearly every lesson page load (GlossaryText's auto-linking) — a
// good first candidate for the cache scaffold in src/lib/cache.ts. Cache is
// explicitly invalidated by the admin save/delete routes, so this TTL only
// matters as a fallback (e.g. a direct DB edit bypassing the admin UI).
const GLOSSARY_CACHE_TTL_MS = 5 * 60_000;

// Public and unauthenticated, like /api/lesson-audio: glossary entries are
// reference content, not user data, and searching them shouldn't require
// an account — a student should be able to look up "aspecto perfectivo"
// before ever logging in.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const lesson = searchParams.get("lesson") ?? "";

  const where: { category?: string; OR?: Record<string, unknown>[]; relatedLessons?: Record<string, unknown> } = {};
  if (category && isGlossaryCategory(category)) {
    where.category = category;
  }
  if (level && isLevelSlug(level)) {
    // relatedLessons is stored as a JSON-encoded string[] (e.g. '["a1-3"]')
    // — matching the quoted level prefix avoids "a1-" false-matching inside
    // an unrelated slug like "a10-2" (not a real level, but keeps the
    // filter precise regardless).
    where.relatedLessons = { contains: `"${level}-` };
  }
  if (lesson && parseRelatedLessonSlug(lesson)) {
    // Exact-entry match ("a1-3", not "a1-30") — the quote characters on
    // both sides of the substring only line up when the JSON array
    // contains that exact string. Used by LessonGlossaryTerms to list
    // "terms in this lesson" before the student starts reading it.
    where.relatedLessons = { contains: `"${lesson}"` };
  }
  if (q) {
    // SQLite's `contains` is case-sensitive (no `mode: "insensitive"`
    // support like Postgres) — acceptable for this foundation stage with a
    // handful of entries; revisit if the glossary grows large enough that
    // exact-case search meaningfully hurts discoverability.
    where.OR = [
      { term: { contains: q } },
      { russianEquivalent: { contains: q } },
      { definition: { contains: q } },
    ];
  }

  const cacheKey = GLOSSARY_LIST_CACHE_PREFIX + searchParams.toString();
  const cached = cacheGet<{ terms: unknown[] }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const terms = await db.glossaryTerm.findMany({
    where,
    orderBy: { term: "asc" },
  });

  const body = {
    terms: terms.map((term) => ({
      ...term,
      relatedLessons: parseRelatedLessonsJson(term.relatedLessons),
      examples: parseExamplesJson(term.examples),
    })),
  };
  cacheSet(cacheKey, body, GLOSSARY_CACHE_TTL_MS);
  return NextResponse.json(body);
}
