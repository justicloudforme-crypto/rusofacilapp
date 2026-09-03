/**
 * The list of free word-game rungs, as paths, for a server-rendered index.
 *
 * Why this exists. Measured on production 02.09.2026 over all 1906 sitemap
 * URLs plus the 160 free puzzle URLs: 78 of those 160 had ZERO inbound
 * links from any crawlable page. Sitemap membership was fine (160/160),
 * robots.txt allowed all of them (160/160, Allow precedence), and every
 * one of them served a playable board to an anonymous visitor (160/160) —
 * the only red column was discoverability.
 *
 * The cause is structural, not a data gap: the hub at /[lang]/word-games
 * renders its ladder through WordGamesPicker, a "use client" component
 * whose grid follows React state (type + level). The server therefore
 * emits links for exactly ONE (type, level) pair — the initial state,
 * WORD_SEARCH/A1 — so 7 of the 8 free ladders have no hub link at all,
 * for either locale. What coverage the /es free URLs had came from the
 * Spanish-only /es/vocabulary/[categoria] and topic-landing pages, which
 * hardcode the "es" prefix, so /ru had nothing beyond WORD_SEARCH/A1.
 *
 * A sitemap entry is a hint; a link is the edge a crawler actually walks,
 * and Search Console reports "no referring page" for exactly this shape.
 * So the free sample gets a plain server-rendered list of <a>, in both
 * locales, in addition to the picker.
 *
 * The rungs are derived from the same isFreeWordGamePuzzle rule the
 * paywall, robots.ts and sitemap.ts read (never from a second copy of
 * "sequence <= 10, not C1"), and taken from the sequence numbers the bank
 * really holds, so this can never link to a 404 the way a fixed count
 * would if a ladder were ever short or had a gap in it.
 */
import { flashcardLevels, type FlashcardLevel } from "@/lib/flashcards";
import { wordGameTypes, type WordGameType } from "@/lib/word-games/types";
import { isFreeWordGamePuzzle } from "@/lib/word-games/free-tier";

export interface FreeRung {
  type: WordGameType;
  level: FlashcardLevel;
  sequence: number;
  href: string;
}

export interface FreeLadder {
  type: WordGameType;
  level: FlashcardLevel;
  rungs: FreeRung[];
}

/**
 * Every free rung that actually exists, grouped by (type, level).
 *
 * @param lang      locale prefix for the hrefs
 * @param available the sequence numbers the bank really holds for that
 *                  (type, level) pair — a count would have to assume
 *                  1..N, and a gap in the ladder would then be a link to
 *                  a 404 handed to a crawler on purpose (PROGRESS.md 7.79)
 */
export function freeLadders(
  lang: string,
  available: (type: WordGameType, level: FlashcardLevel) => Iterable<number> | undefined,
): FreeLadder[] {
  const ladders: FreeLadder[] = [];
  for (const type of wordGameTypes) {
    for (const level of flashcardLevels) {
      const rungs: FreeRung[] = [];
      for (const sequence of [...(available(type, level) ?? [])].sort((a, b) => a - b)) {
        // The rule, not a restatement of it: C1 is excluded inside
        // isFreeWordGamePuzzle, and this loop must not know that twice.
        if (!isFreeWordGamePuzzle({ type, level, sequence })) continue;
        rungs.push({ type, level, sequence, href: `/${lang}/word-games/${type}/${level}/${sequence}` });
      }
      if (rungs.length > 0) ladders.push({ type, level, rungs });
    }
  }
  return ladders;
}

/** Flat list of the same paths — what an audit or a test compares against. */
export function freeRungPaths(
  lang: string,
  available: (type: WordGameType, level: FlashcardLevel) => Iterable<number> | undefined,
): string[] {
  return freeLadders(lang, available).flatMap((ladder) => ladder.rungs.map((rung) => rung.href));
}
