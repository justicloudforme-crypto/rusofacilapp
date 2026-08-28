import type { PublicPuzzle } from "./data";

/**
 * A one-off, hand-picked word search for the `/sopa-de-letras-alfabeto-
 * cirilico` landing page (see PROGRESS.md's 2026-08-28 entry) — not a row
 * in `WordGamePuzzle`, no admin editor, no database write. Its 22 words
 * were chosen to cover as much of the Cyrillic alphabet as possible (32
 * of 33 letters — only ъ, the hard sign, has no natural short/basic word,
 * see the landing page's own text for why that's explained instead of
 * forced into the grid) rather than to fit a difficulty ladder like the
 * real WordGamePuzzle rows do.
 *
 * The grid itself was generated with the SAME algorithm as every real
 * puzzle (`buildWordSearchWithGrowth` in ./word-search.ts, run once
 * against this word list, seed "alphabet-showcase-2026-08-28") and its
 * placements were verified programmatically (every word reads back
 * correctly from `grid` along its `direction` from `row`/`col`) before
 * being frozen here — this is the exact, checked output, not hand-typed
 * coordinates.
 *
 * `id`/`level`/`sequence` are arbitrary labels, not real WordGamePuzzle
 * keys — nothing looks this row up by (type, level, sequence), so there's
 * no risk of colliding with a real puzzle. Passed directly into
 * `<WordGamePlayer puzzle={ALPHABET_SHOWCASE_PUZZLE} .../>`, same
 * component every real puzzle uses; anonymous play works exactly like the
 * free-trial puzzles (WordSearchBoard checks a found word against this
 * object client-side, no server round trip — only the end-of-round
 * POST /api/word-games/complete fires, and it no-ops for a logged-out
 * player, same as for any other puzzle).
 */
export const ALPHABET_SHOWCASE_PUZZLE: PublicPuzzle = {
  id: "alphabet-showcase",
  type: "WORD_SEARCH",
  level: "A1",
  sequence: 0,
  curved: false,
  grid: [
    ["о", "б", "а", "а", "п", "ж", "ё", "т", "б", "и", "р", "г", "ж", "я"],
    ["а", "к", "з", "а", "ф", "ф", "е", "д", "л", "ф", "ъ", "н", "у", "э"],
    ["н", "а", "о", "е", "б", "й", "е", "д", "т", "ъ", "э", "н", "к", "к"],
    ["в", "ш", "г", "п", "а", "о", "н", "о", "ё", "ё", "з", "х", "о", "а"],
    ["ю", "ч", "о", "ч", "е", "х", "р", "м", "л", "е", "м", "т", "о", "т"],
    ["о", "к", "о", "л", "б", "я", "т", "щ", "ы", "б", "о", "ё", "ъ", "н"],
    ["х", "ю", "р", "о", "у", "к", "б", "е", "ъ", "а", "ю", "е", "р", "к"],
    ["е", "о", "л", "о", "р", "о", "р", "т", "т", "н", "п", "х", "у", "а"],
    ["т", "ё", "б", "а", "с", "т", "ц", "и", "й", "а", "ж", "с", "о", "р"],
    ["у", "а", "п", "с", "б", "о", "э", "п", "ц", "н", "р", "о", "т", "а"],
    ["б", "э", "о", "в", "р", "ф", "а", "ж", "у", "и", "ж", "н", "н", "ш"],
    ["и", "л", "щ", "ю", "б", "к", "а", "б", "с", "с", "м", "о", "р", "е"],
    ["ь", "н", "о", "ц", "н", "ю", "и", "м", "ы", "о", "х", "л", "е", "б"],
    ["т", "а", "у", "с", "у", "т", "н", "т", "о", "р", "х", "ё", "щ", "о"],
  ],
  words: [
    { word: "дом", clue: "casa" },
    { word: "кот", clue: "gato" },
    { word: "чай", clue: "té" },
    { word: "рыба", clue: "pez" },
    { word: "жук", clue: "escarabajo" },
    { word: "борщ", clue: "borsch (sopa rusa de remolacha)" },
    { word: "эхо", clue: "eco" },
    { word: "юбка", clue: "falda" },
    { word: "яблоко", clue: "manzana" },
    { word: "хлеб", clue: "pan" },
    { word: "цирк", clue: "circo" },
    { word: "соль", clue: "sal" },
    { word: "ёж", clue: "erizo" },
    { word: "шар", clue: "globo" },
    { word: "ваза", clue: "florero" },
    { word: "гриб", clue: "hongo" },
    { word: "рис", clue: "arroz" },
    { word: "суп", clue: "sopa" },
    { word: "нос", clue: "nariz" },
    { word: "фото", clue: "foto" },
    { word: "банан", clue: "banana" },
    { word: "парк", clue: "parque" },
  ],
};
