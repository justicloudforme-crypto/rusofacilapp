import Link from "next/link";
import type { ContentInsights } from "@/lib/content-links";
import type { Locale } from "@/i18n/config";

/**
 * Renders the "what's in this text" block. A server component on purpose:
 * GlossaryText.tsx does inline term linking, but it is a client component
 * that fetches the term list in an effect, so its links do not exist in
 * the served HTML and a crawler never sees them. These are plain
 * server-rendered <a href>s — the same reasoning as
 * getGlossaryTermsForLesson in src/lib/content-links.ts.
 *
 * Renders nothing when there is nothing to say, so a page never grows an
 * empty heading.
 */
export default function ContentInsights({
  lang,
  insights,
  dict,
}: {
  lang: Locale;
  insights: ContentInsights;
  dict: {
    vocabHeading: string;
    vocabNote: string;
    grammarHeading: string;
    grammarNote: string;
    exampleLabel: string;
    glossaryAllLink: string;
  };
}) {
  const { vocabulary, grammar } = insights;
  if (vocabulary.length === 0 && grammar.length === 0) return null;

  return (
    <div className="mt-10 border-t border-black/10 pt-8 dark:border-white/30">
      {vocabulary.length > 0 && (
        <section>
          <h2 className="text-lg font-medium">{dict.vocabHeading}</h2>
          <p className="mt-1 text-sm text-foreground/60">{dict.vocabNote}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {vocabulary.map((item) => (
              <li
                key={item.russian}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
              >
                <strong lang="ru" className="font-medium">
                  {item.russian}
                </strong>
                <span className="text-foreground/50">[{item.transcription}]</span>
                <span className="text-foreground/80">— {item.translationEs}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grammar.length > 0 && (
        <section className={vocabulary.length > 0 ? "mt-8" : undefined}>
          <h2 className="text-lg font-medium">{dict.grammarHeading}</h2>
          <p className="mt-1 text-sm text-foreground/60">{dict.grammarNote}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {grammar.map((item) => (
              <li key={item.slug} className="text-sm">
                <Link
                  href={`/${lang}/glossary/${item.slug}`}
                  className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                >
                  {item.term}
                </Link>
                {item.examples.length > 0 && (
                  <span className="text-foreground/60">
                    {" "}
                    — {dict.exampleLabel}{" "}
                    <span lang="ru" className="text-foreground/80">
                      {item.examples.join(", ")}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link
            href={`/${lang}/glossary`}
            className="tap mt-4 inline-block text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            {dict.glossaryAllLink} →
          </Link>
        </section>
      )}
    </div>
  );
}
