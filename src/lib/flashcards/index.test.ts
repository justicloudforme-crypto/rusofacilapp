import { describe, expect, it } from "vitest";
import { flashcardCategories, flashcardLevels } from "./types";
import { parseWordRelationsJson, serializeFlashcardData, validateFlashcardInput } from "./index";

const validBody = {
  category: flashcardCategories[0],
  level: flashcardLevels[0],
  emoji: "🐶",
  russian: "собака",
  transcription: "sabaka",
  translationEs: "perro",
  exampleRu: "У меня есть собака.",
  exampleEs: "Tengo un perro.",
  synonyms: [{ word: "пёс", translation: "perro" }],
  antonyms: [],
};

describe("validateFlashcardInput", () => {
  it("accepts a well-formed body", () => {
    const result = validateFlashcardInput(validBody);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.russian).toBe("собака");
      expect(result.value.synonyms).toEqual([{ word: "пёс", translation: "perro" }]);
    }
  });

  it("rejects a non-object body", () => {
    expect(validateFlashcardInput(null)).toEqual({ valid: false, error: "invalid_body" });
    expect(validateFlashcardInput("nope")).toEqual({ valid: false, error: "invalid_body" });
  });

  it("rejects an invalid category", () => {
    const result = validateFlashcardInput({ ...validBody, category: "not-a-real-category" });
    expect(result).toEqual({ valid: false, error: "invalid_category" });
  });

  it("rejects an invalid level", () => {
    const result = validateFlashcardInput({ ...validBody, level: "not-a-real-level" });
    expect(result).toEqual({ valid: false, error: "invalid_level" });
  });

  it("rejects a missing/blank russian word", () => {
    expect(validateFlashcardInput({ ...validBody, russian: "" })).toEqual({
      valid: false,
      error: "russian_required",
    });
    expect(validateFlashcardInput({ ...validBody, russian: "   " })).toEqual({
      valid: false,
      error: "russian_required",
    });
  });

  it("rejects a missing translationEs", () => {
    const result = validateFlashcardInput({ ...validBody, translationEs: "" });
    expect(result).toEqual({ valid: false, error: "translationEs_required" });
  });

  it("trims whitespace from string fields", () => {
    const result = validateFlashcardInput({ ...validBody, russian: "  собака  " });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.russian).toBe("собака");
  });

  it("drops synonym/antonym entries missing a word or translation", () => {
    const result = validateFlashcardInput({
      ...validBody,
      synonyms: [{ word: "пёс", translation: "" }, { word: "", translation: "perro" }, "garbage"],
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.synonyms).toEqual([]);
  });
});

describe("parseWordRelationsJson / serializeFlashcardData round trip", () => {
  it("round-trips synonyms/antonyms through JSON encoding", () => {
    const result = validateFlashcardInput(validBody);
    if (!result.valid) throw new Error("expected valid input");

    const serialized = serializeFlashcardData(result.value);
    expect(parseWordRelationsJson(serialized.synonyms)).toEqual(result.value.synonyms);
    expect(parseWordRelationsJson(serialized.antonyms)).toEqual(result.value.antonyms);
  });

  it("returns an empty array for corrupt JSON instead of throwing", () => {
    expect(parseWordRelationsJson("{not valid json")).toEqual([]);
  });
});
