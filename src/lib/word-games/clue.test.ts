import { describe, expect, it } from "vitest";
import { buildClue } from "./clue";

describe("buildClue", () => {
  it("returns the plain translation at A1/A2", () => {
    const card = { translationEs: "casa", exampleEs: "Это мой дом." };
    expect(buildClue("A1", card, "дом")).toBe("casa");
    expect(buildClue("A2", card, "дом")).toBe("casa");
  });

  it("rejects an A1/A2 clue that spells out the Cyrillic word itself", () => {
    // Real content case found during a diversity/quality audit: a
    // parenthetical usage note for an impersonal-construction verb
    // embeds the exact answer.
    const card = {
      translationEs: "gustar (construcción impersonal: мне нравится = me gusta)",
      exampleEs: "Мне нравится музыка.",
    };
    expect(buildClue("A1", card, "нравится")).toBeNull();
  });

  it("does not false-positive when the word is only a substring of a longer Cyrillic token", () => {
    // "дом" must not match inside an unrelated longer word like "домашний"
    // appearing in a translation note.
    const card = { translationEs: "casa (ver también домашний = doméstico)", exampleEs: "Это мой дом." };
    expect(buildClue("A1", card, "дом")).toBe("casa (ver también домашний = doméstico)");
  });

  it("masks the word out of the example sentence from B1 up", () => {
    // exampleEs is the SPANISH example sentence (the word being masked is
    // its Spanish form, derived from translationEs — not the Russian word
    // itself, which never appears in exampleEs at all). "закат"/"atardecer"
    // isn't a cognate, so this exercises plain masking without also
    // tripping the cognate exclusion covered separately below.
    const card = { translationEs: "atardecer", exampleEs: "El atardecer fue precioso hoy." };
    const clue = buildClue("B1", card, "закат");
    expect(clue).not.toBeNull();
    expect(clue).not.toContain("atardecer");
    expect(clue).toContain("______");
  });

  it("returns null from B1 up when the word's core can't be located in the example", () => {
    const card = { translationEs: "algo", exampleEs: "Una frase completamente distinta." };
    expect(buildClue("B1", card, "нечто")).toBeNull();
  });

  it("excludes a cognate/loanword from crossword clues entirely, at any level", () => {
    // Real content-audit finding: masking a cognate doesn't reliably hide
    // it either — a common short sentence often makes the blank obvious
    // from context alone ("Fuimos a cantar ______ después de la cena." is
    // clearly "karaoke" regardless of masking). Word-search still uses
    // these words fine (see prisma/generate-word-games.ts's wordSearchClue,
    // which never calls buildClue) since the letters are already visible
    // there — only crossword needs the word excluded.
    const cognateCard = { translationEs: "karaoke", exampleEs: "Fuimos a cantar karaoke después de la cena." };
    expect(buildClue("A1", cognateCard, "караоке")).toBeNull();
    expect(buildClue("B1", cognateCard, "караоке")).toBeNull();

    // "рефлекс"/"reflejo" is the same real case that originally motivated
    // this — a clear phonetic cognate, previously masked (and therefore
    // still guessable from context), now excluded outright.
    const reflexCard = { translationEs: "reflejo", exampleEs: "Eso fue un reflejo instintivo." };
    expect(buildClue("B1", reflexCard, "рефлекс")).toBeNull();
  });
});
