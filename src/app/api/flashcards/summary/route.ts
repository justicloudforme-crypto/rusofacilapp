import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isFlashcardLevel } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { canAccessLevel, getEntitlementTier } from "@/lib/entitlement";

// Powers the category grid + "Continue" strip on /vocabulary: total card
// count per category (public) plus, per visitor, how many of those cards
// they already know and which categories they were most recently active
// in — so each tile can show its own progress without the client fetching
// every category's full card list up front.
//
// POST, not GET: a guest's "known" progress lives only in localStorage
// (src/lib/flashcard-progress.ts) — the server has no way to see it for an
// unauthenticated visitor, which used to mean every progress bar sat at 0%
// forever for anyone not logged in. The client now sends its local
// {cardId: {known, updatedAt}} map (getProgressEntries()) as the request
// body; the server treats it as untrusted input (see validation below) and
// only ever uses it to FILL IN cards it has no server record for — a
// logged-in user's real `flashcardProgress` rows always win over whatever
// the client claims for the same card, so a forged/stale payload can never
// hide or "zero out" real progress. This endpoint never writes to the
// database either way (read-only), so the actual stored progress can't be
// corrupted by it regardless.

const MAX_ENTRY_ID_LENGTH = 64;
// A generous but real ceiling: nobody can legitimately have more "known"
// entries than there are cards in the whole bank (~5.7k today, ~350KB of
// JSON in the worst case with the current short slug-style ids) — anything
// past that is either a stale client re-sending duplicate keys or a
// forged payload, both safe to reject outright rather than trim silently.
// Re-checked against the real per-entry byte cost before picking this
// design over a "send an aggregate instead" fallback — the real worst case
// fits comfortably under ordinary request-body limits.
const MAX_BODY_CHARS = 1_000_000;

interface CategoryStat {
  total: number;
  known: number;
}

interface ProgressEntry {
  known: boolean;
  updatedAt: number;
}

