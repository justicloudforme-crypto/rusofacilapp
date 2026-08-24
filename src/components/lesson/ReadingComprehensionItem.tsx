"use client";

import type { ReadingComprehensionExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function ReadingComprehensionItem({
  exercise,
  value,
  onChange,
  submitted,
  correctness,
  dict,
  audioUrl,
}: {
  exercise: ReadingComprehensionExercise;
  value: Record<number, number> | undefined;
  onChange: (questionIndex: number, optionIndex: number) => void;
  submitted: boolean;
  correctness: boolean[];
  dict: ExercisesDict;
  /** Pre-generated narration for exercise.text, if any. */
  audioUrl?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionReadingComprehension}
      </p>
      <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-foreground/[.03] p-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <SpeakButton
            text={exercise.text}
            label={dict.listeningPlayLabel}
            size="md"
            audioUrl={audioUrl}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {dict.readingTextLabel}
          </span>
        </div>
        <p className="whitespace-pre-line leading-7 text-foreground/90">
          {exercise.text}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {exercise.questions.map((question, qIndex) => {
          const selected = value?.[qIndex];
          const isCorrect = correctness[qIndex];

          return (
            <fieldset key={question.prompt} className="flex flex-col gap-2">
              <legend className="text-sm font-medium leading-6">
                {question.prompt}
              </legend>
              <div className="flex flex-col gap-2">
                {question.options.map((option, oIndex) => {
                  const isSelected = selected === oIndex;
                  const isCorrectOption = oIndex === question.correctIndex;

                  let stateClasses = "border-black/15 dark:border-white/20";
                  if (submitted) {
                    if (isCorrectOption)
                      stateClasses = "border-emerald-500 bg-emerald-500/10";
                    else if (isSelected)
                      stateClasses = "border-red-500 bg-red-500/10";
                  } else if (isSelected) {
                    stateClasses = "border-foreground/60";
                  }

                  return (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm transition-colors ${stateClasses} ${
                        submitted
                          ? "cursor-default"
                          : "tap hover:border-foreground/40 active:border-foreground/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${exercise.id}-${qIndex}`}
                        checked={isSelected}
                        disabled={submitted}
                        onChange={() => onChange(qIndex, oIndex)}
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
                      isCorrect
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isCorrect ? dict.correct : dict.incorrect}
                  </p>
                  {question.explanation && (
                    <p className="text-xs text-foreground/60">
                      {dict.explanationLabel}: {question.explanation}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
