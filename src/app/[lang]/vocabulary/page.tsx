import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { markStudyDayVisit } from "@/lib/study-day-visit";
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
  //
  // Follow-up 29.08.2026: "correctly" was too generous — the sitewide
  // audit found /ru/vocabulary still serving the /ru home page's title and
  // description verbatim, which is the same duplicate the /es copy was
  // fixed for. It gets its own, describing what the Russian page actually
  // is: the card trainer, without the category index.
  if (lang !== "es") {
    return {
      title: "Русские слова по темам: карточки с озвучкой | RusoFácilapp",
      description:
        "Тренажёр русской лексики для испаноговорящих: карточки с транскрипцией, переводом и примером, по темам и уровням от A1 до C1, с интервальным повторением.",
      alternates,
    };
  }
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
  // Opening the card trainer is the study action — answering a card is not
  // required, and before this the whole day could go unrecorded.
  await markStudyDayVisit("flashcards");

  // ES-only, because the category pages themselves are ES-only.
  const showCategoryIndex = lang === "es";

  return (
    <div
      // max-w-3xl, not 2xl: measured at 1024 this column was 672px of
      // content inside a 1024px <main> — 65.6%, i.e. the same "narrow block
      // in a stretched container" this pass is about, just centred instead
      // of left-hugging. 3xl is what /profile and /word-games already use,
      // so this is the site's own column and not a new number.
      className="mx-auto w-full max-w-3xl flex-1 px-6 py-16"
    >
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.vocabulary.pageTitle}</h1>

      <div className="mt-10">
        <VocabularyApp dict={{ ...dict.vocabulary, locale: lang }} resultDict={{ ...dict.gameResult, locale: lang }} />
      </div>

      {/* C1 подписан, но НЕ опубликован. Списки на этой странице и на 23
          категорийных как показывали A1-B2, так и показывают: фильтр
          PUBLIC_VOCABULARY_LEVELS не тронут, C1-карточки по-прежнему
          отсутствуют в отданном HTML, а не спрятаны стилями, и ни одного
          нового URL здесь не появляется. Единственное, что меняется, —
          посетитель больше не должен догадываться, почему списки кончаются
          на B2. Формулировка — действующая формула уровней (PROGRESS 7.76):
          курс A1-B2; словарь, рассказы и игры — до C1. Обе локали: эта
          страница существует и на /ru, в отличие от категорийных. */}
      <aside className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">{dict.vocabulary.c1PremiumHeading}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/70">{dict.vocabulary.c1PremiumBody}</p>
        <Link
          href={`/${lang}/pricing`}
          className="tap mt-3 inline-block text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          {dict.vocabulary.c1PremiumCta}
        </Link>
      </aside>

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
