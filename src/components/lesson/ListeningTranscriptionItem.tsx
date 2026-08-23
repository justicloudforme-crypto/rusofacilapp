"use client";

import type { ListeningTranscriptionExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import SpeakButton from "./SpeakButton";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function ListeningTranscriptionItem({
  exercise,
  value,
  onChange,
  submitted,
  correct,
  dict,
  audioUrl,
}: {
  exercise: ListeningTranscriptionExercise;
  value: string | undefined;
  onChange: (value: string) => void;
  submitted: boolean;
  correct: boolean;
  dict: ExercisesDict;
  /** Pre-generated narration for exercise.audioText, if any. */
  audioUrl?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionListeningTranscription}
      </p>
      <legend className="flex items-center gap-2 text-sm font-medium leading-6">
        <SpeakButton
          text={exercise.audioText}
          label={dict.listeningPlayLabel}
          size="md"
          audioUrl={audioUrl}
        />
        {exercise.prompt}
      </legend>
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={submitted}
        placeholder={dict.transcriptionPlaceholder}
        className={`w-full rounded-xl border bg-transparent p-3 text-sm outline-none disabled:opacity-70 ${
          submitted
            ? correct
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-red-500 bg-red-500/10"
            : "border-black/15 focus:border-foreground/50 dark:border-white/20"
        }`}
      />
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
            {!correct &&
              ` — ${dict.transcriptionCorrectAnswerLabel}: ${exercise.acceptedAnswers[0]}`}
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
