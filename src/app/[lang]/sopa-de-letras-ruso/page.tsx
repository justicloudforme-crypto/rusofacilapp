import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import WhyLearnRussianBlurb from "@/components/word-games/WhyLearnRussianBlurb";
import GameLandingLinks from "@/components/word-games/GameLandingLinks";
import { TOPIC_LANDINGS, GENERIC_SOPA_PUZZLE, landingPath } from "@/lib/word-games/topic-landings";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { wordGamePlayerDict } from "@/lib/word-games/player-dict";

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
    // Since 02.09.2026 this page is the hub for six themed landings
    // (/es/sopa-de-letras-ruso-comida and friends). Its own title and
    // first paragraph deliberately promise the CHOICE of themes and a
    // starter grid, not any one theme — otherwise it would compete with
    // its own children for "sopa de letras de comida en ruso" while
    // answering that query worse than they do.
    title: "Sopa de letras en ruso, gratis y por temas | RusoFácilapp",
    description:
      "Juega sopas de letras en ruso en el navegador, sin crear cuenta: una para empezar y seis por temas — comida, familia, ropa, ciudad, clima y compras.",
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
    // The coordinate is a shared constant because the six themed landings
    // must avoid embedding this same grid — see getLandingPuzzleForTopic.
    getPuzzle(GENERIC_SOPA_PUZZLE.type, GENERIC_SOPA_PUZZLE.level, GENERIC_SOPA_PUZZLE.sequence),
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
        hace falta crear una cuenta — puedes jugar aquí abajo, o ir directamente al tema que te
        interese: cada uno tiene su propia sopa de letras hecha solo con palabras de ese campo.
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
          dict={wordGamePlayerDict(dict)}
          resultDict={{ ...dict.gameResult, locale: lang }}
          signedIn={Boolean(user)}
        />
      </div>

      {/* The hub block. Server-rendered <a> elements, so the six themed
          landings are discoverable by a crawler and not only through the
          sitemap — they are new URLs with no other inbound link. */}
      <section className="mt-12 border-t border-black/10 pt-6 dark:border-white/30">
        <h2 className="text-xl font-semibold tracking-tight">Sopas de letras por temas</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Seis cuadrículas, cada una con vocabulario de un solo campo y con la lista completa de
          palabras debajo.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {TOPIC_LANDINGS.map((landing) => (
            <li key={landing.slug}>
              <Link
                href={`/es${landingPath(landing)}`}
                className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                {landing.h1}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <GameLandingLinks current="sopa" />
    </div>
  );
}
