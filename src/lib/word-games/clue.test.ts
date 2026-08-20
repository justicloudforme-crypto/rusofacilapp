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
    // itself, which never appears in exampleEs at all).
    const card = { translationEs: "reflejo", exampleEs: "Eso fue un reflejo instintivo." };
    const clue = buildClue("B1", card, "рефлекс");
    expect(clue).not.toBeNull();
    expect(clue).not.toContain("reflejo");
    expect(clue).toContain("______");
  });

  it("returns null from B1 up when the word's core can't be located in the example", () => {
    const card = { translationEs: "algo", exampleEs: "Una frase completamente distinta." };
    expect(buildClue("B1", card, "нечто")).toBeNull();
  });
});
