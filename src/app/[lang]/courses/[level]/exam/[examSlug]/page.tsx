import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug } from "@/lib/courses";
import { getCurrentUser } from "@/lib/auth";
import { markStudyDayVisit } from "@/lib/study-day-visit";
import { getEntitlementTierFor, hasAnyAccess } from "@/lib/entitlement";
import { getExamContent } from "@/lib/exams/content";
import { localizeExamText, localizeSkillAreaTitle } from "@/lib/exams/localize";
import ExamView from "@/components/lesson/ExamView";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[level]/exam/[examSlug]">): Promise<Metadata> {
  const { lang, level, examSlug } = await params;
  return { alternates: routeAlternates(lang, `/courses/${encodeURIComponent(level)}/exam/${encodeURIComponent(examSlug)}`) };
}

export default async function ExamPage({
  params,
}: PageProps<"/[lang]/courses/[level]/exam/[examSlug]">) {
  const { lang, level, examSlug } = await params;
  if (!isLocale(lang) || !isLevelSlug(level)) notFound();

  const exam = await getExamContent(level, examSlug);
  if (!exam) notFound();

  const user = await getCurrentUser();
  if (!user || !hasAnyAccess(await getEntitlementTierFor(user))) {
    redirect(`/${lang}/pricing?next=/${lang}/courses/${level}/exam/${examSlug}`);
  }

  const dict = await getDictionary(lang);

  // Opening the exam is the study action. Reached only past the guard
  // above, so `user` is non-null here; passed in so the zone comes from the
  // account rather than the cookie.
  await markStudyDayVisit("exam", user);

  const localizedExam = {
    ...exam,
    skillAreas: exam.skillAreas.map((area) => ({
      ...area,
      title: localizeSkillAreaTitle(area.title, lang, dict.courses.skillAreaNames),
    })),
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {localizeExamText(exam.lessonRangeLabel, lang, dict.courses.examNames)}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {localizeExamText(exam.title, lang, dict.courses.examNames)}
      </h1>
      <div className="mt-8">
        {/* Названия блоков локализуются ЗДЕСЬ, а не внутри ExamView: правка
            презентационная, а `ExamView` — клиентский компонент, который
            считает по `area.id` и о названиях не знает ничего. Так таблица
            переводов не уезжает в бандл к каждому посетителю. */}
        <ExamView exam={localizedExam} level={level} locale={lang} dict={dict.lesson.exercises} examDict={dict.profile} />
      </div>
    </div>
  );
}
