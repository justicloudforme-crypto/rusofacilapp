import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import RuExample from "@/components/gramatica/RuExample";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/gramatica/alfabeto-ruso";
const GLOSSARY_TERM_PATH = "/es/glossary/tema-duro-y-blando";

// ES-only, like the other guides.
//
// IMPORTANT, and different from the first three guides: those were chosen
// because no lesson title owned the topic. This one does have an owner —
// A1 lesson 1 is literally "El alfabeto cirílico y los sonidos del ruso",
// and it serves 8331 characters to an anonymous visitor including a full
// 33-letter table with audio. So this page is NOT filling a content gap
// and must not repeat that table, or the two pages compete for the same
// query with the same material.
//
// The split is by organising principle, which is the whole point:
//   - the lesson lists the alphabet in Cyrillic order, vowels then
//     consonants, as a reference table you consult while studying;
//   - this guide sorts the same 33 letters by how hard they are for a
//     Spanish speaker to RECOGNISE — already readable, false friend,
//     completely new — which is the question someone types into a search
//     box before they have decided to take a course at all.
// Both link to each other, so the visitor who wants the other shape of
// the same information gets there in one click.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/gramatica/alfabeto-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "El alfabeto ruso para hispanohablantes: las 33 letras por dificultad",
    description:
      "Las 33 letras del cirílico ordenadas por lo que te cuesta reconocerlas: las que ya sabes leer, los seis falsos amigos que se leen mal (В, Н, Р, С, У, Х) y las nuevas de verdad.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function AlfabetoRusoPage({
  params,
}: PageProps<"/[lang]/gramatica/alfabeto-ruso">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");
  const url = `${SITE_URL}/es${PAGE_PATH}`;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "El alfabeto ruso para hispanohablantes: las 33 letras por dificultad",
          description:
            "Las 33 letras del cirílico agrupadas por dificultad de reconocimiento para un hispanohablante, con los falsos amigos, los sonidos que el español no tiene y las dos letras mudas.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          about: {
            "@type": "DefinedTerm",
            name: "tema duro y blando",
            url: `${SITE_URL}${GLOSSARY_TERM_PATH}`,
          },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Gramática rusa", url: `${SITE_URL}/es/gramatica` },
          { name: "El alfabeto ruso", url },
        ])}
      />

      <Link
        href="/es/gramatica"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Gramática rusa
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        El alfabeto ruso para hispanohablantes: las 33 letras por dificultad
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        El cirílico asusta menos de lo que parece. De sus 33 letras, varias ya sabes leerlas sin
        haber estudiado nada, y el verdadero problema no son las que te resultan raras — esas se
        aprenden en una tarde — sino las seis que se parecen a letras latinas y suenan distinto.
        Esta guía las ordena por eso, no por el orden del abecedario.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Grupo 1: las cinco que ya sabes leer
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong lang="ru">А, К, М, О, Т</strong> se escriben como en el alfabeto latino y suenan
        igual. Con solo estas cinco ya puedes leer palabras enteras y acertar:{" "}
        <RuExample ru="кот" es="gato" />, <RuExample ru="мак" es="amapola" />,{" "}
        <RuExample ru="том" es="tomo, volumen" />. No es casualidad: vienen del alfabeto griego,
        igual que las latinas.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Grupo 2: los seis falsos amigos
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Aquí está casi todo el error del principiante: estas seis letras existen en el alfabeto
        latino, tu ojo las lee automáticamente y se equivoca cada vez.{" "}
        <strong lang="ru">В</strong> no es «b» sino «v»; <strong lang="ru">Н</strong> no es «h» sino
        «n»; <strong lang="ru">Р</strong> no es «p» sino una «r» vibrante como la de{" "}
        <em>perro</em>; <strong lang="ru">С</strong> no es «c» sino «s»;{" "}
        <strong lang="ru">У</strong> no es «y» sino «u»; y <strong lang="ru">Х</strong> no es
        «equis» sino una «j» aspirada como la de <em>jamón</em>.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Vale la pena verlas dentro de palabras que ya reconoces, porque el efecto es inmediato:{" "}
        <RuExample ru="Москва" es="Moscú" /> no es «Mockba»,{" "}
        <RuExample ru="ресторан" es="restaurante" /> no empieza por «p», y{" "}
        <RuExample ru="хорошо" es="bien" /> empieza por el mismo sonido que <em>jota</em>; y{" "}
        <RuExample ru="суп" es="sopa" /> se lee «sup», no «cyn».
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Añade una séptima con truco: <strong lang="ru">Е</strong> se escribe como la «e» latina
        pero se lee «ye», como en <em>yema</em>. Por eso <RuExample ru="нет" es="no" /> suena
        «niet», que es justo como se transcribe esa palabra en español.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Grupo 3: las nuevas de verdad
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Las 21 restantes —{" "}
        <strong lang="ru">Б, Г, Д, Ё, Ж, З, И, Й, Л, П, Ф, Ц, Ч, Ш, Щ, Ъ, Ы, Ь, Э, Ю, Я</strong> —
        no se parecen a nada latino, y por eso dan menos problemas: no hay lectura automática que
        corregir. La mayoría corresponde a un sonido que el español ya tiene —{" "}
        <strong lang="ru">Б</strong> «b», <strong lang="ru">Д</strong> «d»,{" "}
        <strong lang="ru">П</strong> «p», <strong lang="ru">Л</strong> «l»,{" "}
        <strong lang="ru">Ф</strong> «f» — y con ellas salen palabras transparentes:{" "}
        <RuExample ru="папа" es="papá" />, <RuExample ru="лампа" es="lámpara" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Cuatro de este grupo son vocales «yodizadas»: <strong lang="ru">Я</strong> («ia»),{" "}
        <strong lang="ru">Ю</strong> («iu»), <strong lang="ru">Ё</strong> («io») y la ya citada{" "}
        <strong lang="ru">Е</strong>. Suenan como la vocal precedida de una i breve, como en{" "}
        <em>ciudad</em>: <RuExample ru="я" es="yo" />,{" "}
        <RuExample ru="юг" es="sur" />, <RuExample ru="ёлка" es="abeto" />. Y ojo con{" "}
        <strong lang="ru">Г</strong>, que es siempre la «g» suave de <em>gato</em>, nunca la de{" "}
        <em>gente</em>: <RuExample ru="город" es="ciudad" /> se lee «górad».
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Los sonidos que el español no tiene
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Cinco letras cubren las <strong>sibilantes</strong>, la familia de sonidos que de verdad hay
        que aprender de oído. <strong lang="ru">Ш</strong> es una «sh» inglesa,{" "}
        <strong lang="ru">Ж</strong> es esa «sh» pero sonora, como la <em>ll</em> rioplatense;{" "}
        <strong lang="ru">Ч</strong> es la «ch» de <em>chico</em>,{" "}
        <strong lang="ru">Щ</strong> una «sh» larga y más blanda, y{" "}
        <strong lang="ru">Ц</strong> es «ts», como en el italiano <em>pizza</em>. Aparecen desde el
        primer día:{" "}
        <RuExample ru="шапка" es="gorro" />, <RuExample ru="жена" es="esposa" />,{" "}
        <RuExample ru="цена" es="precio" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        La diferencia entre <strong lang="ru">Ш</strong> y <strong lang="ru">Щ</strong> distingue
        palabras reales, no es un detalle fino: compara{" "}
        <RuExample ru="наш" es="nuestro" /> con{" "}
        <RuExample ru="борщ" es="borsch (sopa de remolacha)" />. Aquí el español no ayuda y hay que
        escuchar.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Y luego está <strong lang="ru">Ы</strong>, la letra que ningún hispanohablante pronuncia
        bien a la primera. No es una «i» ni una «u»: es una «i» con la lengua echada hacia atrás,
        como si sonrieras con la boca tensa. Importa porque separa singular de plural en muchísimos
        sustantivos: <RuExample ru="стол" es="mesa" /> frente a{" "}
        <RuExample ru="столы" es="mesas" />. Y distingue verbos que no tienen nada que ver:{" "}
        <RuExample ru="быть" es="ser, estar" /> frente a{" "}
        <RuExample ru="бить" es="golpear" />.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Las dos letras que no suenan: ъ y ь
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong lang="ru">Ь</strong> (signo blando) y <strong lang="ru">Ъ</strong> (signo duro) no
        tienen sonido propio: modifican la consonante de al lado. El blando la «ablanda», como si
        le siguiera una i muy breve — algo parecido a la distancia española entre <em>n</em> y{" "}
        <em>ñ</em>. No es decorativo, cambia el significado:{" "}
        <RuExample ru="мать" es="madre" /> lo lleva y <RuExample ru="мат" es="jaque mate" /> no.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Esa oposición entre consonante blanda y dura recorre toda la gramática rusa: decide
        terminaciones de sustantivos y adjetivos, no solo la pronunciación. El signo duro es
        rarísimo y aparece sobre todo tras un prefijo, como en{" "}
        <RuExample ru="объявление" es="anuncio" />, para avisar de que la vocal siguiente no
        ablanda nada.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Dos avisos antes de leer tu primera palabra
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Primero, el acento no se escribe pero manda: la <strong lang="ru">о</strong> átona no suena
        «o», suena «a». Es el <em>ákanie</em>, y explica por qué{" "}
        <RuExample ru="молоко" es="leche" /> se pronuncia «malakó». Si lees las oes como oes, se te
        entiende, pero suena a extranjero desde la primera sílaba.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Segundo, la <strong lang="ru">ё</strong> casi nunca se imprime con sus dos puntos: los
        libros escriben «е» y dan por hecho que sabes cuál es. Siempre lleva el acento, así que
        verla escrita de verdad te regala esa información: <RuExample ru="ёж" es="erizo" />.
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/courses/a1/1"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A1, lección 1 — El alfabeto cirílico y los sonidos del ruso
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · la tabla completa de las 33 letras en orden, con audio de cada una
            </span>
          </li>
          <li>
            <Link
              href="/es/sopa-de-letras-alfabeto-cirilico"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Sopa de letras del alfabeto cirílico
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · para practicar el reconocimiento jugando, sin registro
            </span>
          </li>
          <li>
            <Link
              href={GLOSSARY_TERM_PATH}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Glosario: tema duro y blando
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · qué consecuencias gramaticales tiene la oposición de ь
            </span>
          </li>
          <li>
            <Link
              href="/es/gramatica/genero-sustantivos-ruso"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              El género de los sustantivos
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · la última letra decide el género, y ь es el caso ambiguo
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
