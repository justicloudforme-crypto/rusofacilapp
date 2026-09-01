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

const PAGE_PATH = "/crucigramas-ruso-principiantes";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/crucigramas-ruso-principiantes">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Crucigrama de ruso para principiantes, gratis | RusoFácilapp",
    description:
      "Resuelve un crucigrama en ruso con pistas en español, pensado para quien recién empieza. Juega sin cuenta y comprueba tus respuestas al instante.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function CrucigramasRusoPrincipiantesPage({
  params,
}: PageProps<"/[lang]/crucigramas-ruso-principiantes">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const [dict, user, row] = await Promise.all([
    getDictionary("es"),
    getCurrentUser(),
    getPuzzle("CROSSWORD", "A1", 6),
  ]);
  if (!row) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Crucigrama de ruso para principiantes",
          description: "Crucigrama jugable en ruso con pistas en español, gratis y sin registro.",
          url: `${SITE_URL}/es${PAGE_PATH}`,
          isAccessibleForFree: true,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Crucigrama de ruso para principiantes", url: `${SITE_URL}/es${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Crucigrama de ruso para principiantes
      </h1>
      <p className="mt-3 text-foreground/70">
        Cada pista está en español; la respuesta se escribe letra por letra en cirílico. A
        diferencia de la sopa de letras (donde solo hay que reconocer una palabra ya escrita), aquí
        hace falta recordar y escribir cada letra — un paso más cerca de leer y escribir ruso de
        verdad. Sin cuenta, sin límite de intentos.
      </p>

      <p className="mt-4 leading-7 text-foreground/70">
        Si nunca escribiste en cirílico: cada casilla es una letra rusa, no una sílaba ni una
        palabra latina transcrita. El teclado en pantalla te muestra solo las letras que existen en
        ruso, así que no hace falta memorizar el alfabeto entero para empezar a jugar.
      </p>

      <WhyLearnRussianBlurb />

      <div className="mt-10">
        <WordGamePlayer
          lang="es"
          puzzle={toPublicPuzzle(row)}
          dict={dict.wordGames}
          resultDict={{ ...dict.gameResult, locale: lang }}
          signedIn={Boolean(user)}
        />
      </div>

      <GameLandingLinks />
    </div>
  );
}
