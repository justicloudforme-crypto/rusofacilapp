/**
 * Derives, from one story's own Russian text, the two things a thin story
 * page can honestly say about itself without retelling it: which words it
 * uses that the course already teaches, and which grammar the reader will
 * actually meet in it.
 *
 * Why this exists: measured on 2026-08-28, a paywalled story page served
 * ~1000 characters of visible text — a title, a one-line description, one
 * paragraph and a "subscribe" card. 650 of the 1868 URLs in the sitemap
 * were that shape. Adding a block ABOUT the story (never a summary of it,
 * which would remove the reason to subscribe) is the same move that took
 * lesson pages from ~918 to ~5818 characters in PR #42.
 *
 * Two hard rules, both enforced here rather than left to callers:
 *
 *  1. The block never contains a sentence from the story. It lists
 *     individual dictionary words and grammar topics, so it can describe
 *     a paywalled story without becoming a substitute for reading it —
 *     and every word it lists is a flashcard that already has its own
 *     public page under /vocabulary, so nothing here is newly disclosed.
 *     A plot summary would remove the reason to subscribe and is exactly
 *     what this must never produce.
 *  2. Nothing is templated. Vocabulary comes from this story's own words;
 *     every grammar feature is shown with example words taken from this
 *     story. A block that read the same on all 650 pages would be worse
 *     than the thin page it replaced.
 */

/** Unicode-aware word boundary. JS `\b` is ASCII-only, so it never fires
 * between Cyrillic letters — written with `\b` first, every pattern below
 * matched exactly zero of 130 stories. */
