import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isLevelSlug } from "@/lib/courses";
import { db } from "@/lib/db";
import { isExamSlugFormat, staticExamContent } from "@/lib/exams/content";
import ExamEditor from "@/components/admin/ExamEditor";
import { routeAlternates } from "@/lib/site";

const TEMPLATE = {
  title: "Examen A1 · Lecciones 11 a 20",
  lessonRangeLabel: "Lecciones 11-20",
  skillAreas: [
    {
      id: "cambia-este-id",
      title: "Nombre del área de habilidad",
      exercises: [
        {
          id: "cambia-este-id-mc-1",
          type: "multiple-choice",
          prompt: "Pregunta de ejemplo",
          options: ["opción A", "opción B", "opción C"],
          correctIndex: 0,
        },
        {
          id: "cambia-este-id-fill-1",
          type: "fill-blank",
          before: "текс",
          after: "",
          answers: ["т"],
        },
      ],
    },
  ],
};

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/exams/[level]/[examSlug]">): Promise<Metadata> {
  const { lang, level, examSlug } = await params;
  return { alternates: routeAlternates(lang, `/admin/exams/${encodeURIComponent(level)}/${encodeURIComponent(examSlug)}`) };
}

export default async function AdminExamEditorPage({
  params,
}: PageProps<"/[lang]/admin/exams/[level]/[examSlug]">) {
  const { lang, level, examSlug } = await params;
  if (!isLocale(lang) || !isLevelSlug(level) || !isExamSlugFormat(level, examSlug)) notFound();

  const dict = await getDictionary(lang);

  const customRow = await db.exam.findUnique({
    where: { level_examSlug: { level, examSlug } },
  });
  const staticContent = staticExamContent[examSlug]?.level === level ? staticExamContent[examSlug] : null;

  // The editable JSON only holds title/lessonRangeLabel/skillAreas — level
  // and slug are identity, not content, and always come from the URL (same
  // split as the lesson editor, which never shows level/lessonSlug in its
  // JSON textarea either).
  function editableFields(content: { title: string; lessonRangeLabel: string; skillAreas: unknown }) {
    return { title: content.title, lessonRangeLabel: content.lessonRangeLabel, skillAreas: content.skillAreas };
  }

  const initialValue = customRow
    ? JSON.stringify(JSON.parse(customRow.contentJson), null, 2)
    : staticContent
      ? JSON.stringify(editableFields(staticContent), null, 2)
      : "";
  const templateValue = JSON.stringify(staticContent ? editableFields(staticContent) : TEMPLATE, null, 2);

  return (
    <ExamEditor
      lang={lang}
      level={level}
      examSlug={examSlug}
      hasCustomVersion={Boolean(customRow)}
      initialValue={initialValue}
      templateValue={templateValue}
      dict={dict.admin.exams}
    />
  );
}
