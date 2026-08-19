// Vocabulary flashcard content — DB-backed (FlashcardCard model), replacing
// the old approach of bundling every category's literal array straight into
// the "use client" FlashcardsApp component. This module now only holds
// shared, server-and-client-safe logic (validation, JSON (de)serialization,
// cache key prefix) — the actual card data is fetched from GET
// /api/flashcards, not imported here. Same split as src/lib/glossary.ts.
import {
  flashcardCategories,
  flashcardLevels,
  type Flashcard,
  type FlashcardCategory,
  type FlashcardLevel,
  type WordRelation,
} from "./types";

export type { Flashcard, FlashcardCategory, FlashcardLevel, WordRelation } from "./types";
export { flashcardCategories, flashcardLevels } from "./types";

export function isFlashcardCategory(value: string): value is FlashcardCategory {
  return (flashcardCategories as readonly string[]).includes(value);
}

export function isFlashcardLevel(value: string): value is FlashcardLevel {
  return (flashcardLevels as readonly string[]).includes(value);
}

export interface FlashcardInput {
  category: FlashcardCategory;
  level: FlashcardLevel;
  emoji: string;
  russian: string;
  transcription: string;
  translationEs: string;
  exampleRu: string;
  exampleEs: string;
  synonyms: WordRelation[];
  antonyms: WordRelation[];
}

export type FlashcardValidationResult =
  | { valid: true; value: FlashcardInput }
  | { valid: false; error: string };

function parseWordRelations(value: unknown): WordRelation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      word: typeof x.word === "string" ? x.word.trim() : "",
      translation: typeof x.translation === "string" ? x.translation.trim() : "",
    }))
    .filter((x): x is WordRelation => x.word !== "" && x.translation !== "");
}

/** Shared by the admin save route and the seed script, same pattern as
 * validateStoryInput/validateGlossaryInput. */
export function validateFlashcardInput(body: unknown): FlashcardValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "invalid_body" };
  }
  const v = body as Record<string, unknown>;

  const category = typeof v.category === "string" ? v.category : "";
  if (!isFlashcardCategory(category)) return { valid: false, error: "invalid_category" };

  const level = typeof v.level === "string" ? v.level : "";
  if (!isFlashcardLevel(level)) return { valid: false, error: "invalid_level" };

  const russian = typeof v.russian === "string" ? v.russian.trim() : "";
  if (!russian) return { valid: false, error: "russian_required" };

  const translationEs = typeof v.translationEs === "string" ? v.translationEs.trim() : "";
  if (!translationEs) return { valid: false, error: "translationEs_required" };

  const emoji = typeof v.emoji === "string" ? v.emoji.trim() : "";
  const transcription = typeof v.transcription === "string" ? v.transcription.trim() : "";
  const exampleRu = typeof v.exampleRu === "string" ? v.exampleRu.trim() : "";
  const exampleEs = typeof v.exampleEs === "string" ? v.exampleEs.trim() : "";

  return {
    valid: true,
    value: {
      category,
      level,
      emoji,
      russian,
      transcription,
      translationEs,
      exampleRu,
      exampleEs,
      synonyms: parseWordRelations(v.synonyms),
      antonyms: parseWordRelations(v.antonyms),
    },
  };
}

/** FlashcardCard.synonyms/antonyms are stored as JSON-encoded WordRelation[]
 * columns — turns a raw DB row's field back into an array for API
 * responses. Never throws: a corrupt value just yields no relations rather
 * than a 500. */
export function parseWordRelationsJson(json: string): WordRelation[] {
  try {
    const parsed = JSON.parse(json);
    return parseWordRelations(parsed);
  } catch {
    return [];
  }
}

export function serializeFlashcardData(value: FlashcardInput) {
  return {
    ...value,
    synonyms: JSON.stringify(value.synonyms),
    antonyms: JSON.stringify(value.antonyms),
  };
}

/** Shape returned by GET /api/flashcards — a DB row with its JSON columns
 * parsed back into arrays, matching the shape FlashcardsApp expects. */
export interface FlashcardRow extends Omit<Flashcard, "synonyms" | "antonyms"> {
  synonyms: WordRelation[];
  antonyms: WordRelation[];
}
