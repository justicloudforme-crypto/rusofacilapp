import type { LegalDocument } from "@/lib/legal/content";

/** Shared renderer for /terms and /privacy — both are plain, static legal
 * documents (see src/lib/legal/content.ts), so one dumb presentational
 * component covers both rather than duplicating the same layout twice. */
export default function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-foreground/50">{doc.lastUpdated}</p>
      <p className="mt-6 text-foreground/80">{doc.intro}</p>

      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/75">
              {section.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
