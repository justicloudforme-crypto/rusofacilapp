import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/gramatica";

/**
 * Index of the /es/gramatica guides. The first three explain a grammar
 * topic the course assumes you already know: measured across all 120
 * lessons, no lesson has "género", "plural" or "verbos reflexivos" in its
 * title — they only ever appear in passing inside lessons about something
 * else (see PROGRESS.md's coverage audit). The glossary defines the terms;
 * these pages explain how they work.
 *
 * The alphabet guide is the exception and breaks that rule deliberately:
 * A1 lesson 1 IS "El alfabeto cirílico y los sonidos del ruso" and already
 * serves the full 33-letter table anonymously. It is here because the
 * search intent differs, not because the topic was unowned — see the long
 * comment in alfabeto-ruso/page.tsx. Do not use it as precedent for adding
 * a guide that merely repeats a lesson.
 *
 * ES-only, like the sopa-de-letras landing pages: the whole method here
 * is comparison against Spanish, so a Russian-interface copy would be
 * the same Spanish text at a second URL for nobody.
 *
 * Three guides matching the topics the coverage audit found unowned by
 * any lesson title, plus the alphabet guide described above.
 */
const GUIDES = [
  {
    href: "/es/gramatica/alfabeto-ruso",
    title: "El alfabeto ruso, por dificultad",
    description:
      "Las 33 letras ordenadas por lo que cuesta reconocerlas: las cinco que ya sabes leer, los seis falsos amigos que se leen mal y las nuevas de verdad.",
  },
  {
    href: "/es/gramatica/genero-sustantivos-ruso",
    title: "El género de los sustantivos",
    description:
      "Tres géneros en vez de dos, y una regla que el español no tiene: la última letra de la palabra casi siempre te dice cuál es.",
  },
  {
    href: "/es/gramatica/plural-sustantivos-ruso",
    title: "El plural de los sustantivos",
    description:
      "Depende del género y, en cuanto aparece un número, también del caso: один стол, два стола, пять столов. Por qué contar lo cambia todo.",
  },
  {
    href: "/es/gramatica/verbos-reflexivos-ruso",
    title: "Los verbos en -ся",
    description:
      "El postfijo hace cuatro trabajos distintos, no solo el reflexivo — casi los mismos que el «se» español, y dos que no se le parecen en nada.",
  },
];

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/gramatica">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Gramática rusa explicada en español | RusoFácilapp",
    description:
      "Guías de gramática rusa escritas para hispanohablantes: cómo funciona cada tema, comparado con el español, con ejemplos en cirílico y su traducción.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function GramaticaHubPage({ params }: PageProps<"/[lang]/gramatica">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");
  const url = `${SITE_URL}/es${PAGE_PATH}`;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Gramática rusa explicada en español",
          description: "Guías de gramática rusa para hispanohablantes.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Gramática rusa", url },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Gramática rusa explicada en español
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Guías sobre los temas que el curso da por sabidos. Cada una explica cómo funciona el tema en
        ruso comparándolo con el español — señalando también dónde esa comparación deja de servir —
        y enlaza a las lecciones donde el tema aparece en la práctica.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {GUIDES.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="tap group flex flex-col gap-1 rounded-2xl border border-black/10 p-5 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
          >
            <h2 className="font-medium">{guide.title}</h2>
            <p className="text-sm leading-6 text-foreground/70">{guide.description}</p>
            <span className="mt-2 text-sm font-medium text-foreground/80 group-hover:text-foreground group-active:text-foreground">
              Leer →
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-10 border-t border-black/10 pt-6 dark:border-white/30">
        <p className="leading-7 text-foreground/70">
          ¿Buscas la definición corta de un término gramatical en vez de una explicación larga? Está
          en el{" "}
          <Link
            href="/es/glossary"
            className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            glosario de gramática rusa
          </Link>
          , con su equivalente en ruso y ejemplos.
        </p>
      </section>
    </div>
  );
}
