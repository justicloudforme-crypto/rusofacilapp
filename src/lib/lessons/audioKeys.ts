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

/**
 * Запасной ключ — по САМОМУ ТЕКСТУ, и только запасной.
 *
 * Заход 7.163. Правило владельца: звучит только оплаченная запись,
 * браузерного синтеза не должно быть нигде. Замер этого захода нашёл
 * поверхности, у которых позиционного ключа нет вовсе (примеры на слайдах
 * урока — генератор их никогда не озвучивал) или он не совпал
 * (пересобранный урок сдвинул позицию). Клип при этом уже оплачен и лежит
 * в Blob: 492 из 679 примеров на слайдах — это ТОТ ЖЕ текст, что у
 * словарного слова или грамматического примера того же урока.
 *
 * Позиционный ключ остаётся главным и проверяется первым — предупреждение
 * в шапке этого файла в силе: правка текста в админке не имеет права
 * рвать связь с оплаченной озвучкой. Текстовый ключ только добавляет
 * попадания там, где позиционного ключа нет; сломать существующую связь
 * он не может, потому что до него дело доходит лишь после промаха по
 * ключу.
 */
export function textAudioKey(text: string): string {
  return `text:${text}`;
}

/**
 * URL клипа для элемента: сначала по позиции, потом по тексту, иначе
 * `undefined` (штатный запасной путь `SpeakButton` — браузерный синтез).
 */
export function pickClip(
  audioMap: Record<string, string> | undefined,
  positionKey: string | null,
  text: string,
): string | undefined {
  if (!audioMap) return undefined;
  if (positionKey) {
    const byPosition = audioMap[positionKey];
    if (byPosition) return byPosition;
  }
  return audioMap[textAudioKey(text)];
}
