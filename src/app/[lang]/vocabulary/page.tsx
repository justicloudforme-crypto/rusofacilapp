import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import VocabularyApp from "@/components/flashcards/VocabularyApp";
import JsonLd from "@/components/seo/JsonLd";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";
import { SITE_URL, breadcrumbList, routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/vocabulary">): Promise<Metadata> {
  const { lang } = await params;
  const alternates = routeAlternates(lang, "/vocabulary");
  // Measured on the live site 28.08.2026: this page had no metadata of its
  // own, so it served the layout's fallback — byte-identical <title> and
  // description to the home page and to /es/glossary. It is the entry point
  // to the 23 category pages, and a crawler saw three different pages
  // announcing themselves as the same one. ES only: the /ru copy has no
  // category index below (see showCategoryIndex), so the Russian fallback
  // still describes it correctly.
  if (lang !== "es") return { alternates };
  return {
    title: "Vocabulario ruso por temas, con traducción | RusoFácilapp",
    description:
      "23 listas de vocabulario ruso por tema, del A1 al B2, con transcripción, traducción al español y una frase de ejemplo en cada palabra.",
    alternates,
  };
}

export default async function VocabularyPage({ params }: PageProps<"/[lang]/vocabulary">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.vocabulary) notFound();

  // The card trainer is unchanged and still gated exactly as before. What
  // is new is the server-rendered index below it: measured 28.08.2026,
  // this page served 1174 characters and not one Russian word, so the
  // whole 5683-card bank had no crawlable path into it at all. These are
  // plain <a href>s in the served HTML — the category pages are otherwise
  // reachable only through the client-rendered picker inside VocabularyApp,
  // which a crawler never executes. Same reasoning as the footer glossary
  // link added in PR #44.
  //
  // ES-only, because the category pages themselves are ES-only.
  const showCategoryIndex = lang === "es";

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.vocabulary.pageTitle}</h1>

      <div className="mt-10">
        <VocabularyApp dict={dict.vocabulary} celebrationDict={dict.celebration} resultDict={dict.gameResult} />
      </div>

      {showCategoryIndex && (
        <>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Vocabulario ruso por temas",
              description:
                "Las 23 listas de vocabulario ruso por tema, con transcripción, traducción al español y frase de ejemplo.",
              inLanguage: "es",
              url: `${SITE_URL}/es/vocabulary`,
            }}
          />
          <JsonLd
            data={breadcrumbList([
              { name: "Inicio", url: `${SITE_URL}/es` },
              { name: "Vocabulario ruso", url: `${SITE_URL}/es/vocabulary` },
            ])}
          />

          <section className="mt-14 border-t border-black/10 pt-8 dark:border-white/30">
            <h2 className="text-2xl font-semibold tracking-tight">Vocabulario ruso por temas</h2>
            <p className="mt-3 leading-7 text-foreground/70">
              Cada tema es una lista completa de palabras rusas con su transcripción, su traducción
              al español y una frase de ejemplo, ordenadas por nivel del A1 al B2. Además, cada
              página explica qué es lo que de verdad cuesta de ese vocabulario en concreto: la
              preposición que hay que aprender pegada al sustantivo, el caso que exige un verbo, el
              par de palabras que se confunde siempre.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {VOCABULARY_CATEGORY_PAGES.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/es/vocabulary/${page.slug}`}
                    className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                  >
                    {page.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
