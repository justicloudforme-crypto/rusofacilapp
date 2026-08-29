import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import { isGlossaryCategory, parseExamplesJson, parseRelatedLessonsJson } from "@/lib/glossary";
import { attachGlossaryAudio } from "@/lib/glossary-audio";
import GlossaryApp from "@/components/glossary/GlossaryApp";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/glossary">): Promise<Metadata> {
  const { lang } = await params;
  const alternates = routeAlternates(lang, "/glossary");
  // Same fallback-metadata problem the vocabulary hub had (see its own
  // comment): 117 term pages each carry a hand-written title, but the hub
  // they all link back to announced itself with the home page's title.
  if (lang !== "es") return { alternates };
  return {
    title: "Glosario de gramática rusa en español | RusoFácilapp",
    description:
      "Los términos de la gramática rusa explicados en español: caso, aspecto, declinación, verbos de movimiento y más, con su equivalente ruso y ejemplos.",
    alternates,
  };
}

export default async function GlossaryPage({ params }: PageProps<"/[lang]/glossary">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.glossary) notFound();

  // Fetched here (not left to GlossaryApp's old client-side fetch) so the
  // full term list — and every /glossary/[slug] link — is already in the
  // server-rendered HTML on first load, not gated behind a client-only
  // fetch a crawler may never wait for. Same query shape and
  // parse/attach-audio helpers /api/glossary itself uses, just called
  // directly instead of through an extra HTTP round trip.
  const rows = await db.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  const parsed = rows.map((row) => ({
    ...row,
    // isGlossaryCategory guards against a stale/corrupt row's category
    // never matching the known set — falls back to "otros" (the catch-all
    // bucket) rather than letting an unexpected DB value crash the page.
    category: isGlossaryCategory(row.category) ? row.category : ("otros" as const),
    relatedLessons: parseRelatedLessonsJson(row.relatedLessons),
    examples: parseExamplesJson(row.examples),
  }));
  const initialTerms = await attachGlossaryAudio(parsed);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.glossary.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict.glossary.pageSubtitle}</p>

      <div className="mt-10">
        <GlossaryApp dict={dict.glossary} lang={lang} initialTerms={initialTerms} />
      </div>
    </div>
  );
}
