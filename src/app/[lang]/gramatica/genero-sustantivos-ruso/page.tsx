import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import RuExample from "@/components/gramatica/RuExample";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/gramatica/genero-sustantivos-ruso";
const GLOSSARY_TERM_PATH = "/es/glossary/genero-gramatical";

// ES-only, same reasoning as the sopa-de-letras landing pages: this is
// written for a Spanish-language search intent ("género de los
// sustantivos en ruso") that has no Russian-language equivalent, and its
// whole method is comparison against Spanish. A /ru copy would be the
// same Spanish text at a second URL for nobody.
//
// The title is deliberately NOT interchangeable with the glossary entry's
// (/es/glossary/genero-gramatical, "género gramatical en ruso — glosario
// de gramática"): that page answers "what does this term mean", this one
// answers "how does it work and how do I recognise it". Both are linked
// to each other, and this page's JSON-LD points `about` at the term, so
// the pair reads as definition + explanation rather than as duplicates.
// No canonical between them on purpose — they are not the same page, and
// declaring one would just drop the other out of the index.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/gramatica/genero-sustantivos-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "El género de los sustantivos en ruso: cómo reconocerlo",
    description:
      "El ruso tiene tres géneros y, a diferencia del español, casi siempre se adivinan por la última letra de la palabra. La regla, las excepciones que importan y por qué el género cambia el verbo en pasado.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function GeneroSustantivosRusoPage({
  params,
}: PageProps<"/[lang]/gramatica/genero-sustantivos-ruso">) {
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
          headline: "El género de los sustantivos en ruso: cómo reconocerlo",
          description:
            "Los tres géneros del ruso, cómo reconocerlos por la terminación, las excepciones y por qué el género afecta al verbo en pasado.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          // Machine-readable "this article is about that defined term" —
          // the other half of the definition/explanation split described
          // in generateMetadata's comment above.
          about: {
            "@type": "DefinedTerm",
            name: "género gramatical",
            url: `${SITE_URL}${GLOSSARY_TERM_PATH}`,
          },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Gramática rusa", url: `${SITE_URL}/es/gramatica` },
          { name: "El género de los sustantivos", url },
        ])}
      />

      <Link
        href="/es/gramatica"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Gramática rusa
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        El género de los sustantivos en ruso: cómo reconocerlo
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        En español el género hay que memorizarlo palabra por palabra. En ruso, casi siempre se ve a
        simple vista: la última letra del sustantivo te lo dice. Es una de las pocas cosas del ruso
        que resulta más fácil que en español.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Son tres, no dos</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        El español tiene masculino y femenino. El ruso añade un tercero, el <strong>neutro</strong>,
        que no existe en español y que no corresponde a nada «sin sexo»: es simplemente una tercera
        categoría gramatical. Así, <RuExample ru="стол" es="mesa" /> es masculino,{" "}
        <RuExample ru="книга" es="libro" /> es femenino y <RuExample ru="окно" es="ventana" /> es
        neutro.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Fíjate en esos tres ejemplos, porque enseñan algo importante de golpe: el género de la
        palabra española <em>no predice</em> el de la rusa. «Mesa» es femenino en español y{" "}
        <RuExample ru="стол" es="mesa" /> es masculino en ruso; «libro» es masculino y{" "}
        <RuExample ru="книга" es="libro" /> es femenino. No hay ninguna correspondencia que puedas
        aprovechar, ni siquiera en palabras que se parecen: <RuExample ru="проблема" es="problema" />{" "}
        es femenina en ruso, aunque en español «el problema» sea masculino.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">La regla: mira la última letra</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        En su forma de diccionario, un sustantivo ruso termina de una de estas maneras, y eso basta
        para saber su género en la gran mayoría de los casos:
      </p>
      <ul className="mt-4 flex flex-col gap-2.5 leading-7 text-foreground/80">
        <li>
          <strong>Consonante → masculino.</strong> <RuExample ru="дом" es="casa" />,{" "}
          <RuExample ru="журнал" es="revista" />, <RuExample ru="хлеб" es="pan" />.
        </li>
        <li>
          <strong>-а / -я → femenino.</strong> <RuExample ru="вода" es="agua" />,{" "}
          <RuExample ru="неделя" es="semana" />, <RuExample ru="сестра" es="hermana" />.
        </li>
        <li>
          <strong>-о / -е → neutro.</strong> <RuExample ru="письмо" es="carta" />,{" "}
          <RuExample ru="море" es="mar" />, <RuExample ru="слово" es="palabra" />.
        </li>
      </ul>
      <p className="mt-4 leading-7 text-foreground/80">
        Y aquí está la ventaja real frente al español: el ruso <strong>no tiene artículos</strong>.
        No existe «el/la», así que no hay ningún artículo que memorizar junto a la palabra — pero
        tampoco hay ninguno en el que apoyarse. Toda la información de género viaja dentro de la
        propia palabra. Cuando aprendes <RuExample ru="молоко" es="leche" />, la terminación -о ya te
        está diciendo que es neutro, sin que nadie te lo tenga que enseñar aparte.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Las excepciones que sí importan</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        La primera es fácil de aceptar porque el español hace lo mismo: cuando la palabra designa a
        una persona de sexo masculino, gana el significado y no la terminación. Por eso{" "}
        <RuExample ru="папа" es="papá" />, <RuExample ru="дядя" es="tío" /> y{" "}
        <RuExample ru="мужчина" es="hombre" /> son masculinos pese a terminar en -а/-я, igual que en
        español «el papa» o «el poeta» son masculinos pese a la -a.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        La segunda es la única que de verdad hay que estudiar: las palabras acabadas en{" "}
        <strong>-ь</strong> (signo blando) pueden ser masculinas o femeninas, y la terminación no lo
        aclara. <RuExample ru="день" es="día" /> es masculino;{" "}
        <RuExample ru="ночь" es="noche" /> es femenino. Estas hay que aprenderlas con su género,
        como se aprende «la mano» en español.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Dentro de ese grupo, dos atajos te cubren buena parte: si la palabra termina en{" "}
        <strong>-жь, -шь, -чь, -щь</strong>, es siempre femenina —{" "}
        <RuExample ru="вещь" es="cosa" />, <RuExample ru="дочь" es="hija" />. Y si termina en{" "}
        <strong>-ость</strong>, también siempre femenina —{" "}
        <RuExample ru="новость" es="noticia" />. Queda un resto que se memoriza uno a uno, y no es
        tan grande como parece al principio.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Por qué esto no es un detalle teórico
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        En español el género apenas afecta a los verbos. En ruso sí, y de forma muy visible: el{" "}
        <strong>pasado concuerda en género</strong>, no en persona. El mismo verbo cambia según quién
        habla: <RuExample ru="я читал" es="yo leí (hombre)" /> frente a{" "}
        <RuExample ru="я читала" es="yo leí (mujer)" />. Con un sujeto neutro aparece la tercera
        forma: <RuExample ru="письмо было длинным" es="la carta era larga" />. Esto se estudia a
        fondo en la lección 15 del nivel A1, y es el momento en que el género deja de ser una
        etiqueta y empieza a cambiar frases enteras.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Lo mismo pasa con todo lo que acompaña al sustantivo. El adjetivo concuerda —{" "}
        <RuExample ru="новый дом" es="casa nueva" />, <RuExample ru="новая книга" es="libro nuevo" />
        , <RuExample ru="новое окно" es="ventana nueva" /> —, y también el superlativo:{" "}
        <RuExample ru="самая интересная книга" es="el libro más interesante" />. Y el pronombre
        relativo который toma el género del sustantivo al que se refiere:{" "}
        <RuExample ru="книга, которая лежит на столе" es="el libro que está sobre la mesa" />.
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/courses/a1/15"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A1, lección 15 — El pasado de los verbos rusos
            </Link>
            <span className="text-sm text-foreground/60"> · donde el género empieza a cambiar el verbo</span>
          </li>
          <li>
            <Link
              href="/es/courses/a2/2"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A2, lección 2 — El pasado y el futuro
            </Link>
            <span className="text-sm text-foreground/60"> · la concordancia de быть en pasado</span>
          </li>
          <li>
            <Link
              href="/es/courses/a2/21"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A2, lección 21 — Grado superlativo de los adjetivos
            </Link>
            <span className="text-sm text-foreground/60"> · самый/самая/самое concordando</span>
          </li>
          <li>
            <Link
              href="/es/courses/b1/26"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B1, lección 26 — Oraciones de relativo con который
            </Link>
            <span className="text-sm text-foreground/60"> · concordancia con el antecedente</span>
          </li>
          <li>
            <Link
              href={GLOSSARY_TERM_PATH}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Glosario: género gramatical
            </Link>
            <span className="text-sm text-foreground/60"> · la definición breve del término</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
