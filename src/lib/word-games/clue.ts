// Clue strategy differs by level: A1/A2 words are meant to be recognized
// by direct translation, so a plain translationEs clue is the right test.
// From B1 up, many words are Spanish cognates (томография -> "tomografía")
// where a direct translation is barely a clue at all — it hands over the
// answer instead of testing comprehension. From B1 the clue becomes the
// word's own exampleEs sentence with the word blanked out, so solving it
// requires reading the sentence, not just recognizing a shared root.
//
// Built once, offline, at generation time — see prisma/generate-word-games.ts.
// No LLM call, no schema change: exampleEs already exists on every card.

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// translationEs sometimes lists several synonyms ("coraje, arrojo,
// desparpajo") and exampleEs may use any one of them, not necessarily the
// first — so this returns every alternative as a candidate core word, in
// listed order, and the caller tries each until one actually appears in
// the sentence.
function extractCoreWords(translationEs: string): string[] {
  const withoutParens = translationEs.replace(/\(.*?\)/g, "");
  return withoutParens
    .split(/[,/;]/)
    .map((alt) => alt.trim().replace(/^(el|la|los|las|un|una)\s+/i, "").trim())
    .filter(Boolean)
    .map((alt) => {
      const tokens = alt.split(/\s+/);
      const last = tokens[tokens.length - 1];
      return last.length > 3 ? last : alt;
    });
}

// Approximate Cyrillic->Latin transliteration — good enough to compare
// against a Spanish clue for phonetic similarity, not meant to be a
// correct romanization standard.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(word: string): string {
  return [...word.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// A first version compared only a fixed-length leading prefix of the
// transliterated word (mirroring maskedExampleClue's stem trick) — real
// testing against known giveaways found it missed most of them
// ("публикация"/"publicación", "навигатор"/"navegación",
// "майонез"/"mayonesa") because normal transliteration variance (й as
// "i" vs Spanish "y", ц as "ts" vs "c", etc.) shows up scattered through
// the word, not just at the end — a rigid prefix match is too brittle for
// that. Normalized edit distance over the whole word tolerates scattered
// single-character differences far better while still requiring the
// words be substantially similar overall (short unrelated words can't
// accidentally clear the bar just by chance).
const COGNATE_DISTANCE_RATIO = 0.45;

/** True if `spanishCandidate` is a recognizable cognate/loanword of the
 * transliterated Russian `word` — a real content-audit finding: A1/A2's
 * direct-translation clue trivially gives away a cognate/loanword
 * ("караоке" -> clue "karaoke", "майонез" -> clue "mayonesa"). */
function isCognateGiveaway(word: string, spanishCandidate: string): boolean {
  const translit = transliterate(word);
  const spanish = stripAccents(spanishCandidate.toLowerCase());
  const maxLen = Math.max(translit.length, spanish.length);
  if (maxLen < 4) return false;
  return levenshtein(translit, spanish) / maxLen <= COGNATE_DISTANCE_RATIO;
}

const BLANK = "______";

/** Returns exampleEs with the word masked out, or null if the word's core
 * couldn't be located in the sentence (different grammatical form, etc.)
 * — callers should treat null as "skip this word for this clue style",
 * not fall back to a raw translation silently. */
function maskedExampleClue(translationEs: string, exampleEs: string): string | null {
  const normalizedExample = stripAccents(exampleEs.toLowerCase());

  for (const core of extractCoreWords(translationEs)) {
    // Match on a stem (drop the last couple characters) so gender/number
    // endings that differ between translationEs and the inflected form
    // actually used in exampleEs ("reflejo" vs "refleja") still match —
    // verified empirically at ~95% hit rate on real B2/C1 card data.
    const stemLength = Math.max(4, core.length - 2);
    const stem = stripAccents(core.toLowerCase()).slice(0, stemLength);
    if (stem.length < 3) continue;

    const match = normalizedExample.match(new RegExp(escapeRegExp(stem) + "\\w*", "i"));
    if (!match || match.index === undefined) continue;

    // Re-locate the same span in the ORIGINAL (accented) string by
    // matching length at the same normalized offset — stripAccents never
    // changes string length, so offsets line up directly.
    const start = match.index;
    const end = start + match[0].length;
    return exampleEs.slice(0, start) + BLANK + exampleEs.slice(end);
  }

  return null;
}

/** True if `clue` spells out `word` (the actual Cyrillic answer) as a
 * standalone token, not just a substring of some unrelated longer word —
 * a real bug found during a content audit: a couple of FlashcardCards for
 * grammatically irregular words ("нравится", "больно") have a
 * `translationEs` that includes a parenthetical usage note spelling out
 * the Russian word itself (e.g. "gustar (construcción impersonal: мне
 * нравится = me gusta)") — genuinely useful as a vocabulary aid where
 * translationEs is shown deliberately (word search always shows it), but
 * it hands a crossword player the exact answer outright. */
function clueLeaksWord(clue: string, word: string): boolean {
  const pattern = new RegExp(`(^|[^а-яё])${escapeRegExp(word)}([^а-яё]|$)`, "i");
  return pattern.test(clue);
}

/** Builds the CROSSWORD clue for one FlashcardCard at a given level, or
 * null if no good clue could be built (caller should exclude the word as
 * a candidate rather than ship a broken/spoiling clue). Crossword hides
 * the word's letters, so a clue that gives the answer away defeats the
 * puzzle; word-search's own clue function deliberately doesn't call this
 * (see prisma/generate-word-games.ts's wordSearchClue) since the letters
 * are already visible there and a direct/cognate translation is just a
 * normal vocabulary aid, not a spoiler.
 *
 * Cognates (isCognateGiveaway) are excluded outright rather than
 * downgraded to a masked-example clue — a first version tried the masked
 * fallback, but a real audit (check-wordgames-clues.ts) found ~330 cases
 * where the surrounding sentence context alone still made the blank
 * trivially inferable ("Fuimos a cantar ______ después de la cena." is
 * obviously "karaoke" regardless of masking). Masking hides the literal
 * string, not the fact that a common short sentence has only one sensible
 * word to fill it — for a cognate, that's not a fixable clue, it's not a
 * good crossword word at all; word-search still uses it fine. */
export function buildClue(
  level: string,
  card: { translationEs: string; exampleEs: string },
  word: string
): string | null {
  const isCognate = extractCoreWords(card.translationEs).some((alt) => isCognateGiveaway(word, alt));
  if (isCognate) return null;

  if (level === "A1" || level === "A2") {
    return clueLeaksWord(card.translationEs, word) ? null : card.translationEs;
  }
  return maskedExampleClue(card.translationEs, card.exampleEs);
}
