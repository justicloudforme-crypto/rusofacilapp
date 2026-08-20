"use client";

import { useEffect, useState } from "react";
import type { Exercise } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  computeScore,
  describeMistakes,
  isExerciseComplete,
  type AnswerMap,
  type AnswerValue,
} from "@/lib/lessons/scoring";
import MultipleChoiceItem from "./MultipleChoiceItem";
import FillBlankItem from "./FillBlankItem";
import MatchingItem from "./MatchingItem";
import WordReorderItem from "./WordReorderItem";
import ListeningItem from "./ListeningItem";
import ReadingComprehensionItem from "./ReadingComprehensionItem";
import ListeningTranscriptionItem from "./ListeningTranscriptionItem";
import PronunciationPractice from "./PronunciationPractice";
import type { VocabularyItem } from "@/lib/lessons/types";
import { flushPendingProgress, queuePendingProgress } from "@/lib/progress-client";
import CelebrationModal from "@/components/celebration/CelebrationModal";
import EncouragementModal from "@/components/celebration/EncouragementModal";

type ExercisesDict = Dictionary["lesson"]["exercises"];

export default function ExercisesTab({
  exercises,
  vocabulary,
  dict,
  pronunciationDict,
  celebrationDict,
  level,
  lessonSlug,
  storageKey,
  onPassChange,
  enableAudioRecording = true,
}: {
  exercises: Exercise[];
  vocabulary: VocabularyItem[];
  dict: ExercisesDict;
  pronunciationDict: Dictionary["lesson"]["pronunciation"];
  celebrationDict: Dictionary["celebration"];
  level: string;
  lessonSlug: string;
  storageKey: string;
  onPassChange: (passed: boolean) => void;
  enableAudioRecording?: boolean;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  // Starts false on both server and client so hydration output matches;
  // the real value (which needs localStorage, a browser-only API) is read
  // right after mount below.
  const [passed, setPassed] = useState(false);
  // True once a previous attempt has been restored from the server (rather
  // than the student just having submitted one this visit) — drives the
  // "this is your previous attempt" banner so restored state doesn't read
  // as a brand-new result.
  const [restored, setRestored] = useState(false);
  // True only for a pass that just happened from a check button click in
  // this visit — never for a pass restored from a previous attempt (the
  // effect below) or one already unlocked before mount — so the
  // celebration fires exactly once, the moment it's actually earned.
  const [justPassed, setJustPassed] = useState(false);
  // Same "fired exactly once, only for a fresh result this visit" rule as
  // justPassed above, mirrored for the failing case.
  const [justFailed, setJustFailed] = useState(false);

  useEffect(() => {
    // Reading localStorage is only possible after mount (it doesn't exist
    // during SSR), so this genuinely has to happen in an effect rather
    // than during render — hence the rule overrides below.
    const alreadyPassed =
      exercises.length === 0 || window.localStorage.getItem(storageKey) === "1";
    if (alreadyPassed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassed(true);
      onPassChange(true);
    }
    // Only run once per lesson on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    // Restores the exact graded view from the student's last attempt at
    // this lesson (pass or fail) — so a repeat visit shows what they
    // answered and what was right/wrong, instead of a blank form, per the
    // "study fully independently" requirement: nothing about a previous
    // attempt should be lost just by navigating away.
    if (exercises.length === 0) return;
    const controller = new AbortController();
    fetch(`/api/progress?level=${level}&lesson=${lessonSlug}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { attempt: null }))
      .then((body: { attempt?: { score: number; passed: boolean; answers: AnswerMap } | null }) => {
        if (!body.attempt) return;
        setAnswers(body.attempt.answers);
        setSubmitted(true);
        setRestored(true);
        if (body.attempt.passed) {
          setPassed(true);
          onPassChange(true);
        }
      })
      .catch(() => {
        // No saved attempt reachable (offline, or none exists yet) — the
        // form just starts blank, same as before this feature existed.
      });
    return () => controller.abort();
    // Only run once per lesson on mount, same reasoning as the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, lessonSlug]);

  useEffect(() => {
    // A student who checked exercises offline (or hit a transient server
    // error) still gets the local unlock immediately — this just makes
    // sure the server eventually finds out too, so /profile and the
    // "restore my last attempt" feature don't quietly stay stale forever.
    flushPendingProgress();
    window.addEventListener("online", flushPendingProgress);
    return () => window.removeEventListener("online", flushPendingProgress);
  }, []);

  if (exercises.length === 0) {
    return <p className="text-sm text-foreground/60">{dict.noContent}</p>;
  }

  const result = submitted ? computeScore(exercises, answers) : null;
  const allComplete = exercises.every((exercise) =>
    isExerciseComplete(exercise, answers[exercise.id]),
  );
  const answeredCount = exercises.filter((exercise) =>
    isExerciseComplete(exercise, answers[exercise.id]),
  ).length;
  const currentIndex = submitted
    ? -1
    : exercises.findIndex(
        (exercise) => !isExerciseComplete(exercise, answers[exercise.id]),
      );

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleCheck() {
    const outcome = computeScore(exercises, answers);
    setSubmitted(true);
    setRestored(false);
    if (outcome.passed && !passed) {
      setPassed(true);
      setJustPassed(true);
      window.localStorage.setItem(storageKey, "1");
      onPassChange(true);
    } else if (!outcome.passed) {
      setJustFailed(true);
    }
    // Saved on every check, pass or fail, so a repeat visit can restore
    // this exact attempt — see the restore effect above.
    const attemptPayload = {
      level,
      lesson: lessonSlug,
      score: outcome.percentage,
      passed: outcome.passed,
      mistakes: describeMistakes(exercises, answers, outcome.results),
      answers,
    };
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attemptPayload),
    }).then((res) => {
      if (!res.ok) queuePendingProgress(attemptPayload);
    }).catch(() => {
      // Offline, or the request never reached the server — queue it for a
      // background retry (see progress-client.ts) instead of losing it.
      // Progress is still unlocked locally (localStorage) either way; the
      // /profile progress bar and the "restore last attempt" feature just
      // won't reflect this particular check until the retry succeeds.
      queuePendingProgress(attemptPayload);
    });
  }

  function handleRetry() {
    setSubmitted(false);
    setRestored(false);
    setJustFailed(false);
    setAnswers({});
  }

  return (
    <div className="flex flex-col gap-8">
      <CelebrationModal
        open={justPassed}
        title={celebrationDict.lessonPassedTitle}
        subtitle={celebrationDict.lessonPassedSubtitle}
        scoreLabel={result ? `${result.earned}/${result.total} (${result.percentage}%)` : undefined}
        ctaLabel={celebrationDict.continueButton}
        exclamations={celebrationDict.exclamations}
        onClose={() => setJustPassed(false)}
      />
      <EncouragementModal
        open={justFailed}
        title={dict.failed}
        ctaLabel={celebrationDict.continueButton}
        exclamations={celebrationDict.consolationExclamations}
        onClose={() => setJustFailed(false)}
      />

      {passed && !submitted && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {dict.alreadyPassed}
        </p>
      )}

      {restored && submitted && (
        <p className="rounded-lg bg-brand/[0.06] px-3 py-2 text-sm text-foreground/70 dark:bg-brand-light/[0.08]">
          {dict.previousAttemptBanner}
        </p>
      )}

      {!submitted && (
        <div className="sticky top-0 z-10 flex flex-col gap-1.5 rounded-xl border border-black/10 bg-background/95 px-3 py-2 backdrop-blur dark:border-white/10">
          <div className="flex items-center justify-between text-xs font-medium text-foreground/60">
            <span>{dict.progressLabel}</span>
            <span>
              {answeredCount} / {exercises.length} {dict.answeredLabel}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{
                width: `${exercises.length === 0 ? 0 : (answeredCount / exercises.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {exercises.map((exercise, index) => {
        const itemResult = result?.results[exercise.id];
        const isCurrent = index === currentIndex;
        return (
          <div
            key={exercise.id}
            className={`flex flex-col gap-2 rounded-xl transition-colors ${
              isCurrent
                ? "-mx-3 border border-foreground/20 bg-foreground/[.03] px-3 py-2"
                : ""
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
              {index + 1}
              {isCurrent && (
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold normal-case text-foreground/60">
                  {dict.progressLabel}
                </span>
              )}
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
                value={
                  answers[exercise.id] as Record<number, string> | undefined
                }
                onChange={(leftIndex, right) => {
                  const current =
                    (answers[exercise.id] as
                      Record<number, string> | undefined) ?? {};
                  setAnswer(exercise.id, { ...current, [leftIndex]: right });
                }}
                submitted={submitted}
                correctness={itemResult?.correctness ?? []}
                dict={dict}
              />
            )}
            {exercise.type === "word-reorder" && (
              <WordReorderItem
                exercise={exercise}
                value={answers[exercise.id] as string[] | undefined}
                onChange={(value) => setAnswer(exercise.id, value)}
                submitted={submitted}
                correct={itemResult?.correctness[0] ?? false}
                dict={dict}
              />
            )}
            {exercise.type === "listening" && (
              <ListeningItem
                exercise={exercise}
                value={answers[exercise.id] as number | undefined}
                onChange={(value) => setAnswer(exercise.id, value)}
                submitted={submitted}
                correct={itemResult?.correctness[0] ?? false}
                dict={dict}
              />
            )}
            {exercise.type === "listening-transcription" && (
              <ListeningTranscriptionItem
                exercise={exercise}
                value={answers[exercise.id] as string | undefined}
                onChange={(value) => setAnswer(exercise.id, value)}
                submitted={submitted}
                correct={itemResult?.correctness[0] ?? false}
                dict={dict}
              />
            )}
            {exercise.type === "reading-comprehension" && (
              <ReadingComprehensionItem
                exercise={exercise}
                value={
                  answers[exercise.id] as Record<number, number> | undefined
                }
                onChange={(questionIndex, optionIndex) => {
                  const current =
                    (answers[exercise.id] as
                      Record<number, number> | undefined) ?? {};
                  setAnswer(exercise.id, {
                    ...current,
                    [questionIndex]: optionIndex,
                  });
                }}
                submitted={submitted}
                correctness={itemResult?.correctness ?? []}
                dict={dict}
              />
            )}
          </div>
        );
      })}

      {enableAudioRecording && (
        <PronunciationPractice
          vocabulary={vocabulary}
          level={level}
          lessonSlug={lessonSlug}
          dict={pronunciationDict}
        />
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/10">
        {result && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {dict.scoreLabel}: {result.earned}/{result.total} (
              {result.percentage}%)
            </span>
            <span
              className={`font-medium ${
                result.passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {result.passed ? dict.passed : dict.failed}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={handleCheck}
              disabled={!allComplete}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dict.checkButton}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
            >
              {dict.retryButton}
            </button>
          )}
          {!passed && (
            <span className="text-xs text-foreground/50">
              {dict.completeToUnlock}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
