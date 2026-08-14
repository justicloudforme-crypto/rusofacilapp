import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug, levelMeta, levelSlugs } from "@/lib/courses";
import { getExamContent } from "@/lib/exams/content";
import { getCurrentUser } from "@/lib/auth";
import { getLevelLessonStatuses, type LessonStatus } from "@/lib/progress";
import LevelGlossaryProgressBar from "@/components/glossary/LevelGlossaryProgressBar";

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    levelSlugs.map((level) => ({ lang, level }))
  );
}

export default async function LevelPage({
  params,
}: PageProps<"/[lang]/courses/[level]">) {
  const { lang, level } = await params;
  if (!isLocale(lang) || !isLevelSlug(level)) notFound();

  const dict = await getDictionary(lang);
  const levelDict = dict.courses.levels[level];
  const meta = levelMeta[level];

  // Anonymous visitors just don't see status badges — the lesson list
  // itself stays browsable without an account, same as before.
  const user = await getCurrentUser();
  const lessonStatuses = user ? await getLevelLessonStatuses(user.id, level) : {};

  // Milestone exams (one per 10 lessons) — resolved up front (not inside
  // the render loop below, since getExamContent is now async: it checks
  // the Exam DB table, cached, before falling back to the static file).
  const milestoneExams = await Promise.all(
    levelDict.lessons.map(async (_lesson, index) => {
      const lessonNumber = index + 1;
      if (lessonNumber % 10 !== 0) return null;
      const examSlug = `${level}-exam-${lessonNumber / 10}`;
      const exam = await getExamContent(level, examSlug);
      return exam ? { examSlug, exam } : null;
    })
  );

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href={`/${lang}/courses`}
        className="text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← {dict.courses.backToCourses}
      </Link>

      <span className="mt-6 block text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {level}
      </span>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {levelDict.title}
      </h1>
      <p className="mt-2 text-lg text-foreground/70">{levelDict.subtitle}</p>
      <p className="mt-4 leading-7 text-foreground/70">
        {levelDict.description}
      </p>

      <div className="mt-6 flex items-center gap-3 text-sm text-foreground/60">
        <span>
          {meta.weeks} {dict.courses.weeks}
        </span>
        <span aria-hidden>·</span>
        <span>
          {meta.hoursPerWeek} {dict.courses.hoursPerWeek}
        </span>
      </div>

      <LevelGlossaryProgressBar
        level={level}
        dict={{
          progressLabel: dict.courses.levelProgressLabel,
          celebrationMessage: dict.courses.levelMasteredCelebration,
        }}
      />

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        {dict.courses.lessonsTitle}
      </h2>
      <ol className="mt-4 flex flex-col gap-3">
        {levelDict.lessons.map((lesson, index) => {
          const lessonNumber = index + 1;
          const milestone = milestoneExams[index];
          const status: LessonStatus = lessonStatuses[String(lessonNumber)] ?? "none";
          const circleClasses =
            status === "passed"
              ? "bg-emerald-500 text-white"
              : status === "attempted"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-foreground/10";
          const statusLabel =
            status === "passed"
              ? dict.courses.lessonStatusPassed
              : status === "attempted"
                ? dict.courses.lessonStatusAttempted
                : undefined;
          return (
            <li key={lesson} className="flex flex-col gap-3">
              <Link
                href={`/${lang}/courses/${level}/${lessonNumber}`}
                className="flex items-start gap-3 rounded-xl border border-black/10 p-4 transition-colors hover:border-foreground/40 dark:border-white/10"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${circleClasses}`}
                  aria-label={statusLabel}
                  title={statusLabel}
                >
                  {status === "passed" ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414l2.793 2.792 6.793-6.793a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    lessonNumber
                  )}
                </span>
                <span className="text-sm leading-6">{lesson}</span>
              </Link>
              {milestone && (
                <Link
                  href={`/${lang}/courses/${level}/exam/${milestone.examSlug}`}
                  className="flex items-start gap-3 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 transition-colors hover:border-brand dark:border-brand-light/40 dark:bg-brand-light/10"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white">
                    ★
                  </span>
                  <span className="text-sm font-medium leading-6 text-brand dark:text-brand-light">
                    {milestone.exam.title}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
