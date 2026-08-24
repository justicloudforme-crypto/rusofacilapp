import Link from "next/link";
import { parseRelatedLessonSlug } from "@/lib/glossary";

/** Renders a term's relatedLessons (e.g. ["a1-3", "a2-9"]) as clickable
 * links to the actual lesson pages — shared by the /glossary search page
 * (GlossaryApp) and the in-lesson popover card (GlossaryTermCardBody), so
 * "where does this term come up?" always looks and behaves the same way. */
export default function RelatedLessonsList({
  lessons,
  lang,
  label,
  className,
}: {
  lessons: string[];
  lang: string;
  label: string;
  className?: string;
}) {
  const refs = lessons.map(parseRelatedLessonSlug).filter((ref) => ref !== null);
  if (refs.length === 0) return null;

  // A <span className="block"> rather than a <p> — this renders both
  // standalone on the /glossary page and nested inside the popover card's
  // <span role="tooltip"> wrapper (GlossaryTermCardBody), where a <p>
  // would be invalid HTML nested inside inline elements.
  return (
    <span className={className}>
      <span className="font-medium text-foreground/50">{label}: </span>
      {refs.map((ref, i) => (
        <span key={ref.slug}>
          <Link
            href={`/${lang}/courses/${ref.level}/${ref.lesson}`}
            className="tap font-medium text-brand underline-offset-2 hover:underline active:underline dark:text-brand-light"
          >
            {ref.level.toUpperCase()}-{ref.lesson}
          </Link>
          {i < refs.length - 1 ? <span className="text-foreground/50">, </span> : null}
        </span>
      ))}
    </span>
  );
}
