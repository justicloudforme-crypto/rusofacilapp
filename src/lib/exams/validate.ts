import { validateExercise } from "../lessons/validate";
import type { LevelSlug } from "../courses";
import type { ExamContent } from "./types";

export type ExamValidationResult =
  | { valid: true; content: ExamContent }
  | { valid: false; error: string };

/**
 * Same shape of check as validateLessonContent (src/lib/lessons/validate.ts)
 * — required fields present, skillAreas non-empty, each exercise valid —
 * reusing validateExercise/isStringArray instead of re-implementing the
 * per-exercise-type rules for a second time.
 */
export function validateExamContent(value: unknown, level: LevelSlug, slug: string): ExamValidationResult {
  if (typeof value !== "object" || value === null) {
    return { valid: false, error: "El contenido debe ser un objeto JSON" };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.title !== "string" || !v.title) {
    return { valid: false, error: "title falta o no es texto" };
  }
  if (typeof v.lessonRangeLabel !== "string" || !v.lessonRangeLabel) {
    return { valid: false, error: "lessonRangeLabel falta o no es texto" };
  }
  if (!Array.isArray(v.skillAreas) || v.skillAreas.length === 0) {
    return { valid: false, error: "skillAreas debe ser una lista con al menos un elemento" };
  }

  const seenAreaIds = new Set<string>();
  for (let i = 0; i < v.skillAreas.length; i++) {
    const area = v.skillAreas[i] as Record<string, unknown>;
    if (typeof area !== "object" || area === null) {
      return { valid: false, error: `skillAreas[${i}] debe ser un objeto` };
    }
    if (typeof area.id !== "string" || !area.id) {
      return { valid: false, error: `skillAreas[${i}].id falta o no es texto` };
    }
    if (seenAreaIds.has(area.id)) {
      return { valid: false, error: `skillAreas[${i}].id "${area.id}" está repetido` };
    }
    seenAreaIds.add(area.id);
    if (typeof area.title !== "string" || !area.title) {
      return { valid: false, error: `skillAreas[${i}].title falta o no es texto` };
    }
    if (!Array.isArray(area.exercises) || area.exercises.length === 0) {
      return { valid: false, error: `skillAreas[${i}].exercises debe tener al menos un ejercicio` };
    }
    for (let j = 0; j < area.exercises.length; j++) {
      const error = validateExercise(area.exercises[j], j);
      if (error) return { valid: false, error: `skillAreas[${i}].${error}` };
    }
  }

  if (v.slides !== undefined) {
    // Guard against pasting lesson content by mistake — exams have no slides.
    return { valid: false, error: "Un examen no debe tener 'slides' (eso es de una lección)" };
  }

  return {
    valid: true,
    content: {
      slug,
      level,
      title: v.title,
      lessonRangeLabel: v.lessonRangeLabel,
      skillAreas: v.skillAreas as ExamContent["skillAreas"],
    },
  };
}
