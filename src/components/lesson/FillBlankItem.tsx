"use client";

import type { FillBlankExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function FillBlankItem({
  exercise,
  value,
  onChange,
  submitted,
  correct,
  dict,
}: {
  exercise: FillBlankExercise;
  value: string | undefined;
  onChange: (value: string) => void;
  submitted: boolean;
  correct: boolean;
  dict: ExercisesDict;
}) {
  let inputClasses = "border-black/15 dark:border-white/20";
  if (submitted) {
    inputClasses = correct
      ? "border-emerald-500 bg-emerald-500/10"
      : "border-red-500 bg-red-500/10";
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionFillBlank}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-sm leading-6">
        <span className="font-mono">{exercise.before}</span>
        <input
          type="text"
          value={value ?? ""}
          disabled={submitted}
          onChange={(event) => onChange(event.target.value)}
          placeholder={dict.fillBlankPlaceholder}
          size={Math.max(4, (value?.length ?? 0) + 2)}
          className={`w-20 rounded-md border px-2 py-1 text-center font-mono outline-none focus:border-foreground/50 ${inputClasses}`}
        />
        <span className="font-mono">{exercise.after}</span>
      </p>
      {submitted && (
        <div className="flex flex-col gap-1">
          <p
            className={`text-xs font-medium ${
              correct
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {correct
              ? dict.correct
              : `${dict.incorrect} — ${dict.correctAnswerLabel}: ${exercise.answers[0]}`}
          </p>
          {exercise.explanation && (
            <p className="text-xs text-foreground/60">
              {dict.explanationLabel}: {exercise.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
