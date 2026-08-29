import { escapeRegExp } from "@/lib/regex";

/**
 * Exam slugs follow "{level}-exam-{n}" (e.g. "a1-exam-2"). Unlike lesson
 * slugs there is no fixed catalog to check against — new exams are created
 * on demand through /admin/exams, not pre-seeded — so this checks the shape
 * only, not that the exam exists yet.
 *
 * Lives here rather than in exams/content.ts because that module is
 * `server-only` (it reaches the database) while the admin form that creates
 * an exam is a client component and needs the same rule. One copy, so the
 * form and the API cannot disagree about what a valid slug is.
 *
 * `level` is escaped even though every caller today validates it with
 * isLevelSlug() first and `&&` short-circuits, so only "a1".."b2" reach
 * here. The safety was living in the call sites, not in the function, whose
 * signature promises nothing beyond `string` — the same shape as
 * isPlausibleShortCode before 30.08.2026 (see src/lib/regex.ts).
 */
export function isExamSlugFormat(level: string, examSlug: string): boolean {
  return new RegExp(`^${escapeRegExp(level)}-exam-[1-9][0-9]*$`).test(examSlug);
}
