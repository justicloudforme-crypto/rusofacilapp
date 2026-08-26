"use client";

import { useEffect, useState } from "react";
import type { ExamContent } from "@/lib/exams/types";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  computeScore,
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
import { examAudioKey } from "@/lib/lessons/audioKeys";

type ExercisesDict = Dictionary["lesson"]["exercises"];
type ExamDict = Dictionary["profile"];

interface AttemptResult {
  earned: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: Record<
    string,
    { earned: number; total: number; percentage: number }
  >;
}

export default function ExamView({
  exam,
  level,
  dict,
  examDict,
}: {
  exam: ExamContent;
  level: string;
  dict: ExercisesDict;
  examDict: ExamDict;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Pre-generated pronunciation audio for this exam's listening/reading
  // items (see prisma/generate-exam-audio.ts), keyed by item position
  // (see src/lib/lessons/audioKeys.ts) — same pattern as LessonView's
  // audioMap. Empty until this resolves; SpeakButton falls back to
  // browser synthesis meanwhile.
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/exam-audio?level=${level}&examSlug=${exam.slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { audio?: Record<string, string> } | null) => {
        if (body?.audio) setAudioMap(body.audio);
      })
      .catch(() => {
        // No cached audio available — browser-synthesis fallback covers this.
      });
  }, [level, exam.slug]);

  const allExercises = exam.skillAreas.flatMap((area) => area.exercises);
  const allComplete = allExercises.every((exercise) =>
    isExerciseComplete(exercise, answers[exercise.id]),
  );
  const localResult = submitted ? computeScore(allExercises, answers) : null;
  const answeredCount = allExercises.filter((exercise) =>
    isExerciseComplete(exercise, answers[exercise.id]),
  ).length;
  const currentExercise = submitted
    ? undefined
    : allExercises.find(
        (exercise) => !isExerciseComplete(exercise, answers[exercise.id]),
      );

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitted(true);
    try {
      const response = await fetch(`/api/exams/${level}/${exam.slug}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (response.ok) {
        const data = (await response.json()) as AttemptResult;
        setAttempt(data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setSubmitted(false);
    setAttempt(null);
    setAnswers({});
  }

  return (
    <div className="flex flex-col gap-10">
      {!submitted && (
        <div className="sticky top-0 z-10 flex flex-col gap-1.5 rounded-xl border border-black/10 bg-background/95 px-3 py-2 backdrop-blur dark:border-white/30">
          <div className="flex items-center justify-between text-xs font-medium text-foreground/60">
            <span>{dict.progressLabel}</span>
            <span>
              {answeredCount} / {allExercises.length} {dict.answeredLabel}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{
                width: `${allExercises.length === 0 ? 0 : (answeredCount / allExercises.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {exam.skillAreas.map((area, areaIndex) => {
        const areaBreakdown = attempt?.breakdown[area.id];
        return (
          <section key={area.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2 dark:border-white/30">
              <h2 className="text-lg font-semibold tracking-tight">
                {area.title}
              </h2>
              {areaBreakdown && (
                <span className="text-sm font-medium text-foreground/70">
                  {examDict.scoreLabel}: {areaBreakdown.earned}/
                  {areaBreakdown.total} ({areaBreakdown.percentage}%)
                </span>
              )}
            </div>

            {area.exercises.map((exercise, index) => {
              const itemResult = localResult?.results[exercise.id];
              const isCurrent = exercise.id === currentExercise?.id;
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
                        answers[exercise.id] as
                          Record<number, string> | undefined
                      }
                      onChange={(leftIndex, right) => {
                        const current =
                          (answers[exercise.id] as
                            Record<number, string> | undefined) ?? {};
                        setAnswer(exercise.id, {
                          ...current,
                          [leftIndex]: right,
                        });
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
                      audioUrl={audioMap[examAudioKey(areaIndex, index, "listening")]}
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
                      audioUrl={audioMap[examAudioKey(areaIndex, index, "listening-transcription")]}
                    />
                  )}
                  {exercise.type === "reading-comprehension" && (
                    <ReadingComprehensionItem
                      exercise={exercise}
                      value={
                        answers[exercise.id] as
                          Record<number, number> | undefined
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
                      audioUrl={audioMap[examAudioKey(areaIndex, index, "reading")]}
                    />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/30">
        {attempt && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {examDict.scoreLabel}: {attempt.earned}/{attempt.total} (
              {attempt.percentage}%)
            </span>
            <span
              className={`font-medium ${
                attempt.passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {attempt.passed
                ? examDict.examPassedLabel
                : examDict.examFailedLabel}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allComplete}
              className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dict.checkButton}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              disabled={submitting}
              className="tap rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
            >
              {dict.retryButton}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
