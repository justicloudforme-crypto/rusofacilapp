"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { QuizQuestion } from "@/lib/video-lesson/types";
import { useUiStrings } from "@/lib/use-ui-strings";

const QuestionBlock = memo(function QuestionBlock({
  question,
  index,
  selected,
  submitted,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  selected: string | undefined;
  submitted: boolean;
  onSelect: (questionId: string, optionId: string) => void;
}) {
  const isCorrectSelection = selected === question.correctOptionId;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium leading-6">
        {index + 1}. {question.prompt}
      </legend>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = selected === option.id;
          const isCorrectOption = option.id === question.correctOptionId;

          let stateClasses = "border-black/15 dark:border-white/20";
          if (submitted) {
            if (isCorrectOption) stateClasses = "border-emerald-500 bg-emerald-500/10";
            else if (isSelected) stateClasses = "border-red-500 bg-red-500/10";
          } else if (isSelected) {
            stateClasses = "border-foreground/60";
          }

          return (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors ${stateClasses} ${
                submitted ? "cursor-default" : "tap hover:border-foreground/40 active:border-foreground/40"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={isSelected}
                disabled={submitted}
                onChange={() => onSelect(question.id, option.id)}
                className="h-4 w-4"
              />
              <span>{option.text}</span>
            </label>
          );
        })}
      </div>
      {submitted && question.explanationEs && (
        <p
          className={`text-xs font-medium ${
            isCorrectSelection ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {question.explanationEs}
        </p>
      )}
    </fieldset>
  );
});

function VideoLessonQuiz({ questions }: { questions: QuizQuestion[] }) {
  const t = useUiStrings().videoLesson;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const contexto = useMemo(() => questions.filter((q) => q.section === "contexto"), [questions]);
  const vocabulario = useMemo(() => questions.filter((q) => q.section === "vocabulario"), [questions]);
  const allAnswered = questions.every((q) => answers[q.id]);

  const correctCount = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = percentage >= 70;

  const selectOption = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {contexto.length > 0 && (
        <div className="flex flex-col gap-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/40">
            {t.quizPartOne}
          </h4>
          {contexto.map((question, index) => (
            <QuestionBlock
              key={question.id}
              question={question}
              index={index}
              selected={answers[question.id]}
              submitted={submitted}
              onSelect={selectOption}
            />
          ))}
        </div>
      )}

      {vocabulario.length > 0 && (
        <div className="flex flex-col gap-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/40">
            {t.quizPartTwo}
          </h4>
          {vocabulario.map((question, index) => (
            <QuestionBlock
              key={question.id}
              question={question}
              index={contexto.length + index}
              selected={answers[question.id]}
              submitted={submitted}
              onSelect={selectOption}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-background p-4 dark:border-white/30">
        {submitted && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t.scoreLabel} {correctCount}/{questions.length} ({percentage}%)
            </span>
            <span
              className={`font-medium ${
                passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {passed ? t.passedLabel : t.failedLabel}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!allAnswered}
              className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.checkButton}
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
              {t.retryButton}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(VideoLessonQuiz);
