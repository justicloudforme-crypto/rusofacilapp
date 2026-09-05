import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import WhyLearnRussianBlurb from "@/components/word-games/WhyLearnRussianBlurb";
import GameLandingLinks from "@/components/word-games/GameLandingLinks";
import FreePuzzleIndex from "@/components/word-games/FreePuzzleIndex";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { getFreeSequences } from "@/lib/word-games/data";
import { TOPIC_LANDINGS, landingPath } from "@/lib/word-games/topic-landings";

const PAGE_PATH = "/juegos-para-aprender-ruso";

// The entry page for "juegos para aprender ruso" and the queries around it.
//
// ES-only, and that is a measurement rather than a preference: all ten
// game pages under /es are Spanish-search-intent pages (each one calls
// notFound() for any other locale and each is listed in sitemap.ts's
// esOnlyPaths, not looped over `locales`), because they explain Russian BY
// comparing it to Spanish and no Russian-language equivalent query exists
// — a Russian reader looking for word games is already inside the product
// and lands on /ru/word-games, which since 02.09.2026 carries the whole
// free sample server-rendered. Adding a /ru copy here would put the same
// Spanish reasoning under a Russian URL and would compete with
// /ru/word-games for the same visitors. See PROGRESS.md 7.93.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/juegos-para-aprender-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Juegos para aprender ruso, gratis y sin registro | RusoFácilapp",
    description:
      "Sopas de letras y crucigramas en ruso para jugar en el navegador, gratis y sin cuenta: 80 puzles por niveles A1-B2 y seis tableros temáticos.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

const GAMES = [
  {
    href: "/es/sopa-de-letras-ruso",
    title: "Sopa de letras en ruso",
    description:
      "Encuentra palabras rusas escondidas en la cuadrícula, letra por letra en cirílico. Es el juego con el que conviene empezar: no hay que escribir nada, solo reconocer la forma escrita de una palabra que ya se ha oído.",
  },
  {
    href: "/es/crucigramas-ruso-principiantes",
    title: "Crucigrama de ruso para principiantes",
    description:
      "Pistas en español, respuestas en cirílico — aquí hay que recordar y escribir cada letra, no solo reconocerla. El teclado en pantalla muestra únicamente las letras que existen en ruso.",
  },
  {
    href: "/es/sopa-de-letras-alfabeto-cirilico",
    title: "Sopa de letras del alfabeto cirílico",
    description:
      "22 palabras elegidas para que aparezcan casi todas las letras del alfabeto ruso al menos una vez. Sirve como primer contacto con el abecedario, antes de cualquier vocabulario.",
  },
];

export default async function JuegosParaAprenderRusoPage({
  params,
}: PageProps<"/[lang]/juegos-para-aprender-ruso">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const [dict, freeByPair] = await Promise.all([getDictionary("es"), getFreeSequences()]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Juegos para aprender ruso",
          description:
            "Sopas de letras y crucigramas en ruso, gratis y sin registro, ordenados por nivel y por tema.",
          url: `${SITE_URL}/es${PAGE_PATH}`,
          isAccessibleForFree: true,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Juegos para aprender ruso", url: `${SITE_URL}/es${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Juegos para aprender ruso</h1>
      <p className="mt-3 text-lg leading-8 text-foreground/70">
        Dos tipos de juego, ochenta puzles gratuitos y ningún registro: se abren en el navegador y
        se juegan en el momento. Todos usan vocabulario ruso real, agrupado por nivel y, en la
        mayoría de los casos, por tema. Los gratuitos van de A1 a B2; con Premium el catálogo
        llega hasta el C1.
      </p>

      <p className="mt-4 leading-7 text-foreground/70">
        Jugar no sustituye a estudiar, pero resuelve un problema concreto del ruso que las listas
        de vocabulario no resuelven: el alfabeto. Un hispanohablante puede repetir cien veces
        &quot;spasiba&quot; y seguir sin reconocer <span lang="ru">спасибо</span> escrito, porque lo
        que ha memorizado es una transcripción latina, no la palabra. En una sopa de letras no hay
        transcripción posible — la palabra está en la cuadrícula en cirílico o no está —, así que
        cada hallazgo es una lectura de verdad. El crucigrama va un paso más allá y obliga a
        escribir: ahí es donde se descubre si uno distingue <span lang="ru">и</span> de{" "}
        <span lang="ru">н</span>, o <span lang="ru">ш</span> de <span lang="ru">щ</span>.
      </p>

      <p className="mt-4 leading-7 text-foreground/70">
        Por eso el orden de esta página no es casual. La sopa de letras solo pide reconocer; el
        crucigrama pide producir; y el tablero del alfabeto está pensado para quien todavía no
        tiene vocabulario ninguno y necesita ver las 33 letras en contexto antes que nada. Si no
        sabes por dónde empezar, empieza por arriba.
      </p>

      <p className="mt-4 leading-7 text-foreground/70">
        Y si el tablero del alfabeto se te hace cuesta arriba porque todavía no sabes qué suena
        cada letra, mira antes{" "}
        <Link
          href="/es/alfabeto-cirilico"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          el alfabeto cirílico con sonido y ejemplos
        </Link>
        : las 33 letras, a qué se parece cada una en español y una palabra donde escucharla.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {GAMES.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="tap group flex flex-col gap-1 rounded-2xl border border-black/10 p-5 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
          >
            <h2 className="font-medium">{game.title}</h2>
            <p className="text-sm leading-6 text-foreground/70">{game.description}</p>
            <span className="mt-2 text-sm font-medium text-foreground/80 group-hover:text-foreground group-active:text-foreground">
              Jugar →
            </span>
          </Link>
        ))}
      </div>

      {/* The six themed boards. Before 04.09.2026 they hung off
          /es/sopa-de-letras-ruso and nothing else — one inbound link each,
          measured on production. */}
      <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/30">
        <h2 className="text-xl font-semibold tracking-tight">Sopas de letras por temas</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Seis cuadrículas hechas con vocabulario de un solo campo, cada una con la lista completa
          de palabras y una explicación de cómo se comportan esas palabras en ruso.
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

      {/* The whole free catalogue, server-rendered, no JavaScript — the
          same component /es/word-games uses, with copy of its own so the
          two pages do not repeat a paragraph word for word. This is what
          makes the hub a real entry point rather than a menu of three:
          every free puzzle a visitor can play is one click from here,
          crosswords included. */}
      <FreePuzzleIndex
        lang="es"
        dict={{
          freeSampleTitle: "Los 80 puzles gratuitos, uno por uno",
          // «de cada nivel» era falso: los niveles del sitio son cinco y
          // el C1 no tiene ni un solo puzle gratuito
          // (isFreeWordGamePuzzle: level !== "C1" && sequence <= 10). Diez
          // por tipo y por nivel en cuatro niveles son exactamente los 80
          // que anuncia el título de al lado.
          freeSampleIntro:
            "Los diez primeros de cada uno de los cuatro niveles de A1 a B2, en sopa de letras y en crucigrama, se juegan sin cuenta y sin suscripción. Aquí están todos, por tipo y por nivel.",
          typeWordSearch: dict.wordGames.typeWordSearch,
          typeCrossword: dict.wordGames.typeCrossword,
          puzzleLabel: dict.wordGames.puzzleLabel,
        }}
        available={(type, level) => freeByPair.get(`${type}:${level}`)}
      />

      <WhyLearnRussianBlurb plural />

      <GameLandingLinks current="hub" />
    </div>
  );
}
