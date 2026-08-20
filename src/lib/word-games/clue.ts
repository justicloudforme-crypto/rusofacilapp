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

/** Builds the clue for one FlashcardCard at a given level, or null if no
 * good clue could be built (caller should exclude the word as a
 * candidate rather than ship a broken/spoiling clue). */
export function buildClue(
  level: string,
  card: { translationEs: string; exampleEs: string }
): string | null {
  if (level === "A1" || level === "A2") {
    return card.translationEs;
  }
  return maskedExampleClue(card.translationEs, card.exampleEs);
}
