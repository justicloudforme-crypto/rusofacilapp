/**
 * Single source of truth for the AudioAsset.itemKey a lesson/exam content
 * item resolves to, shared between the generation scripts
 * (prisma/generate-lesson-audio.ts, prisma/generate-exam-audio.ts) and the
 * frontend lookup (LessonView's tabs, ExamView). Keyed by an item's fixed
 * position, never its text — a typo/grammar fix to the Russian sentence
 * (including one made later through the admin Lesson-override editor,
 * which the generation scripts never see) must never break the link to
 * its already-paid-for narration. A real, confirmed incident: exactly this
 * happened for 14 items across the course after `/api/lesson-audio` keyed
 * its response by literal text instead of position.
 */

export function vocabAudioKey(index: number): string {
  return `vocab-${index}`;
}

export function alphabetAudioKey(index: number): string {
  return `alphabet-${index}`;
}

export function grammarExampleAudioKey(index: number): string {
  return `grammar-example-${index}`;
}

export function readingPracticeAudioKey(index: number): string {
  return `reading-${index}`;
}

export type ExerciseAudioType = "listening" | "listening-transcription" | "reading";

export function exerciseAudioKey(type: ExerciseAudioType, index: number): string {
  if (type === "listening") return `exercise-listening-${index}`;
  if (type === "listening-transcription") return `exercise-listening-transcription-${index}`;
  return `exercise-reading-${index}`;
}

export function examAudioKey(areaIndex: number, exerciseIndex: number, type: ExerciseAudioType): string {
  return `area-${areaIndex}-ex-${exerciseIndex}-${type}`;
}
