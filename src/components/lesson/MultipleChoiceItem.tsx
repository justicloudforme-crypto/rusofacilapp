"use client";

import type { MultipleChoiceExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function MultipleChoiceItem({
  exercise,
  value,
  onChange,
  submitted,
  correct,
  dict,
}: {
  exercise: MultipleChoiceExercise;
  value: number | undefined;
  onChange: (value: number) => void;
  submitted: boolean;
  correct: boolean;
  dict: ExercisesDict;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionMultipleChoice}
      </p>
      <legend className="text-sm font-medium leading-6">
        {exercise.prompt}
      </legend>
      <div className="flex flex-col gap-2">
        {exercise.options.map((option, index) => {
          const isSelected = value === index;
          const isCorrectOption = index === exercise.correctIndex;

          let stateClasses = "border-black/15 dark:border-white/20";
          if (submitted) {
            if (isCorrectOption) {
              stateClasses = "border-emerald-500 bg-emerald-500/10";
            } else if (isSelected && !isCorrectOption) {
              stateClasses = "border-red-500 bg-red-500/10";
            }
          } else if (isSelected) {
            stateClasses = "border-foreground/60";
          }

          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${stateClasses} ${
                submitted ? "cursor-default" : "tap hover:border-foreground/40 active:border-foreground/40"
              }`}
            >
              <input
                type="radio"
                name={exercise.id}
                checked={isSelected}
                disabled={submitted}
                onChange={() => onChange(index)}
                className="h-4 w-4"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      {submitted && (
        <div className="flex flex-col gap-1">
          <p
            className={`text-xs font-medium ${
              correct
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {correct ? dict.correct : dict.incorrect}
          </p>
          {exercise.explanation && (
            <p className="text-xs text-foreground/60">
              {dict.explanationLabel}: {exercise.explanation}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
