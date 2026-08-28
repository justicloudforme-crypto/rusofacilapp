import { describe, expect, it } from "vitest";
import {
  buildVocabularyIndex,
  detectGrammarFeatures,
  matchVocabulary,
  stemRu,
  type VocabularyCard,
} from "./story-insights";

const cards: VocabularyCard[] = [
  { russian: "медведь", transcription: "myedvyét'", translationEs: "oso" },
  { russian: "тарелка", transcription: "taryélka", translationEs: "plato" },
  { russian: "стол", transcription: "stol", translationEs: "mesa" },
  { russian: "пустой", transcription: "pustóy", translationEs: "vacío" },
  { russian: "пока", transcription: "paká", translationEs: "chao" },
  { russian: "добрый день", transcription: "dóbryy dyen'", translationEs: "buenos días" },
];

describe("stemRu", () => {
  it("strips inflectional endings down to a shared stem", () => {
    expect(stemRu("медведя")).toBe(stemRu("медведь"));
    expect(stemRu("тарелки")).toBe(stemRu("тарелка"));
  });

  it("normalises ё so «зелёный» and «зеленый» agree", () => {
    expect(stemRu("зелёный")).toBe(stemRu("зеленый"));
  });

  it("leaves short words alone rather than stemming them to nothing", () => {
    // Stripping "а" here would leave a 2-letter stem that collides with
    // half the dictionary.
    expect(stemRu("она")).toBe("она");
  });
});

describe("matchVocabulary", () => {
  const index = buildVocabularyIndex(cards);

  it("matches inflected forms back to the dictionary form", () => {
    const found = matchVocabulary("Три медведя сидели за столом.", index);
    expect(found.map((f) => f.russian)).toEqual(["медведь", "стол"]);
    expect(found[0].translationEs).toBe("oso");
  });

  it("rejects the пусти/пустой collision the naive stemmer produced", () => {
    // Both stem to "пуст". This exact pair was offered as a real match —
    // "пусти → пустой (vacío)" — on a live story before sharesPrefix.
    expect(matchVocabulary("Пусти меня домой!", index)).toEqual([]);
  });

  it("skips function words, where card senses rarely fit the story", () => {
    // The card for "пока" means "chao"; in a story it is almost always
    // "mientras". Linking it would teach the wrong sense.
    expect(matchVocabulary("Пока мама готовила, дети играли.", index)).toEqual([]);
  });

  it("never matches multi-word cards", () => {
    expect(matchVocabulary("Добрый день!", index)).toEqual([]);
  });

  it("reports each word once and honours the limit", () => {
    const text = "Стол, стол, столе, тарелка, медведь.";
    expect(matchVocabulary(text, index).map((f) => f.russian)).toEqual([
      "стол",
      "тарелка",
      "медведь",
    ]);
    expect(matchVocabulary(text, index, 2)).toHaveLength(2);
  });
});

describe("detectGrammarFeatures", () => {
  it("finds reflexive verbs and quotes the word from the text", () => {
    const found = detectGrammarFeatures("Девочка улыбнулась и вернулась домой.");
    const reflexive = found.find((f) => f.slug === "verbo-reflexivo-sya");
    expect(reflexive?.examples).toEqual(["улыбнулась", "вернулась"]);
  });

  it("matches across Cyrillic word boundaries", () => {
    // The patterns originally used \b, which is ASCII-only in JS and so
    // matched nothing at all in Russian — 0 hits across 130 stories.
    expect(detectGrammarFeatures("Два медведя").some((f) => f.slug === "numeral")).toBe(true);
  });

  it("does not fire on a word that merely contains the ending", () => {
    // "лиса" ends in -са, not the reflexive -ся.
    expect(detectGrammarFeatures("Лиса и заяц")).toEqual([]);
  });

  it("does not label an ordinary adjective a passive participle", () => {
    // "жёлтая" was rendered as a passive participle on a live page before
    // the feature was removed; "синее" as a comparative.
    const found = detectGrammarFeatures("Жёлтая бабочка и синее небо.");
    expect(found.map((f) => f.slug)).not.toContain("participio-pasivo");
    expect(found.map((f) => f.slug)).not.toContain("grado-comparativo");
  });

  it("does not call подушка a diminutive", () => {
    expect(detectGrammarFeatures("Подушка и лягушка.")).toEqual([]);
  });

  it("only treats unambiguous imperative endings as imperatives", () => {
    // "говорите" is equally the 2nd-person plural present.
    expect(detectGrammarFeatures("Вы говорите быстро.").map((f) => f.slug)).not.toContain(
      "modo-imperativo",
    );
    expect(detectGrammarFeatures("Делайте так.").map((f) => f.slug)).toContain("modo-imperativo");
  });

  it("caps examples and keeps them unique", () => {
    const found = detectGrammarFeatures("Один, один, одна, одно, два.", 2);
    const numeral = found.find((f) => f.slug === "numeral");
    expect(numeral?.examples).toHaveLength(2);
    expect(new Set(numeral?.examples).size).toBe(2);
  });

  it("returns nothing for text with no detectable feature", () => {
    expect(detectGrammarFeatures("Мама мыла раму.")).toEqual([]);
  });
});
