// Linguistic-terms glossary — the course's own metalanguage (aspecto
// perfectivo, caso genitivo, participio activo...) explained in Spanish
// with its standard Russian name. Distinct from /api/dictionary/translate,
// which looks up arbitrary Russian WORDS via a free external API.

import { isLevelSlug, levelSlugs, type LevelSlug } from "./courses";

/** Prefix for cached /api/glossary list responses (see src/lib/cache.ts) —
 * shared so the admin save/delete routes can invalidate every cached
 * variant (different q/category/level combinations) after a write, without
 * importing route.ts files across module boundaries. */
export const GLOSSARY_LIST_CACHE_PREFIX = "glossary:list:";

export const glossaryCategories = [
  "partes-de-la-oracion",
  "casos",
  "aspecto",
  "participios-gerundios",
  "conjunciones",
  "verbos-movimiento",
  "registro-estilo",
  "otros",
] as const;

export type GlossaryCategory = (typeof glossaryCategories)[number];

export function isGlossaryCategory(value: string): value is GlossaryCategory {
  return (glossaryCategories as readonly string[]).includes(value);
}

export interface GlossaryExample {
  es: string;
  ru: string;
  /** Pre-generated narration for `ru` (see prisma/generate-glossary-audio.ts),
   * attached server-side by the /api/glossary routes. Undefined until that
   * generation pass runs — SpeakButton falls back to browser TTS silently. */
  audioUrl?: string;
}

export interface GlossaryTermInput {
  slug: string;
  term: string;
  definition: string;
  russianEquivalent: string;
  transcription: string | null;
  category: GlossaryCategory;
  russianComparison: string | null;
  examples: GlossaryExample[];
  relatedLessons: string[];
}

export type GlossaryValidationResult =
  | { valid: true; value: GlossaryTermInput }
  | { valid: false; error: string };

function slugify(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents (participación → participacion)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Shared by the admin save route and (later) a form, so both agree on
 * what a valid glossary entry looks like — same pattern as
 * validateStoryInput in src/lib/stories.ts. */
export function validateGlossaryInput(body: unknown): GlossaryValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "invalid_body" };
  }
  const v = body as Record<string, unknown>;

  const term = typeof v.term === "string" ? v.term.trim() : "";
  if (!term) return { valid: false, error: "term_required" };

  const definition = typeof v.definition === "string" ? v.definition.trim() : "";
  if (!definition) return { valid: false, error: "definition_required" };

  const russianEquivalent = typeof v.russianEquivalent === "string" ? v.russianEquivalent.trim() : "";
  if (!russianEquivalent) return { valid: false, error: "russianEquivalent_required" };

  const category = typeof v.category === "string" ? v.category : "";
  if (!isGlossaryCategory(category)) return { valid: false, error: "invalid_category" };

  const slugRaw = typeof v.slug === "string" ? v.slug.trim() : "";
  const slug = slugify(slugRaw || term);
  if (!slug) return { valid: false, error: "invalid_slug" };

  const transcriptionRaw = typeof v.transcription === "string" ? v.transcription.trim() : "";
  const russianComparisonRaw = typeof v.russianComparison === "string" ? v.russianComparison.trim() : "";
  const relatedLessons = Array.isArray(v.relatedLessons)
    ? v.relatedLessons.filter((x): x is string => typeof x === "string")
    : [];
  const examples = Array.isArray(v.examples)
    ? v.examples
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => ({
          es: typeof x.es === "string" ? x.es.trim() : "",
          ru: typeof x.ru === "string" ? x.ru.trim() : "",
        }))
        .filter((x): x is GlossaryExample => x.es !== "" && x.ru !== "")
    : [];

  return {
    valid: true,
    value: {
      slug,
      term,
      definition,
      russianEquivalent,
      transcription: transcriptionRaw || null,
      category,
      russianComparison: russianComparisonRaw || null,
      examples,
      relatedLessons,
    },
  };
}

/** GlossaryTerm.examples is stored as a JSON-encoded { es, ru }[] column —
 * same reasoning as parseRelatedLessonsJson below. */
export function parseExamplesJson(json: string): GlossaryExample[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is GlossaryExample => typeof x === "object" && x !== null && typeof x.es === "string" && typeof x.ru === "string"
    );
  } catch {
    return [];
  }
}

/** GlossaryTerm.relatedLessons is stored as a JSON-encoded string[] column
 * (see prisma/schema.prisma) — this turns a raw DB row's field back into an
 * array for API responses. Never throws: a corrupt/legacy value just
 * yields no related lessons rather than a 500. */
export function parseRelatedLessonsJson(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface RelatedLessonRef {
  slug: string;
  level: LevelSlug;
  lesson: string;
}

/** Splits a relatedLessons entry like "a1-3" into its level and lesson
 * number, for building a link to /[lang]/courses/[level]/[lesson]. Returns
 * null for anything that doesn't match that shape, so a typo'd entry is
 * silently skipped in the UI rather than producing a broken link. */
export function parseRelatedLessonSlug(slug: string): RelatedLessonRef | null {
  const match = /^([a-z]\d)-(\d+)$/.exec(slug);
  if (!match) return null;
  const [, level, lesson] = match;
  if (!isLevelSlug(level)) return null;
  return { slug, level, lesson };
}

/** The lowest-numbered level a term's relatedLessons touch — i.e. where a
 * student first meets the term (e.g. `voz-pasiva` → ["b1-20", "b2-13"]`
 * returns "b1"). Used for the "introducido en {level}" provenance badge:
 * without it, a student hitting a term at B2 that was actually taught back
 * at A1 has no way to know there's earlier context to fall back on. */
export function earliestRelatedLevel(relatedLessons: string[]): LevelSlug | null {
  let earliest: LevelSlug | null = null;
  for (const entry of relatedLessons) {
    const ref = parseRelatedLessonSlug(entry);
    if (!ref) continue;
    if (earliest === null || levelSlugs.indexOf(ref.level) < levelSlugs.indexOf(earliest)) {
      earliest = ref.level;
    }
  }
  return earliest;
}
