import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFlashcardCategory, isFlashcardLevel, type FlashcardRow } from "@/lib/flashcards";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { canAccessLevel, getEntitlementTier, FREE_TRIAL_LIMITS } from "@/lib/entitlement";
import { escapeRegExp } from "@/lib/regex";

const SEARCH_RESULT_LIMIT = 50;

// NFC-normalize before comparing so accented Spanish text matches regardless
// of whether the DB or the user's keyboard produced a precomposed ("ó") or
// decomposed ("o" + combining acute) codepoint sequence — both look
// identical on screen but fail a naive .includes() against each other.
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFC");
}

// Plain substring .includes() ranks a match buried mid-word (e.g. "mil"
// inside "familia") exactly the same as a real match — this scores matches
// into tiers so an exact/prefix/whole-word hit always outranks a substring
// found by accident inside an unrelated word. 0 means no match.
function fieldScore(haystack: string, needle: string): number {
  const h = normalize(haystack);
  if (!h.includes(needle)) return 0;
  if (h === needle) return 4;
  if (h.startsWith(needle)) return 3;
  if (new RegExp(`\\b${escapeRegExp(needle)}`, "u").test(h)) return 2;
  return 1;
}

function cardScore(card: FlashcardRow, needle: string): number {
  return Math.max(
    fieldScore(card.russian, needle),
    fieldScore(card.translationEs, needle),
    fieldScore(card.transcription, needle)
  );
}

function searchIndex(index: FlashcardRow[], query: string, level: string | null): FlashcardRow[] {
  const needle = normalize(query);
  const scored = index
    .filter((card) => !level || card.level === level)
    .map((card) => ({ card, score: cardScore(card, needle) }))
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.card);
}

// A non-entitled visitor (logged out, or logged in without an active
// subscription) gets a free sample instead of a hard 403 — capped to
// FREE_TRIAL_LIMITS.flashcards cards, but the cap is applied AFTER
// category/level/search filtering, not before.
//
// This used to cap the raw, unfiltered index first and filter afterwards —
// which broke the actual UX entirely: every flashcard mode here
// (FillBlankApp/RecallApp/MatchApp/FlashcardsApp) is category-first
// (CategoryGrid → pick a category → THEN fetch its cards), so a global
// "earliest 10 cards site-wide" sample almost always missed whichever
// category the visitor picked, producing a real "no words in this
// category" bug for any category other than the lucky few landing in that
// fixed slice. Capping per-filtered-request instead means every category
// a free-trial visitor opens shows up to 10 real words from THAT category.
/**
 * Сколько карточек этот ответ НЕ отдал — по уровням и всего (долг 191).
 *
 * Зачем. Внутри приложения гость на уровне C1 (а после клиентской
 * фильтрации — и на B2) видел «Нет карточек для этого фильтра». Это
 * неправда по факту: карточки есть — 988 строк уровня C1 из 5771, —
 * они ЗАКРЫТЫ, а не отсутствуют, и разница эта для человека,
 * поставившего приложение, решающая. Магазины запрещают призыв платить
 * мимо их биллинга, но показать, что материал СУЩЕСТВУЕТ и закрыт, они
 * разрешают.
 *
 * Число берётся из банка, а не вписано литералом: разность между тем, что
 * лежит в базе под этим же фильтром, и тем, что ушло в ответ. Поэтому оно
 * не может разойтись ни с тарифным правилом (`canAccessLevel`), ни с
 * размером бесплатной пробы (`FREE_TRIAL_LIMITS`), ни с содержимым банка —
 * все трое участвуют в одном и том же вычитании.
 *
 * Считается ВСЕГДА, для любой роли: у подписчика разность честно равна
 * нулю, и отдельной ветки «а тут не считаем» здесь нет намеренно —
 * ветка была бы вторым местом, где живёт правило доступа.
 */
function lockedCensus(
  bank: readonly FlashcardRow[],
  shown: readonly FlashcardRow[],
  filter: { category: string | null; level: string | null }
): { lockedTotal: number; lockedByLevel: Record<string, number> } {
  const shownIds = new Set(shown.map((card) => card.id));
  const lockedByLevel: Record<string, number> = {};
  let lockedTotal = 0;
  for (const card of bank) {
    if (filter.category && card.category !== filter.category) continue;
    if (filter.level && card.level !== filter.level) continue;
    if (shownIds.has(card.id)) continue;
    lockedByLevel[card.level] = (lockedByLevel[card.level] ?? 0) + 1;
    lockedTotal += 1;
  }
  return { lockedTotal, lockedByLevel };
}

export async function GET(request: NextRequest) {
  const tier = await getEntitlementTier();
  const entitled = tier !== "free";

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const search = (searchParams.get("search") ?? "").trim();

  // C1 is Premium-exclusive (see entitlement.ts canAccessLevel) — filtered
  // out of the index up front so it's excluded from every downstream path
  // (search, category browse, and the free-trial sample alike) rather than
  // needing a separate check in each branch.
  // Весь банк, БЕЗ тарифного фильтра — он нужен переписи закрытого ниже
  // (`lockedCensus`). Читается тот же кеш, что и раньше, второго запроса к
  // базе здесь нет: `getFlashcardIndex()` отдаёт один и тот же массив.
  const bank = await getFlashcardIndex();
  const index = bank.filter((card) => canAccessLevel(tier, card.level));
  const levelFilter = level && isFlashcardLevel(level) ? level : null;

  if (search) {
    const results = searchIndex(index, search, levelFilter);
    const cards = entitled ? results : results.slice(0, FREE_TRIAL_LIMITS.flashcards);
    // Перепись закрытого считается по ТОМУ ЖЕ поиску, но по банку целиком:
    // иначе в «закрытые» попали бы все карточки уровня, а не те, что этому
    // запросу подходят.
    return NextResponse.json({
      cards,
      limited: !entitled,
      ...lockedCensus(searchIndex(bank, search, levelFilter), cards, { category: null, level: null }),
    });
  }

  const categoryFilter = category && isFlashcardCategory(category) ? category : null;
  const filtered = index.filter(
    (card) => (!categoryFilter || card.category === categoryFilter) && (!levelFilter || card.level === levelFilter)
  );
  const cards = entitled ? filtered : filtered.slice(0, FREE_TRIAL_LIMITS.flashcards);

  return NextResponse.json({
    cards,
    limited: !entitled,
    ...lockedCensus(bank, cards, { category: categoryFilter, level: levelFilter }),
  });
}
