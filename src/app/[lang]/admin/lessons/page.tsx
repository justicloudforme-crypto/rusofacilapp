import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelSlugs, lessonSlugsFor } from "@/lib/courses";
import { getAllLessonStatuses } from "@/lib/lessons/content";

const STATUS_CLASSES: Record<string, string> = {
  custom: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  example: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  empty: "bg-foreground/10 text-foreground/50",
};

export default async function AdminLessonsPage({
  params,
}: PageProps<"/[lang]/admin/lessons">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const statuses = await getAllLessonStatuses();

  const statusLabels: Record<string, string> = {
    custom: dict.admin.lessons.statusCustom,
    example: dict.admin.lessons.statusExample,
    empty: dict.admin.lessons.statusEmpty,
  };

  return (
    <div>
      <h2 className="font-medium">{dict.admin.lessons.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.lessons.subtitle}</p>

      <div className="mt-6 flex flex-col gap-8">
        {levelSlugs.map((level) => {
          const levelDict = dict.courses.levels[level];
          const lessonSlugs = lessonSlugsFor(level);
          return (
            <div key={level}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
                {levelDict.title}
              </h3>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
                      <th className="px-4 py-2">{dict.admin.lessons.lesson}</th>
                      <th className="px-4 py-2">{dict.admin.lessons.titleHeader}</th>
                      <th className="px-4 py-2">{dict.admin.lessons.statusHeader}</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lessonSlugs.map((lessonSlug, index) => {
                      const status = statuses[`${level}-${lessonSlug}`];
                      const title = levelDict.lessons[index] ?? "—";
                      return (
                        <tr
                          key={lessonSlug}
                          className="border-b border-black/5 last:border-0 dark:border-white/5"
                        >
                          <td className="px-4 py-2.5">{lessonSlug}</td>
                          <td className="px-4 py-2.5">{title}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}
                            >
                              {statusLabels[status]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={`/${lang}/admin/lessons/${level}/${lessonSlug}`}
                              className="font-medium text-foreground/80 hover:text-foreground"
                            >
                              {dict.admin.lessons.editButton} →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
