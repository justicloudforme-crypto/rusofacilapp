import type { Locale } from "@/i18n/config";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";
import type { WordGameType } from "./types";

/**
 * Which vocabulary category each of the 80 free puzzles is built from.
 *
 * The problem this solves. Measured 29.08.2026: the generator draws every
 * rung's words from a LEVEL-WIDE pool, so all 80 free puzzles mixed 5-14
 * categories each, the largest never covering half the words. There was no
 * theme to name, so their titles could only say type, level, rung and word
 * count — and a Spanish speaker does not search for "sopa de letras nivel
 * A2 nº 7", they search for "sopa de letras de comida en ruso".
 *
 * Why the table is frozen here instead of computed at generation time.
 * A computed assignment would reshuffle every time a card is added to the
 * bank, silently retitling live URLs and making a rerun non-reproducible.
 * These 80 URLs are the indexed ones; their topics are content decisions
 * and belong in the repository, reviewable in a diff.
 *
 * How it was derived (01-02.09.2026, measured against the 4785 published
 * A1-B2 cards). A category is eligible for one rung when BOTH hold:
 *
 *   1. the eligible pool for that rung's own length band — computed with
 *      the generator's own candidateWords + buildClue, not a raw card
 *      count — is at least twice the rung's word count, so the puzzle
 *      selects its words rather than taking every word there is;
 *   2. the real builder produces a full puzzle from that pool.
 *
 * Test 2 is not redundant. Inside one topic the words are far more alike
 * than in a level-wide pool, so a word-search grid can fail to fit its
 * longest words alongside each other and a crossword can fail to find
 * shared letters even when the pool is large enough on paper. Every pair
 * below was built for real before being written down.
 *
 * The binding constraint turned out to be the SHORT rungs, not the big
 * ones: rung 1 wants words of 3-6 letters, and three- to six-letter words
 * are scarce inside a single topic — which is why eligibility is decided
 * per rung and not per level. It is also why CROSSWORD B2 is mostly empty:
 * B2 vocabulary is long and abstract, and its two shortest rungs have zero
 * eligible categories.
 *
 * Assignment is a maximum bipartite matching (rungs x categories, each
 * category used at most once per type+level so a ladder is not ten
 * variations of one topic). Greedy hardest-rung-first was measured too and
 * fills 67 rungs against matching's 69 — it spends a versatile category on
 * a rung that another category could have served.
 *
 * `null` means "no eligible category": that rung keeps the existing
 * mixed-pool generator and its existing title. 69 of 80 rungs are themed,
 * 11 are not, and every one of the 80 URLs stays live and playable either
 * way — see prisma/generate-word-games.ts.
 */
const FREE_RUNG_TOPICS: Record<string, ReadonlyArray<string | null>> = {
  "WORD_SEARCH|A1": ["salud", "ciudad-y-transporte", "familia", "palabras-basicas", "compras", "comida", "clima-y-naturaleza", null, null, null],
  "WORD_SEARCH|A2": ["ropa", "palabras-basicas", "familia", "emociones", "ciencia", "arte-y-ocio", "clima-y-naturaleza", "compras", "comida", "ciudad-y-transporte"],
  "WORD_SEARCH|B1": ["ropa", "familia", "compras", "emociones", "clima-y-naturaleza", "conceptos-abstractos", "comida", "ciudad-y-transporte", "ciencia", "arte-y-ocio"],
  "WORD_SEARCH|B2": ["ciencia", "ropa", "trabajo", "sociedad", "sinonimos-y-antonimos", "arte-y-ocio", "salud", "psicologia", "emociones", "conceptos-abstractos"],
  "CROSSWORD|A1": ["ciencia", "salud", "ciudad-y-transporte", "familia", "palabras-basicas", "compras", "comida", "clima-y-naturaleza", null, null],
  "CROSSWORD|A2": ["ropa", "arte-y-ocio", "ciencia", "palabras-basicas", "compras", "emociones", "clima-y-naturaleza", "familia", "comida", "ciudad-y-transporte"],
  "CROSSWORD|B1": ["palabras-basicas", "salud", "ropa", "ciencia", "clima-y-naturaleza", "ciudad-y-transporte", "arte-y-ocio", "familia", "emociones", "comida"],
  "CROSSWORD|B2": [null, "ropa", null, "sinonimos-y-antonimos", "conceptos-abstractos", "emociones", null, null, null, null],
};

/** How many rungs of each (type, level) ladder the table covers. Kept as a
 * constant so a hand-edit that shortens a row fails a test instead of
 * silently leaving a rung untouched. */
export const FREE_RUNGS_PER_LADDER = 10;

/**
 * The vocabulary-category slug this puzzle is built from, or null if it
 * draws from the level-wide mixed pool.
 *
 * Returns null for every paid puzzle by construction: the table only has
 * rows for A1-B2 and only ten entries each, matching isFreeWordGamePuzzle.
 * The ~5900 paid puzzles are deliberately untouched — they redirect an
 * anonymous visitor to /pricing and are disallowed in robots.txt, so they
 * have no search value to gain and regenerating them would be risk with no
 * upside.
 */
