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

export interface FreeNeighbours {
  prev: FreeRung | null;
  next: FreeRung | null;
}

/**
 * The free rungs immediately before and after one puzzle, inside its own
 * (type, level) ladder.
 *
 * Why the free ladder and not the whole one. Measured on production
 * 03.09.2026, a free puzzle page was a dead end for a crawler: its only
 * outgoing edges were the hub and (for a themed puzzle) its vocabulary
 * page, so the 160 free URLs formed a star around /word-games with no
 * edges between them. Neighbour links turn that star into a path.
 *
 * Deliberately NOT the adjacent sequence number: rung 10 is the last free
 * one, and linking 10 -> 11 would hand a crawler a 307 into /pricing —
 * exactly the "link to a page the visitor cannot have" that /word-games
 * already produces 186 times through the picker's own grid. Neighbours are
 * chosen from the numbers the bank really holds AND that pass
 * isFreeWordGamePuzzle, which is the same rule the paywall reads.
 *
 * Returns {null, null} for a puzzle that is not itself free: a subscriber
 * reading rung 57 has the picker's full grid one click away, and a crawler
 * never gets there at all.
 */
export function freeNeighbours(
  lang: string,
  type: WordGameType,
  level: FlashcardLevel,
  sequence: number,
  available: (type: WordGameType, level: FlashcardLevel) => Iterable<number> | undefined,
): FreeNeighbours {
  if (!isFreeWordGamePuzzle({ type, level, sequence })) return { prev: null, next: null };
  const ladder = freeLadders(lang, (t, l) => (t === type && l === level ? available(t, l) : undefined))[0];
  if (!ladder) return { prev: null, next: null };
  const index = ladder.rungs.findIndex((rung) => rung.sequence === sequence);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? ladder.rungs[index - 1] : null,
    next: index < ladder.rungs.length - 1 ? ladder.rungs[index + 1] : null,
  };
}
