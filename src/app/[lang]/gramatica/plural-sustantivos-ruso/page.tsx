import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import RuExample from "@/components/gramatica/RuExample";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/gramatica/plural-sustantivos-ruso";
const GLOSSARY_TERM_PATH = "/es/glossary/numero-gramatical";

// ES-only and intent-split from the glossary entry, for the same reasons
// documented in genero-sustantivos-ruso/page.tsx.
//
// This page has one extra obligation the others don't: the Russian plural
// cannot be taught as a single set of endings. The nominative plural
// (столы/книги/окна) is only the starting form — the moment a number or a
// quantity word appears, the noun switches to a CASE form instead
// (два стола, пять столов). A page that stopped at -ы/-и/-а would leave
// the reader confident and wrong, so the case half is not an appendix
// here: it links to caso-nominativo and caso-genitivo as part of the
// explanation itself.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/gramatica/plural-sustantivos-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "El plural de los sustantivos en ruso: cómo se forma",
    description:
      "El plural ruso depende del género y, si hay un número, también del caso: один стол, два стола, пять столов. La regla base y los irregulares.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function PluralSustantivosRusoPage({
  params,
}: PageProps<"/[lang]/gramatica/plural-sustantivos-ruso">) {
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
          headline: "El plural de los sustantivos en ruso: cómo se forma",
          description:
            "Cómo se forma el plural ruso según el género, qué pasa al contar, y los irregulares que conviene aprender pronto.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          about: {
            "@type": "DefinedTerm",
            name: "número gramatical",
            url: `${SITE_URL}${GLOSSARY_TERM_PATH}`,
          },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Gramática rusa", url: `${SITE_URL}/es/gramatica` },
          { name: "El plural de los sustantivos", url },
        ])}
      />

      <Link
        href="/es/gramatica"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Gramática rusa
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        El plural de los sustantivos en ruso: cómo se forma
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        En español el plural es una sola operación: añadir -s o -es, y ya está para siempre. En ruso
        hay que saber dos cosas antes de formarlo — el género de la palabra y si vas a contar algo —
        y la segunda es la que sorprende a todo el mundo.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">La forma base, según el género</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        El plural de partida (el que aparece cuando el sustantivo es el sujeto de la frase) depende
        del género, así que conviene tenerlo claro antes: si aún dudas, está explicado en la{" "}
        <Link
          href="/es/gramatica/genero-sustantivos-ruso"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          guía sobre el género
        </Link>
        . Los masculinos terminados en consonante añaden -ы —{" "}
        <RuExample ru="стол → столы" es="mesa → mesas" />. Los femeninos en -а cambian esa -а por -ы
        — <RuExample ru="газета → газеты" es="periódico → periódicos" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Los neutros son los que más se salen del patrón: -о pasa a -а, que es justo la terminación
        que en singular marcaría femenino —{" "}
        <RuExample ru="окно → окна" es="ventana → ventanas" />. Y los terminados en -я o en -ь (de
        cualquier género) hacen -и — <RuExample ru="неделя → недели" es="semana → semanas" />,{" "}
        <RuExample ru="словарь → словари" es="diccionario → diccionarios" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Hay además una regla ortográfica que se aplica por encima de todo lo anterior: después de
        las letras г, к, х, ж, ч, ш, щ nunca se escribe -ы, sino -и. Por eso «libro» no hace
        «*книгы» sino <RuExample ru="книга → книги" es="libro → libros" />. No es una excepción de
        vocabulario, es una regla de escritura que verás en muchos otros sitios.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Y entonces llega un número</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Aquí está la diferencia de fondo con el español, y no es un detalle. En español la forma del
        plural es indiferente a la cantidad: «dos libros», «cinco libros» y «cien libros» usan la
        misma palabra. En ruso el sustantivo cambia <strong>tres veces</strong> según el número que
        lo acompaña: <RuExample ru="один стол" es="una mesa" />,{" "}
        <RuExample ru="два стола" es="dos mesas" />, <RuExample ru="пять столов" es="cinco mesas" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Y lo que cambia no es «el plural»: son <strong>casos</strong>. Con 1 el sustantivo va en{" "}
        <Link
          href="/es/glossary/caso-nominativo"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          nominativo
        </Link>{" "}
        singular; con 2, 3 y 4 va en{" "}
        <Link
          href="/es/glossary/caso-genitivo"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          genitivo
        </Link>{" "}
        singular; de 5 en adelante, en genitivo plural. Por eso «два стола» no es un plural: es un
        genitivo singular que en español traducimos como plural. Lo mismo ocurre tras palabras de
        cantidad: <RuExample ru="много книг" es="muchos libros" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Esto significa que el número y el caso viajan siempre juntos dentro de la misma terminación,
        y que aprender solo -ы/-и/-а te deja a medio camino. El genitivo plural, además, es la forma
        más irregular del idioma: los masculinos suelen añadir -ов —{" "}
        <RuExample ru="стол → столов" es="mesa → mesas" /> —, mientras que los femeninos y neutros a
        menudo se quedan sin terminación —{" "}
        <RuExample ru="книга → книг" es="libro → libros" />,{" "}
        <RuExample ru="окно → окон" es="ventana → ventanas" />.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Irregulares que aparecen pronto</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Un grupo de masculinos muy corrientes hace el plural en -а tónica en vez de -ы:{" "}
        <RuExample ru="дом → дома" es="casa → casas" />,{" "}
        <RuExample ru="город → города" es="ciudad → ciudades" />. Y unos pocos cambian de raíz por
        completo, como pasa en español con «el ser humano / la gente»:{" "}
        <RuExample ru="человек → люди" es="persona → personas" />,{" "}
        <RuExample ru="ребёнок → дети" es="niño → niños" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Y hay palabras cuyo número simplemente no coincide entre los dos idiomas, en ninguna
        dirección previsible. <RuExample ru="часы" es="reloj" /> y{" "}
        <RuExample ru="деньги" es="dinero" /> existen solo en plural en ruso, aunque en español sean
        singulares. Aquí no hay regla: se aprenden con su número, igual que en español se aprende
        que «las gafas» no tienen singular.
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/courses/a1/22"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A1, lección 22 — Caso genitivo: cantidad y números
            </Link>
            <span className="text-sm text-foreground/60"> · один стол / два стола / пять столов en detalle</span>
          </li>
          <li>
            <Link
              href="/es/courses/a2/9"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A2, lección 9 — Genitivo de adjetivos y pronombres
            </Link>
            <span className="text-sm text-foreground/60"> · qué hace el adjetivo que acompaña</span>
          </li>
          <li>
            <Link
              href="/es/gramatica/genero-sustantivos-ruso"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Guía: el género de los sustantivos
            </Link>
            <span className="text-sm text-foreground/60"> · lo que hay que saber antes de formar el plural</span>
          </li>
          <li>
            <Link
              href={GLOSSARY_TERM_PATH}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Glosario: número gramatical
            </Link>
            <span className="text-sm text-foreground/60"> · la definición breve del término</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
