import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelSlugs } from "@/lib/courses";
import { getAllExamStatuses, staticExamContent } from "@/lib/exams/content";
import NewExamForm from "@/components/admin/NewExamForm";

const STATUS_CLASSES: Record<string, string> = {
  custom: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  example: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  empty: "bg-foreground/10 text-foreground/50",
};

export default async function AdminExamsPage({
  params,
}: PageProps<"/[lang]/admin/exams">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const statuses = await getAllExamStatuses();

  const statusLabels: Record<string, string> = {
    custom: dict.admin.exams.statusCustom,
    example: dict.admin.exams.statusExample,
    empty: dict.admin.exams.statusEmpty,
  };

  const rows = Object.keys(statuses)
    .map((key) => {
      const [level, ...rest] = key.split("-");
      const examSlug = rest.join("-");
      const title = staticExamContent[examSlug]?.title ?? examSlug;
      return { level, examSlug, title, status: statuses[key] };
    })
    .sort((a, b) => (a.level === b.level ? a.examSlug.localeCompare(b.examSlug) : a.level.localeCompare(b.level)));

  return (
    <div>
      <h2 className="font-medium">{dict.admin.exams.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.exams.subtitle}</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
              <th className="px-4 py-2">{dict.admin.exams.level}</th>
              <th className="px-4 py-2">{dict.admin.exams.examSlugHeader}</th>
              <th className="px-4 py-2">{dict.admin.exams.titleHeader}</th>
              <th className="px-4 py-2">{dict.admin.exams.statusHeader}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.level}-${row.examSlug}`} className="border-b border-black/5 last:border-0 dark:border-white/5">
                <td className="px-4 py-2.5 uppercase">{row.level}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{row.examSlug}</td>
                <td className="px-4 py-2.5">{row.title}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[row.status]}`}>
                    {statusLabels[row.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/${lang}/admin/exams/${row.level}/${row.examSlug}`}
                    className="font-medium text-foreground/80 hover:text-foreground"
                  >
                    {dict.admin.exams.editButton} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewExamForm lang={lang} levelSlugs={levelSlugs} dict={dict.admin.exams} />
    </div>
  );
}