export function topicForPuzzle(type: WordGameType, level: string, sequence: number): string | null {
  const ladder = FREE_RUNG_TOPICS[`${type}|${level}`];
  if (!ladder) return null;
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > ladder.length) return null;
  return ladder[sequence - 1] ?? null;
}

export interface TopicInfo {
  /** URL segment of the vocabulary page: /es/vocabulary/<slug>. */
  slug: string;
  /** Spanish noun phrase as it appears in a title: "comida", "ropa". */
  es: string;
  /** Russian equivalent, for the /ru titles. */
  ru: string;
}

/**
 * Display names per topic.
 *
 * Deliberately NOT derived from VOCABULARY_CATEGORY_PAGES.h1 ("Vocabulario
 * ruso de comida y restaurante") — that is a page heading, and splicing it
 * into "Sopa de letras de …" would produce a title that reads like a
 * machine assembled it. These are the short noun phrases a title needs,
 * written once. The Russian column exists because the /ru locale serves
 * the same puzzles; it is not a translation of the Spanish page, which
 * does not exist in Russian.
 *
 * Only the categories that actually appear in the table above are listed.
 * getTopicInfo returns null for anything else, and the generator then
 * treats the rung as mixed rather than inventing a label.
 */
const TOPIC_LABELS: Record<string, { es: string; ru: string }> = {
  "arte-y-ocio": { es: "arte y ocio", ru: "искусство и досуг" },
  ciencia: { es: "ciencia", ru: "наука" },
  "ciudad-y-transporte": { es: "ciudad y transporte", ru: "город и транспорт" },
  "clima-y-naturaleza": { es: "clima y naturaleza", ru: "погода и природа" },
  comida: { es: "comida", ru: "еда" },
  compras: { es: "compras", ru: "покупки" },
  "conceptos-abstractos": { es: "conceptos abstractos", ru: "абстрактные понятия" },
  emociones: { es: "emociones", ru: "эмоции" },
  familia: { es: "familia", ru: "семья" },
  "palabras-basicas": { es: "palabras básicas", ru: "базовые слова" },
  psicologia: { es: "psicología", ru: "психология" },
  ropa: { es: "ropa", ru: "одежда" },
  salud: { es: "salud", ru: "здоровье" },
  "sinonimos-y-antonimos": { es: "sinónimos y antónimos", ru: "синонимы и антонимы" },
  sociedad: { es: "sociedad", ru: "общество" },
  trabajo: { es: "trabajo", ru: "работа" },
};

export function getTopicInfo(slug: string | null | undefined): TopicInfo | null {
  if (!slug) return null;
  const label = TOPIC_LABELS[slug];
  if (!label) return null;
  return { slug, es: label.es, ru: label.ru };
}

export function topicLabel(info: TopicInfo, lang: Locale): string {
  return lang === "ru" ? info.ru : info.es;
}

/** Every distinct topic slug the table uses — the list the vocabulary
 * pages need in order to link back to their own puzzles. */
export function allTopicSlugs(): string[] {
  const out = new Set<string>();
  for (const ladder of Object.values(FREE_RUNG_TOPICS)) {
    for (const slug of ladder) if (slug) out.add(slug);
  }
  return [...out].sort();
}

/** Every free puzzle built from `slug`, in ladder order — used by the
 * vocabulary page to link to the puzzles made of its own words. */
export function puzzlesForTopic(slug: string): Array<{ type: WordGameType; level: string; sequence: number }> {
  const out: Array<{ type: WordGameType; level: string; sequence: number }> = [];
  for (const [key, ladder] of Object.entries(FREE_RUNG_TOPICS)) {
    const [type, level] = key.split("|") as [WordGameType, string];
    ladder.forEach((s, index) => {
      if (s === slug) out.push({ type, level, sequence: index + 1 });
    });
  }
  return out.sort((a, b) => a.level.localeCompare(b.level) || a.type.localeCompare(b.type) || a.sequence - b.sequence);
}

/**
 * The FlashcardCard.category key behind a topic slug.
 *
 * The two are different vocabularies on purpose: the column stores an
 * internal key ("food", "motionVerbs") and the URL uses the words a
 * Spanish speaker would search for ("comida", "verbos-de-movimiento").
 * VOCABULARY_CATEGORY_PAGES already holds the mapping, so it is looked up
 * there rather than restated here, where the two could drift apart.
 */
export function categoryForTopic(slug: string): string | null {
  return VOCABULARY_CATEGORY_PAGES.find((page) => page.slug === slug)?.category ?? null;
}

/** The vocabulary page a topic points at, if that category still has one.
 * Looked up rather than assumed: the topic table stores a slug, and a slug
 * with no page behind it must not become a link to a 404. */
export function vocabularyPathForTopic(slug: string): string | null {
  return VOCABULARY_CATEGORY_PAGES.some((page) => page.slug === slug) ? `/es/vocabulary/${slug}` : null;
}
