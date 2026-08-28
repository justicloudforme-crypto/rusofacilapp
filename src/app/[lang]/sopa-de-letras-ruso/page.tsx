import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import WhyLearnRussianBlurb from "@/components/word-games/WhyLearnRussianBlurb";
import GameLandingLinks from "@/components/word-games/GameLandingLinks";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/sopa-de-letras-ruso";

// Spanish-search-intent page ("sopa de letras en ruso" / "sopa de letras
// ruso") — no Russian-language equivalent query exists, so this page only
// makes sense in Spanish. /ru 404s rather than serving a translated (and
// pointless) copy — see sitemap.ts's own comment on why this is listed
// for "es" only.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/sopa-de-letras-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Sopa de letras en ruso, gratis y sin registro | RusoFácilapp",
    description:
      "Juega una sopa de letras en ruso directamente en el navegador, sin crear cuenta. Palabras básicas en cirílico con su traducción, ideal para dar tus primeros pasos en el idioma.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function SopaDeLetrasRusoPage({
  params,
}: PageProps<"/[lang]/sopa-de-letras-ruso">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const [dict, user, row] = await Promise.all([
    getDictionary("es"),
    getCurrentUser(),
    // Sequence 6, not 1 — sequence 1 is already the puzzle Google can
    // reach through /es/word-games itself (that page's default tab), so
    // this page embeds a different instance rather than the identical one
    // (see PROGRESS.md's 2026-08-28 entry on avoiding that overlap).
    getPuzzle("WORD_SEARCH", "A1", 6),
  ]);
  if (!row) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Sopa de letras en ruso",
          description: "Sopa de letras jugable en ruso, gratis y sin registro.",
          url: `${SITE_URL}/es${PAGE_PATH}`,
          isAccessibleForFree: true,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Sopa de letras en ruso", url: `${SITE_URL}/es${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sopa de letras en ruso</h1>
      <p className="mt-3 text-foreground/70">
        Busca palabras rusas escondidas en la cuadrícula, letra por letra en alfabeto cirílico. No
        hace falta crear una cuenta — puedes jugar directamente aquí abajo.
      </p>

      <p className="mt-4 leading-7 text-foreground/70">
        El ruso usa el alfabeto cirílico: 33 letras, algunas parecidas al latino pero con otro
        sonido (la В suena como &quot;v&quot;, la Н como &quot;n&quot;, la Р como &quot;r&quot;
        fuerte), y otras completamente nuevas (Ж, Щ, Я, Ю). Encontrar una palabra en esta sopa de
        letras ya es reconocer esas letras en contexto — el mismo ejercicio con el que empieza
        cualquier curso de ruso.
      </p>

      <WhyLearnRussianBlurb />

      <div className="mt-10">
        <WordGamePlayer
          lang="es"
          puzzle={toPublicPuzzle(row)}
          dict={dict.wordGames}
          resultDict={dict.gameResult}
          signedIn={Boolean(user)}
        />
      </div>

      <GameLandingLinks />
    </div>
  );
}