function ru(body: string): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${body})(?!\\p{L})`, "giu");
}

export interface GrammarFeature {
  /** Glossary slug — the page this links to. */
  slug: string;
  /** Words from this story that show the feature, for display. */
  examples: string[];
}

/**
 * Grammar features detectable from surface morphology WITHOUT producing a
 * claim that is simply wrong. That second half is the hard part, and it is
 * why this list is short.
 *
 * Rejected after seeing them fire on real stories:
 *  - passive participles (-нный/-тый/-мый): "жёлтая" was rendered as a
 *    passive participle on a live page. Russian adjectives share those
 *    endings (длинный, странный, жёлтый) and no suffix rule separates
 *    them, so the whole feature is out.
 *  - diminutives (-ушка/-очка): "подушка" (pillow) and "лягушка" (frog)
 *    are not diminutives of anything.
 *  - a general comparative rule ([а-яё]{4,}ее): neuter adjectives end the
 *    same way (синее, домашнее). Only the ten irregular comparatives,
 *    which are unambiguous, survive.
 *  - the imperative ending -ите: identical to the 2nd-person plural
 *    present (говорите can be either). Only -йте/-ьте survive.
 *
 * Also deliberately absent: past tense and imperfective aspect. They are
 * in essentially every story, so linking them would produce exactly the
 * templated block this file exists to avoid.
 */
const FEATURE_PATTERNS: { slug: string; pattern: string }[] = [
  { slug: "verbo-reflexivo-sya", pattern: "[а-яё]{4,}(?:ся|сь)" },
  {
    slug: "participio-activo",
    pattern: "[а-яё]{3,}(?:ющ|ущ|ащ|ящ|вш)(?:ий|ая|ее|ие|его|ую|им|ым|их|ем|ей)",
  },
  {
    slug: "grado-comparativo",
    pattern: "лучше|хуже|больше|меньше|старше|младше|выше|ниже|дальше|ближе",
  },
  { slug: "modo-imperativo", pattern: "[а-яё]{2,}(?:йте|ьте)" },
  {
    slug: "numeral",
    pattern: "два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|один|одна|одно",
  },
  { slug: "modo-condicional", pattern: "бы" },
  { slug: "gerundio", pattern: "[а-яё]{3,}(?:вши|вшись)" },
];

/** Features present in `text`, each with up to two example words taken
 * from that same text. Order is stable (the order above), so the block
 * doesn't reshuffle between requests. */
export function detectGrammarFeatures(text: string, maxExamples = 2): GrammarFeature[] {
  const features: GrammarFeature[] = [];
  for (const { slug, pattern } of FEATURE_PATTERNS) {
    const seen = new Set<string>();
    for (const match of text.matchAll(ru(pattern))) {
      const word = match[0].toLowerCase();
      if (!seen.has(word)) seen.add(word);
      if (seen.size >= maxExamples) break;
    }
    if (seen.size > 0) features.push({ slug, examples: [...seen] });
  }
  return features;
}

/**
 * Very small suffix stripper — enough to match a story's inflected word
 * ("медведя", "тарелки") against the dictionary form on a flashcard
 * ("медведь", "тарелка"). A real morphological analyser is not worth
 * pulling in for this: the cost of a miss is one missing row in a
 * vocabulary list, and `sharesPrefix` below catches the false matches
 * this crudeness would otherwise produce.
 */
const ENDINGS = [
  "ами", "ями", "ого", "его", "ому", "ему", "ыми", "ими",
  "ах", "ях", "ов", "ев", "ей", "ой", "ый", "ий", "ая", "яя",
  "ое", "ее", "ые", "ие", "ам", "ям", "ом", "ем",
  "у", "ю", "ы", "и", "а", "я", "е", "о", "ь", "й",
];

export function stemRu(word: string): string {
  const normalized = word.toLowerCase().replace(/ё/g, "е");
  for (const ending of ENDINGS) {
    if (normalized.length - ending.length >= 4 && normalized.endsWith(ending)) {
      return normalized.slice(0, normalized.length - ending.length);
    }
  }
  return normalized;
}

/**
 * Guards the stemmer. "пусти" (imperative of пустить) and "пустой" (empty)
 * both stem to "пуст", and the naive matcher happily offered "пусти →
 * пустой (vacío)" on a real story. Requiring the two words to agree on
 * their first five characters — or on the whole shorter word, for short
 * ones like "стол"/"столе" — rejects that pair while keeping
 * "медведя"/"медведь" and "тарелки"/"тарелка".
 */
function sharesPrefix(a: string, b: string): boolean {
  const need = Math.min(5, a.length, b.length);
  return a.slice(0, need) === b.slice(0, need);
}

/**
 * High-frequency function words. They match well and mean nothing as
 * "vocabulary from this story" — and they are where the word-sense
 * mismatches cluster (the card for "пока" says "chao", but in a story it
 * is almost always "mientras").
 */
const STOPWORDS = new Set([
  "она", "они", "оно", "его", "ему", "нее", "нею", "них", "нам", "вам", "тебе", "меня",
  "что", "чтобы", "как", "так", "там", "тут", "уже", "ещё", "еще", "тоже", "также",
  "кто", "куда", "когда", "где", "чем", "этот", "эта", "это", "эти", "тот", "все", "всё",
  "нет", "да", "не", "ни", "или", "но", "и", "а", "же", "бы", "ли", "вот", "пока",
  "очень", "хотя", "потом", "всегда", "никогда", "иногда", "здесь", "сюда", "оттуда",
  "мой", "моя", "мои", "наш", "наша", "ваш", "свой", "своя", "себя", "сам",
  "быть", "был", "была", "было", "были", "есть",
]);

export interface VocabularyMatch {
  /** The word as it appears in the story. */
  surface: string;
  /** Dictionary form, from the flashcard. */
  russian: string;
  transcription: string;
  translationEs: string;
}

export interface VocabularyCard {
  russian: string;
  transcription: string;
  translationEs: string;
}

/** Index of single-word flashcards by stem. Built once per card list by
 * the caller and reused across stories — 4000-odd entries. */
export function buildVocabularyIndex(cards: VocabularyCard[]): Map<string, VocabularyCard> {
  const byStem = new Map<string, VocabularyCard>();
  for (const card of cards) {
    const word = card.russian.trim();
    // Multi-word cards ("добрый день") can't be matched by this
    // single-token stemmer, and half-matching them would be worse.
    if (/\s/.test(word)) continue;
    if (STOPWORDS.has(word.toLowerCase())) continue;
    const key = stemRu(word);
    if (!byStem.has(key)) byStem.set(key, card);
  }
  return byStem;
}

/**
 * Words in `text` that the course already teaches as flashcards, in the
 * order they appear, deduplicated — an ordinary vocabulary list, never a
 * sentence. See the file header for why running this over the whole story
 * (rather than only the free preview) stays on the right side of the
 * paywall.
 */
export function matchVocabulary(
  text: string,
  index: Map<string, VocabularyCard>,
  limit = 12,
): VocabularyMatch[] {
  const matches: VocabularyMatch[] = [];
  const used = new Set<string>();

  for (const raw of text.match(/[А-Яа-яЁё]{3,}/g) ?? []) {
    const surface = raw.toLowerCase();
    if (STOPWORDS.has(surface)) continue;
    const key = stemRu(surface);
    if (key.length < 4 || used.has(key)) continue;

    const card = index.get(key);
    if (!card) continue;
    if (!sharesPrefix(surface, card.russian.toLowerCase().replace(/ё/g, "е"))) continue;

    used.add(key);
    matches.push({
      surface: raw,
      russian: card.russian,
      transcription: card.transcription,
      translationEs: card.translationEs,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}
