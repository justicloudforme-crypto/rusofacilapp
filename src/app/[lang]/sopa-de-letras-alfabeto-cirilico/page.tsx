import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { ALPHABET_SHOWCASE_PUZZLE } from "@/lib/word-games/alphabetShowcasePuzzle";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import WhyLearnRussianBlurb from "@/components/word-games/WhyLearnRussianBlurb";
import GameLandingLinks from "@/components/word-games/GameLandingLinks";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { wordGamePlayerDict } from "@/lib/word-games/player-dict";

const PAGE_PATH = "/sopa-de-letras-alfabeto-cirilico";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/sopa-de-letras-alfabeto-cirilico">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Sopa de letras del alfabeto cirílico | RusoFácilapp",
    description:
      "Aprende a reconocer las letras del alfabeto ruso jugando: sopa de letras con 22 palabras básicas que cubren 32 de las 33 letras del cirílico, sin registro.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function AlfabetoCirilicoPage({
  params,
}: PageProps<"/[lang]/sopa-de-letras-alfabeto-cirilico">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const [dict, user] = await Promise.all([getDictionary("es"), getCurrentUser()]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Sopa de letras del alfabeto cirílico",
          description: "Sopa de letras jugable para aprender el alfabeto ruso, gratis y sin registro.",
          url: `${SITE_URL}/es${PAGE_PATH}`,
          isAccessibleForFree: true,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Sopa de letras del alfabeto cirílico", url: `${SITE_URL}/es${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Sopa de letras del alfabeto cirílico
      </h1>
      <p className="mt-3 text-foreground/70">
        22 palabras básicas en ruso, elegidas para que aparezcan casi todas las letras del
        alfabeto cirílico al menos una vez. Encuéntralas en la cuadrícula — no hace falta saber
        ruso de antemano, solo reconocer las letras.
      </p>

      <h2 className="mt-8 text-lg font-medium">Qué letras vas a reconocer</h2>
      <p className="mt-2 leading-7 text-foreground/70">
        El alfabeto cirílico tiene 33 letras. Unas 12 se escriben igual o casi igual que en latín y
        suenan parecido (А, О, К, М, Т...). Otro grupo se escribe como una letra latina pero suena
        distinto — son las que más confunden al principio: <strong>В</strong> suena &quot;v&quot;,{" "}
        <strong>Н</strong> suena &quot;n&quot;, <strong>Р</strong> es una &quot;r&quot; fuerte,{" "}
        <strong>С</strong> es &quot;s&quot;, <strong>У</strong> es &quot;u&quot;, y{" "}
        <strong>Х</strong> es una &quot;j&quot; aspirada. El resto —{" "}
        <strong>Б, Г, Д, Ж, З, Л, П, Ф, Ц, Ч, Ш, Щ, Э, Ю, Я</strong> y algunas más— no existen en
        el alfabeto latino y hay que aprenderlas desde cero. Esta sopa de letras usa las 22
        palabras de la lista para que las veas en contexto real, no como una tabla suelta.{" "}
        <Link
          href="/es/gramatica/alfabeto-ruso"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          La guía completa del alfabeto, grupo por grupo
        </Link>{" "}
        desarrolla esta misma división con ejemplos de cada letra.
      </p>

      <h2 className="mt-8 text-lg font-medium">La letra que falta en el juego: ъ</h2>
      <p className="mt-2 leading-7 text-foreground/70">
        El juego cubre 32 de las 33 letras — la excepción es <strong>ъ</strong> (el signo duro),
        que no tiene sonido propio y casi nunca aparece en palabras cortas o básicas, así que
        forzarla en la lista habría dado una palabra artificial. Su función es separar: marca que
        una consonante y la vocal que sigue se pronuncian por separado, sin fundirse. Por ejemplo,
        en <strong>подъезд</strong> (la entrada de un edificio), el <strong>ъ</strong> entre
        &quot;под-&quot; y &quot;-езд&quot; evita que esas dos partes se lean pegadas.
      </p>

      <WhyLearnRussianBlurb />

      <div className="mt-10">
        <WordGamePlayer
          lang="es"
          puzzle={ALPHABET_SHOWCASE_PUZZLE}
          dict={wordGamePlayerDict(dict)}
          resultDict={{ ...dict.gameResult, locale: lang }}
          signedIn={Boolean(user)}
        />
      </div>

      <GameLandingLinks current="alfabeto" />
    </div>
  );
}
