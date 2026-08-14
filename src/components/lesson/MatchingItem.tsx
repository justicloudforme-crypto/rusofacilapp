"use client";

import { useEffect, useState } from "react";
import type { MatchingExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { shuffle } from "@/lib/lessons/shuffle";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function MatchingItem({
  exercise,
  value,
  onChange,
  submitted,
  correctness,
  dict,
}: {
  exercise: MatchingExercise;
  value: Record<number, string> | undefined;
  onChange: (leftIndex: number, right: string) => void;
  submitted: boolean;
  correctness: boolean[];
  dict: ExercisesDict;
}) {
  // Starts in the exercise's own (deterministic) order on both server and
  // client so the first client render matches the SSR HTML exactly, then
  // shuffles right after mount — client-only, so it can never disagree
  // with what the server sent. Shuffling inside useMemo/render (the
  // previous approach) called Math.random() during SSR and again during
  // the client's first render, producing a different <option> order each
  // time and triggering a hydration mismatch.
  const [rightOptions, setRightOptions] = useState(() =>
    exercise.pairs.map((pair) => pair.right),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRightOptions(shuffle(exercise.pairs.map((pair) => pair.right)));
  }, [exercise.pairs]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionMatching}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-foreground/50">
              <th className="pb-2 pr-4">{dict.matchingLeftHeader}</th>
              <th className="pb-2">{dict.matchingRightHeader}</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {exercise.pairs.map((pair, index) => {
              const selected = value?.[index] ?? "";
              const isCorrect = correctness[index];

              let selectClasses = "border-black/15 dark:border-white/20";
              if (submitted) {
                selectClasses = isCorrect
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-red-500 bg-red-500/10";
              }

              return (
                <tr
                  key={pair.left}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="py-2 pr-4 font-medium">{pair.left}</td>
                  <td className="py-2">
                    <select
                      value={selected}
                      disabled={submitted}
                      onChange={(event) => onChange(index, event.target.value)}
                      className={`w-full rounded-md border bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50 ${selectClasses}`}
                    >
                      <option value="" disabled>
                        {dict.selectPlaceholder}
                      </option>
                      {rightOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {submitted && !isCorrect && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {dict.correctAnswerLabel}: {pair.right}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {submitted && (
        <div className="flex flex-col gap-1">
          <p
            className={`text-xs font-medium ${
              correctness.every(Boolean)
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {correctness.every(Boolean) ? dict.correct : dict.incorrect}
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
