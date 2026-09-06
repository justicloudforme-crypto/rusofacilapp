import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { GRAMMAR_GUIDES as GUIDES, GRAMMAR_INDEX_PATH } from "@/lib/gramatica/guides";

const PAGE_PATH = GRAMMAR_INDEX_PATH;


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
        <p className="mt-4 leading-7 text-foreground/70">
          ¿Y si lo que falta no es gramática sino saber cómo suenan las letras? Está en{" "}
          <Link
            href="/es/alfabeto-cirilico"
            className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            el alfabeto cirílico, las 33 letras con sonido y ejemplos
          </Link>
          : cada letra con una palabra real donde escucharla y su pronunciación transcrita.
        </p>
      </section>
    </div>
  );
}
