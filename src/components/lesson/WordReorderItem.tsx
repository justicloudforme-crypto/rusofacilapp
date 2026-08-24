"use client";

import { useEffect, useState } from "react";
import type { WordReorderExercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { shuffle } from "@/lib/lessons/shuffle";

type ExercisesDict = Dictionary["lesson"]["exercises"];

/** Greedily maps each word in `chosen` (in order) to the first pool slot
 * carrying that word not already claimed — lets the pool safely contain
 * duplicate words without picks becoming ambiguous. */
function usedPoolIndices(chosen: string[], pool: string[]): Set<number> {
  const used = new Set<number>();
  for (const word of chosen) {
    const slot = pool.findIndex(
      (poolWord, index) => poolWord === word && !used.has(index),
    );
    if (slot !== -1) used.add(slot);
  }
  return used;
}

export default function WordReorderItem({
  exercise,
  value,
  onChange,
  submitted,
  correct,
  dict,
}: {
  exercise: WordReorderExercise;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  submitted: boolean;
  correct: boolean;
  dict: ExercisesDict;
}) {
  // Same hydration-safe pattern as MatchingItem: start with the exercise's
  // own (deterministic) word order — identical on server and the client's
  // first render — then shuffle client-only, after mount. The previous
  // `useState(() => shuffle(...))` ran that Math.random()-based shuffle
  // during the initializer, which executes on both the server render and
  // the client's first render, producing two different orders and a
  // hydration mismatch.
  const [pool, setPool] = useState(() => exercise.words);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPool(shuffle(exercise.words));
  }, [exercise.words]);
  const chosen = value ?? [];
  const used = usedPoolIndices(chosen, pool);

  function pick(poolIndex: number) {
    if (submitted) return;
    onChange([...chosen, pool[poolIndex]]);
  }

  function removeAt(position: number) {
    if (submitted) return;
    const next = [...chosen];
    next.splice(position, 1);
    onChange(next);
  }

  let stateClasses = "border-black/15 dark:border-white/20";
  if (submitted) {
    stateClasses = correct
      ? "border-emerald-500 bg-emerald-500/10"
      : "border-red-500 bg-red-500/10";
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <p className="text-xs font-medium text-foreground/50">
        {dict.instructionWordReorder}
      </p>
      <legend className="text-sm font-medium leading-6">
        {exercise.prompt}
      </legend>

      <div
        className={`flex min-h-12 flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${stateClasses}`}
      >
        {chosen.length === 0 && (
          <span className="text-xs text-foreground/40">
            {dict.wordReorderEmpty}
          </span>
        )}
        {chosen.map((word, position) => (
          <button
            key={`chosen-${position}`}
            type="button"
            disabled={submitted}
            onClick={() => removeAt(position)}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:cursor-default"
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {pool.map((word, poolIndex) =>
          used.has(poolIndex) ? null : (
            <button
              key={`pool-${poolIndex}`}
              type="button"
              disabled={submitted}
              onClick={() => pick(poolIndex)}
              className="tap rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20"
            >
              {word}
            </button>
          ),
        )}
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
            {correct
              ? dict.correct
              : `${dict.incorrect} — ${dict.correctAnswerLabel}: ${exercise.words.join(" ")}`}
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
