import type { Exercise } from "./types";

export type AnswerValue =
  | number
  | string
  | string[]
  | Record<number, string>
  | Record<number, number>
  | undefined;
export type AnswerMap = Record<string, AnswerValue>;

export const PASS_THRESHOLD_PERCENT = 70;

/**
 * `correctness[i]` says whether unit `i` of the exercise was answered
 * correctly — a single-item array for multiple-choice/fill-blank/word-reorder/
 * listening, one entry per pair for matching, one entry per sub-question for
 * reading-comprehension (each unit is worth its own point).
 */
export interface ExerciseResult {
  earned: number;
  total: number;
  correctness: boolean[];
}

export function scoreExercise(
  exercise: Exercise,
  answer: AnswerValue,
): ExerciseResult {
  switch (exercise.type) {
    case "multiple-choice": {
      const correct = answer === exercise.correctIndex;
      return { earned: correct ? 1 : 0, total: 1, correctness: [correct] };
    }
    case "fill-blank": {
      const given =
        typeof answer === "string" ? answer.trim().toLowerCase() : "";
      const correct =
        given.length > 0 &&
        exercise.answers.some(
          (accepted) => accepted.trim().toLowerCase() === given,
        );
      return { earned: correct ? 1 : 0, total: 1, correctness: [correct] };
    }
    case "matching": {
      const chosen = (answer as Record<number, string> | undefined) ?? {};
      const correctness = exercise.pairs.map(
        (pair, index) => chosen[index] === pair.right,
      );
      const earned = correctness.filter(Boolean).length;
      return { earned, total: exercise.pairs.length, correctness };
    }
    case "word-reorder": {
      const given = Array.isArray(answer) ? (answer as string[]) : [];
      const correct =
        given.length === exercise.words.length &&
        given.every((word, index) => word === exercise.words[index]);
      return { earned: correct ? 1 : 0, total: 1, correctness: [correct] };
    }
    case "listening": {
      const correct = answer === exercise.correctIndex;
      return { earned: correct ? 1 : 0, total: 1, correctness: [correct] };
    }
    case "reading-comprehension": {
      const chosen = (answer as Record<number, number> | undefined) ?? {};
      const correctness = exercise.questions.map(
        (question, index) => chosen[index] === question.correctIndex,
      );
      const earned = correctness.filter(Boolean).length;
      return { earned, total: exercise.questions.length, correctness };
    }
    case "listening-transcription": {
      const given =
        typeof answer === "string" ? normalizeTranscription(answer) : "";
      const correct =
        given.length > 0 &&
        exercise.acceptedAnswers.some(
          (accepted) => normalizeTranscription(accepted) === given,
        );
      return { earned: correct ? 1 : 0, total: 1, correctness: [correct] };
    }
  }
}

/** Lenient comparison for typed-from-audio answers: trims, lowercases, and
 * strips the ё/е distinction plus stray punctuation, since students hearing
 * Russian for the first time shouldn't be marked wrong over а keyboard quirk. */
function normalizeTranscription(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:"'«»]/g, "")
    .replace(/\s+/g, " ");
}

export function computeScore(exercises: Exercise[], answers: AnswerMap) {
  let earned = 0;
  let total = 0;
  const results: Record<string, ExerciseResult> = {};

  for (const exercise of exercises) {
    const result = scoreExercise(exercise, answers[exercise.id]);
    results[exercise.id] = result;
    earned += result.earned;
    total += result.total;
  }

  const percentage = total > 0 ? Math.round((earned / total) * 100) : 100;
  const passed = percentage >= PASS_THRESHOLD_PERCENT;

  return { earned, total, percentage, passed, results };
}

/** One reviewable mistake: what was asked, what the student answered, what
 * the correct answer was, and (if the exam content provides it) why —
 * rendered in the exam profile breakdown so a wrong answer is a learning
 * moment, not just a lost point. */
export interface MistakeDetail {
  exerciseId: string;
  prompt: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation?: string;
}

const NO_ANSWER = "(sin respuesta)";

/** Builds one MistakeDetail per exercise that had at least one wrong unit.
 * For exercises with several sub-answers (matching, reading-comprehension),
 * only the incorrect pairs/questions are included in the your/correct text. */
