import type { VideoLessonData } from "./types";
import { partOfSpeechValues, isPartOfSpeech } from "./types";

export type LessonValidationResult =
  | { valid: true; lesson: VideoLessonData }
  | { valid: false; error: string };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateVideoLessonData(value: unknown): LessonValidationResult {
  if (typeof value !== "object" || value === null) {
    return { valid: false, error: "El contenido debe ser un objeto JSON" };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string" || !v.id) return { valid: false, error: "'id' falta o no es texto" };
  if (typeof v.title !== "string" || !v.title) return { valid: false, error: "'title' falta o no es texto" };
  if (typeof v.youtubeVideoId !== "string" || !v.youtubeVideoId)
    return { valid: false, error: "'youtubeVideoId' falta o no es texto" };
  if (!["A1", "A2", "B1", "B2"].includes(v.level as string))
    return { valid: false, error: "'level' debe ser A1, A2, B1 o B2" };

  if (!Array.isArray(v.subtitles) || v.subtitles.length === 0) {
    return { valid: false, error: "'subtitles' debe tener al menos una línea" };
  }
  for (let i = 0; i < v.subtitles.length; i++) {
    const line = v.subtitles[i] as Record<string, unknown>;
    if (
      typeof line !== "object" ||
      line === null ||
      typeof line.id !== "string" ||
      typeof line.start !== "number" ||
      typeof line.end !== "number" ||
      typeof line.ru !== "string" ||
      typeof line.es !== "string"
    ) {
      return { valid: false, error: `subtitles[${i}] necesita id, start, end (número), ru y es (texto)` };
    }
  }

  if (typeof v.glossary !== "object" || v.glossary === null || Array.isArray(v.glossary)) {
    return { valid: false, error: "'glossary' debe ser un objeto" };
  }
  for (const [key, gloss] of Object.entries(v.glossary as Record<string, unknown>)) {
    const g = gloss as Record<string, unknown>;
    if (
      typeof g !== "object" ||
      g === null ||
      typeof g.lemma !== "string" ||
      typeof g.translation !== "string" ||
      !isPartOfSpeech(g.partOfSpeech as string)
    ) {
      return {
        valid: false,
        error: `glossary["${key}"] necesita lemma, translation (texto) y partOfSpeech (${partOfSpeechValues.join(", ")})`,
      };
    }
  }

  if (!Array.isArray(v.historicalContext) || v.historicalContext.length === 0) {
    return { valid: false, error: "'historicalContext' debe tener al menos una sección" };
  }
  for (let i = 0; i < v.historicalContext.length; i++) {
    const section = v.historicalContext[i] as Record<string, unknown>;
    if (
      typeof section !== "object" ||
      section === null ||
      typeof section.id !== "string" ||
      typeof section.title !== "string" ||
      typeof section.bodyEs !== "string"
    ) {
      return { valid: false, error: `historicalContext[${i}] necesita id, title y bodyEs (texto)` };
    }
  }

  if (!Array.isArray(v.vocabulary) || v.vocabulary.length === 0) {
    return { valid: false, error: "'vocabulary' debe tener al menos una tarjeta" };
  }
  for (let i = 0; i < v.vocabulary.length; i++) {
    const card = v.vocabulary[i] as Record<string, unknown>;
    if (
      typeof card !== "object" ||
      card === null ||
      typeof card.id !== "string" ||
      typeof card.word !== "string" ||
      typeof card.translation !== "string" ||
      !isPartOfSpeech(card.partOfSpeech as string) ||
      typeof card.exampleRu !== "string" ||
      typeof card.exampleEs !== "string"
    ) {
      return { valid: false, error: `vocabulary[${i}] tiene un campo inválido o faltante` };
    }
  }

  if (!Array.isArray(v.quiz) || v.quiz.length === 0) {
    return { valid: false, error: "'quiz' debe tener al menos una pregunta" };
  }
  for (let i = 0; i < v.quiz.length; i++) {
    const question = v.quiz[i] as Record<string, unknown>;
    if (
      typeof question !== "object" ||
      question === null ||
      typeof question.id !== "string" ||
      (question.section !== "contexto" && question.section !== "vocabulario") ||
      typeof question.prompt !== "string" ||
      typeof question.correctOptionId !== "string"
    ) {
      return { valid: false, error: `quiz[${i}] tiene un campo inválido o faltante` };
    }
    const options = question.options as unknown;
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      !options.every(
        (option) =>
          typeof option === "object" &&
          option !== null &&
          typeof (option as Record<string, unknown>).id === "string" &&
          typeof (option as Record<string, unknown>).text === "string",
      )
    ) {
      return { valid: false, error: `quiz[${i}].options debe tener al menos 2 { id, text }` };
    }
  }

  if (!isStringArray(Object.keys(v.glossary as object))) {
    return { valid: false, error: "'glossary' debe tener claves de texto" };
  }

  return { valid: true, lesson: value as VideoLessonData };
}
