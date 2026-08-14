// Idioms/proverbs content — DB-backed (Idiom model), replacing the old
// approach of bundling every category's literal array straight into the
// "use client" IdiomsList component. Same split as src/lib/flashcards —
// this module only holds shared validation/cache logic; actual idiom data
// is fetched from GET /api/idioms.
import { idiomCategories, type Idiom, type IdiomCategory } from "./types";

export type { Idiom, IdiomCategory } from "./types";
export { idiomCategories } from "./types";

/** Prefix for cached /api/idioms list responses (see src/lib/cache.ts). */
export const IDIOM_LIST_CACHE_PREFIX = "idioms:list:";

export function isIdiomCategory(value: string): value is IdiomCategory {
  return (idiomCategories as readonly string[]).includes(value);
}

export interface IdiomInput {
  category: IdiomCategory;
  phrase: string;
  literalTranslation: string;
  spanishEquivalent: string;
  explanation: string;
  contextExampleRu: string;
  contextExampleEs: string;
}

export type IdiomValidationResult =
  | { valid: true; value: IdiomInput }
  | { valid: false; error: string };

/** Shared by the admin save route and the seed script, same pattern as
 * validateFlashcardInput. */
export function validateIdiomInput(body: unknown): IdiomValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "invalid_body" };
  }
  const v = body as Record<string, unknown>;

  const category = typeof v.category === "string" ? v.category : "";
  if (!isIdiomCategory(category)) return { valid: false, error: "invalid_category" };

  const phrase = typeof v.phrase === "string" ? v.phrase.trim() : "";
  if (!phrase) return { valid: false, error: "phrase_required" };

  const spanishEquivalent = typeof v.spanishEquivalent === "string" ? v.spanishEquivalent.trim() : "";
  if (!spanishEquivalent) return { valid: false, error: "spanishEquivalent_required" };

  const literalTranslation = typeof v.literalTranslation === "string" ? v.literalTranslation.trim() : "";
  const explanation = typeof v.explanation === "string" ? v.explanation.trim() : "";
  const contextExampleRu = typeof v.contextExampleRu === "string" ? v.contextExampleRu.trim() : "";
  const contextExampleEs = typeof v.contextExampleEs === "string" ? v.contextExampleEs.trim() : "";

  return {
    valid: true,
    value: {
      category,
      phrase,
      literalTranslation,
      spanishEquivalent,
      explanation,
      contextExampleRu,
      contextExampleEs,
    },
  };
}

export type IdiomRow = Idiom;