// `maxEntries` is the size of the WHOLE bank, not of `validCardIds`.
// The two stopped being the same number when this endpoint began answering
// per tier: `validCardIds` is what this visitor can open (no C1 unless
// Premium), while a real device can legitimately hold "known" entries for
// cards it can no longer open — a lapsed Premium period leaves exactly
// that behind. Sizing the ceiling by the accessible set would 400 those
// visitors outright and blank every progress bar on the page.
function parseEntries(
  raw: unknown,
  validCardIds: Set<string>,
  maxEntries: number,
): Map<string, ProgressEntry> {
  const out = new Map<string, ProgressEntry>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;

  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length > maxEntries) return out; // caller rejects the whole request in this case

  for (const cardId of keys) {
    if (cardId.length > MAX_ENTRY_ID_LENGTH || !validCardIds.has(cardId)) continue;
    const value = (raw as Record<string, unknown>)[cardId];
    if (
      value &&
      typeof value === "object" &&
      typeof (value as ProgressEntry).known === "boolean" &&
      typeof (value as ProgressEntry).updatedAt === "number" &&
      Number.isFinite((value as ProgressEntry).updatedAt) &&
      (value as ProgressEntry).updatedAt >= 0
    ) {
      const entry = value as ProgressEntry;
      out.set(cardId, { known: entry.known, updatedAt: entry.updatedAt });
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const levelValue = (body as { level?: unknown } | null)?.level;
  const level = typeof levelValue === "string" && isFlashcardLevel(levelValue) ? levelValue : null;

  // Everything below counts ONE set: the cards this visitor's tier can
  // actually reach. `GET /api/flashcards` has always filtered its answer
  // through canAccessLevel, so a non-premium learner is handed a bank
  // without C1 — but this endpoint used to answer with the whole bank's
  // size, and the result panel printed it ("6 из 5683") as if all 5683
  // were reachable. 896 of them were not, at any price short of Premium.
  //
  // The fix is not a smaller number, it is a HONEST pair: how many are
  // available now, and how many are behind Premium. The second number is
  // what makes the first one truthful instead of merely smaller — a
  // learner who sees "4787 available" and nothing else has been told the
  // bank is 4787 cards, which is its own lie.
  const wholeIndex = await getFlashcardIndex();
  const tier = await getEntitlementTier();
  const index = wholeIndex.filter((c) => canAccessLevel(tier, c.level));
  const premiumOnlyWords = wholeIndex.length - index.length;
  const cardById = new Map(index.map((c) => [c.id, c]));
  const validCardIds = new Set(cardById.keys());

  const entriesRaw = (body as { entries?: unknown } | null)?.entries;
  if (entriesRaw && typeof entriesRaw === "object" && !Array.isArray(entriesRaw)) {
    if (Object.keys(entriesRaw as object).length > wholeIndex.length) {
      return NextResponse.json({ error: "too_many_entries" }, { status: 400 });
    }
  }
  const clientEntries = parseEntries(entriesRaw, validCardIds, wholeIndex.length);

  const user = await getCurrentUser();

  // Server rows first (authoritative). Fetches every row regardless of
  // `known` — a "Repetir" tap is still real activity worth surfacing in
  // "Continue", even though it doesn't count toward the known total below.
  const serverAnyUpdatedAt = new Map<string, number>();
  const serverKnownUpdatedAt = new Map<string, number>();
  if (user) {
    const rows = await db.flashcardProgress.findMany({
      where: { userId: user.id },
      select: { cardId: true, known: true, updatedAt: true },
    });
    for (const row of rows) {
      serverAnyUpdatedAt.set(row.cardId, row.updatedAt.getTime());
      if (row.known) serverKnownUpdatedAt.set(row.cardId, row.updatedAt.getTime());
    }
  }

  // The client map only fills in cards the server has never recorded at
  // all — never overrides a card the server already has an opinion on.
  const resolvedKnownIds = new Set<string>(serverKnownUpdatedAt.keys());
  for (const [cardId, entry] of clientEntries) {
    if (entry.known && !serverKnownUpdatedAt.has(cardId)) resolvedKnownIds.add(cardId);
  }

  const categories: Record<string, CategoryStat> = {};
  for (const card of index) {
    if (level && card.level !== level) continue;
    (categories[card.category] ??= { total: 0, known: 0 }).total += 1;
  }
  for (const cardId of resolvedKnownIds) {
    const card = cardById.get(cardId);
    if (!card) continue;
    if (level && card.level !== level) continue;
    if (categories[card.category]) categories[card.category].known += 1;
  }

  // "Continue" candidates: same trust order (server updatedAt wins per
  // card, client fills in cards the server has no timestamp for at all),
  // then the most recently touched categories win. Uses serverAnyUpdatedAt
  // (not just the known:true subset) since "was this card touched at all"
  // is what "recently active category" means, not "was it marked known".
  const lastActivityByCardId = new Map<string, number>(serverAnyUpdatedAt);
  for (const [cardId, entry] of clientEntries) {
    if (!lastActivityByCardId.has(cardId)) lastActivityByCardId.set(cardId, entry.updatedAt);
  }
  const lastActivityByCategory = new Map<string, number>();
  for (const [cardId, updatedAt] of lastActivityByCardId) {
    const card = cardById.get(cardId);
    if (!card) continue;
    const prev = lastActivityByCategory.get(card.category);
    if (!prev || updatedAt > prev) lastActivityByCategory.set(card.category, updatedAt);
  }
  const recent = [...lastActivityByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, lastActivityAt]) => ({
      category,
      total: categories[category]?.total ?? 0,
      known: categories[category]?.known ?? 0,
      lastActivityAt,
    }));

  // Level-independent, but NOT tier-independent: the numerator has to be
  // counted over exactly the set the denominator counts, or the fraction
  // stops meaning anything. Two ways it could drift, both closed here by
  // intersecting with the accessible index:
  //   - a `flashcardProgress` row for a card that no longer exists at all
  //     (deleted card, id changed) — those were already being counted;
  //   - a row for a C1 card, left behind by a Premium period that has
  //     since lapsed — real, and it would show a learner "12 of 4787"
  //     where some of the 12 are cards they can no longer open.
  // `resolvedKnownIds` is still built from every source first (server rows
  // win over client entries) and narrowed only at the end, so the trust
  // order above is untouched.
  const totalKnown = [...resolvedKnownIds].filter((id) => validCardIds.has(id)).length;
  const hasAnyProgress = lastActivityByCardId.size > 0;

  return NextResponse.json({
    categories,
    recent,
    totalKnown,
    // Cards this visitor can open right now, at their current tier.
    availableWords: index.length,
    // Cards that exist but need the Premium plan — 0 for a premium/staff
    // visitor, which is what tells the UI to drop the second half of the
    // sentence rather than print "and 0 more in Premium".
    premiumOnlyWords,
    hasAnyProgress,
  });
}