export function describeMistakes(
  exercises: Exercise[],
  answers: AnswerMap,
  results: Record<string, ExerciseResult>,
): MistakeDetail[] {
  const details: MistakeDetail[] = [];

  for (const exercise of exercises) {
    const result = results[exercise.id];
    if (!result || !result.correctness.some((c) => !c)) continue;
    const answer = answers[exercise.id];

    switch (exercise.type) {
      case "multiple-choice":
      case "listening": {
        const chosen =
          typeof answer === "number" ? exercise.options[answer] : undefined;
        details.push({
          exerciseId: exercise.id,
          prompt: exercise.prompt,
          yourAnswer: chosen ?? NO_ANSWER,
          correctAnswer: exercise.options[exercise.correctIndex],
          explanation: exercise.explanation,
        });
        break;
      }
      case "fill-blank": {
        const given = typeof answer === "string" ? answer.trim() : "";
        details.push({
          exerciseId: exercise.id,
          prompt: `${exercise.before}___${exercise.after}`.trim(),
          yourAnswer: given || NO_ANSWER,
          correctAnswer: exercise.answers[0],
          explanation: exercise.explanation,
        });
        break;
      }
      case "word-reorder": {
        const given = Array.isArray(answer) ? (answer as string[]) : [];
        details.push({
          exerciseId: exercise.id,
          prompt: exercise.prompt,
          yourAnswer: given.length > 0 ? given.join(" ") : NO_ANSWER,
          correctAnswer: exercise.words.join(" "),
          explanation: exercise.explanation,
        });
        break;
      }
      case "listening-transcription": {
        const given = typeof answer === "string" ? answer.trim() : "";
        details.push({
          exerciseId: exercise.id,
          prompt: exercise.prompt,
          yourAnswer: given || NO_ANSWER,
          correctAnswer: exercise.acceptedAnswers[0],
          explanation: exercise.explanation,
        });
        break;
      }
      case "matching": {
        const chosen = (answer as Record<number, string> | undefined) ?? {};
        const wrongPairs = exercise.pairs.filter(
          (_, index) => !result.correctness[index],
        );
        details.push({
          exerciseId: exercise.id,
          prompt: exercise.pairs.map((pair) => pair.left).join(", "),
          yourAnswer: wrongPairs
            .map(
              (pair) =>
                `${pair.left} → ${chosen[exercise.pairs.indexOf(pair)] ?? NO_ANSWER}`,
            )
            .join(" · "),
          correctAnswer: wrongPairs
            .map((pair) => `${pair.left} → ${pair.right}`)
            .join(" · "),
          explanation: exercise.explanation,
        });
        break;
      }
      case "reading-comprehension": {
        const chosen = (answer as Record<number, number> | undefined) ?? {};
        const wrongQuestions = exercise.questions.filter(
          (_, index) => !result.correctness[index],
        );
        details.push({
          exerciseId: exercise.id,
          prompt: exercise.text.slice(0, 80),
          yourAnswer: wrongQuestions
            .map((q) => {
              const qIndex = exercise.questions.indexOf(q);
              const pick = chosen[qIndex];
              return `${q.prompt} — ${typeof pick === "number" ? q.options[pick] : NO_ANSWER}`;
            })
            .join(" · "),
          correctAnswer: wrongQuestions
            .map((q) => `${q.prompt} — ${q.options[q.correctIndex]}`)
            .join(" · "),
          explanation:
            wrongQuestions
              .map((q) => q.explanation)
              .filter(Boolean)
              .join(" ") || undefined,
        });
        break;
      }
    }
  }

  return details;
}

export function isExerciseComplete(
  exercise: Exercise,
  answer: AnswerValue,
): boolean {
  switch (exercise.type) {
    case "multiple-choice":
      return typeof answer === "number";
    case "fill-blank":
      return typeof answer === "string" && answer.trim().length > 0;
    case "matching": {
      const chosen = (answer as Record<number, string> | undefined) ?? {};
      return exercise.pairs.every((_, index) => Boolean(chosen[index]));
    }
    case "word-reorder":
      return (
        Array.isArray(answer) &&
        (answer as string[]).length === exercise.words.length
      );
    case "listening":
      return typeof answer === "number";
    case "reading-comprehension": {
      const chosen = (answer as Record<number, number> | undefined) ?? {};
      return exercise.questions.every(
        (_, index) => typeof chosen[index] === "number",
      );
    }
    case "listening-transcription":
      return typeof answer === "string" && answer.trim().length > 0;
  }
}
