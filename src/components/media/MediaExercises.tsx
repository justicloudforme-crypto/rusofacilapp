"use client";

import { useState } from "react";
import type { Exercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { computeScore, isExerciseComplete, type AnswerMap, type AnswerValue } from "@/lib/lessons/scoring";
import MultipleChoiceItem from "@/components/lesson/MultipleChoiceItem";
import FillBlankItem from "@/components/lesson/FillBlankItem";
import MatchingItem from "@/components/lesson/MatchingItem";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function MediaExercises({
  exercises,
  dict,
  passedLabel,
  failedLabel,
}: {
  exercises: Exercise[];
  dict: ExercisesDict;
  passedLabel: string;
  failedLabel: string;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);

  if (exercises.length === 0) {
    return <p className="text-sm text-foreground/60">{dict.noContent}</p>;
  }

  const result = submitted ? computeScore(exercises, answers) : null;
  const allComplete = exercises.every((exercise) => isExerciseComplete(exercise, answers[exercise.id]));

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div className="flex flex-col gap-8">
      {exercises.map((exercise, index) => {
        const itemResult = result?.results[exercise.id];
        return (
          <div key={exercise.id} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
              {index + 1}
            </span>
            {exercise.type === "multiple-choice" && (
              <MultipleChoiceItem
                exercise={exercise}
                value={answers[exercise.id] as number | undefined}
                onChange={(value) => setAnswer(exercise.id, value)}
                submitted={submitted}
                correct={itemResult?.correctness[0] ?? false}
                dict={dict}
              />
            )}
            {exercise.type === "fill-blank" && (
              <FillBlankItem
                exercise={exercise}
                value={answers[exercise.id] as string | undefined}
                onChange={(value) => setAnswer(exercise.id, value)}
                submitted={submitted}
                correct={itemResult?.correctness[0] ?? false}
                dict={dict}
              />
            )}
            {exercise.type === "matching" && (
              <MatchingItem
                exercise={exercise}
                value={answers[exercise.id] as Record<number, string> | undefined}
                onChange={(leftIndex, right) => {
                  const current = (answers[exercise.id] as Record<number, string> | undefined) ?? {};
                  setAnswer(exercise.id, { ...current, [leftIndex]: right });
                }}
                submitted={submitted}
                correctness={itemResult?.correctness ?? []}
                dict={dict}
              />
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/30">
        {result && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {dict.scoreLabel}: {result.earned}/{result.total} ({result.percentage}%)
            </span>
            <span
              className={`font-medium ${
                result.passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {result.passed ? passedLabel : failedLabel}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!allComplete}
              className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dict.checkButton}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
              }}
              className="tap rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
            >
              {dict.retryButton}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
