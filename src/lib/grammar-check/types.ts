export type GrammarCheckStatus = "PENDING" | "CLEAN" | "FLAGGED";

export const grammarCheckStatuses: GrammarCheckStatus[] = ["PENDING", "CLEAN", "FLAGGED"];

export function isGrammarCheckStatus(value: string): value is GrammarCheckStatus {
  return (grammarCheckStatuses as readonly string[]).includes(value);
}

/** One "field is grammatically off" finding from prisma/check-grammar.ts.
 * `excerpt` is the offending fragment (not the whole field) so a reviewer
 * can spot it without re-reading the full text. */
export interface GrammarFinding {
  errorType: string;
  excerpt: string;
  explanation: string;
  suggestion: string;
}

/** The set of (model, field) pairs check-grammar.ts scans — kept as a single
 * source of truth so the script and any future admin UI agree on scope.
 * Mirrors the field list prisma/check-typos.ts already uses. */
export const GRAMMAR_CHECK_FIELDS: Record<string, string[]> = {
  FlashcardCard: ["russian", "exampleRu"],
  Idiom: ["phrase", "contextExampleRu"],
  GlossaryTerm: ["term", "russianEquivalent"],
  Story: ["title", "text"],
};
