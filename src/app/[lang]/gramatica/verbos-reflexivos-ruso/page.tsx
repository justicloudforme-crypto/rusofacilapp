import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import RuExample from "@/components/gramatica/RuExample";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/gramatica/verbos-reflexivos-ruso";
const GLOSSARY_TERM_PATH = "/es/glossary/verbo-reflexivo-sya";

// ES-only and intent-split from the glossary entry, same reasons as the
// other two guides.
//
// This is the guide where the Spanish comparison pays off most: Spanish
// "se" carries almost exactly the same four jobs as Russian -ся, so the
// page leans on that instead of presenting -ся as something exotic — and
// then names the two places where the parallel genuinely breaks (a -ся
// verb can never take a direct object; the postfix is glued to the verb
// and never moves).
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/gramatica/verbos-reflexivos-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Los verbos en -ся en ruso: qué significan de verdad",
    description:
      "El postfijo -ся hace cuatro trabajos distintos: reflexivo, recíproco, pasivo y verbos que solo existen así. Casi los mismos que el «se» español — y los dos sitios donde esa comparación deja de servir.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function VerbosReflexivosRusoPage({
  params,
}: PageProps<"/[lang]/gramatica/verbos-reflexivos-ruso">) {
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
          headline: "Los verbos en -ся en ruso: qué significan de verdad",
          description:
            "Los cuatro significados del postfijo -ся, comparados con el «se» español, y las dos diferencias que no se pueden trasladar.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          about: {
            "@type": "DefinedTerm",
            name: "verbo reflexivo (con -ся)",
            url: `${SITE_URL}${GLOSSARY_TERM_PATH}`,
          },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Gramática rusa", url: `${SITE_URL}/es/gramatica` },
          { name: "Los verbos en -ся", url },
        ])}
      />

      <Link
        href="/es/gramatica"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Gramática rusa
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Los verbos en -ся en ruso: qué significan de verdad
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Casi todos los manuales traducen -ся como «reflexivo», y eso hace que un hispanohablante
        espere siempre un «se» de «lavarse». A veces es así, pero solo en uno de los cuatro casos.
        La buena noticia: el «se» español hace exactamente los mismos cuatro trabajos, así que ya
        conoces el sistema — solo hay que reconocerlo.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Primero, la forma</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        -ся no es una palabra suelta: va pegado al final del verbo, después de la terminación
        personal, y nunca se mueve de ahí. Cuando la terminación acaba en vocal, se escribe -сь en
        lugar de -ся: <RuExample ru="я умываюсь" es="me lavo (la cara)" /> frente a{" "}
        <RuExample ru="он умывается" es="él se lava (la cara)" />. Es la misma palabra, solo cambia
        según la letra anterior.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Los cuatro trabajos de -ся</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong>1. Reflexivo de verdad.</strong> El sujeto hace algo sobre sí mismo, igual que
        «lavarse» o «vestirse»: <RuExample ru="мыться" es="lavarse" />,{" "}
        <RuExample ru="одеваться" es="vestirse" />. Este es el caso que todo el mundo aprende
        primero, y también el menos frecuente de los cuatro.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong>2. Recíproco.</strong> Dos o más personas hacen algo la una con la otra — el mismo
        «se» de «se abrazan» o «se escriben»:{" "}
        <RuExample ru="обниматься" es="abrazarse (mutuamente)" />,{" "}
        <RuExample ru="переписываться" es="cartearse, mantener correspondencia" />,{" "}
        <RuExample ru="встречаться" es="verse, quedar" />.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong>3. Pasivo e impersonal.</strong> La acción le ocurre al sujeto, sin que se diga
        quién la hace — como «la casa se construye» o «se observa un aumento»:{" "}
        <RuExample ru="дом строится" es="la casa se está construyendo" />,{" "}
        <RuExample ru="проблема исследуется" es="el problema se investiga" />. Es la forma normal
        del registro escrito y científico, y ahí es donde más te la vas a encontrar.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        <strong>4. Verbos que solo existen con -ся.</strong> Aquí el postfijo ya no «significa»
        nada: forma parte de la palabra, como en español «quejarse» o «atreverse», que no existen
        sin el «se». <RuExample ru="смеяться" es="reír" />,{" "}
        <RuExample ru="бояться" es="temer" />, <RuExample ru="стараться" es="esforzarse" />. No
        intentes encontrarles un sentido reflexivo: no lo tienen.
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">
        Un caso que te va a resultar familiar
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        El verbo <RuExample ru="нравиться" es="gustar" /> se construye igual que su equivalente
        español, y eso es una ayuda enorme: lo que gusta es el sujeto, y la persona a la que le
        gusta va en dativo. <RuExample ru="мне нравится эта книга" es="me gusta este libro" /> —
        palabra por palabra, la misma estructura «al revés» que ya usas sin pensar. La única
        diferencia es de forma: el ruso lleva -ся y el español no lleva «se».
      </p>

      <h2 className="mt-10 text-xl font-semibold tracking-tight">Donde la comparación se rompe</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        La primera diferencia es dura y no admite excepciones: <strong>un verbo con -ся nunca puede
        llevar complemento directo</strong>. En español «se lava las manos» es perfectamente normal,
        pero su calco al ruso es imposible. Hay que quitar el -ся y decir{" "}
        <RuExample ru="он моет руки" es="se lava las manos" />, literalmente «él lava las manos».
        Si en tu frase hay un objeto, el -ся sobra.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        La segunda es de posición. El «se» español es una palabra independiente que se mueve según
        la forma verbal («se lava», «lavarse», «lavándose»). El -ся ruso está soldado al final y no
        se mueve nunca, ni siquiera cuando el verbo cambia de forma por completo: el gerundio de{" "}
        <RuExample ru="улыбаться" es="sonreír" /> es <RuExample ru="улыбаясь" es="sonriendo" />, y
        el de <RuExample ru="вернуться" es="volver" /> es{" "}
        <RuExample ru="вернувшись" es="habiendo vuelto" /> — el postfijo sigue ahí, al final.
      </p>
      <p className="mt-3 leading-7 text-foreground/80">
        Por último, ojo con los pares donde el -ся cambia quién hace qué. En el vocabulario del
        trabajo, <RuExample ru="устроиться на работу" es="conseguir un empleo" /> lo hace el
        candidato, mientras que <RuExample ru="уволиться" es="dimitir, renunciar" /> y{" "}
        <RuExample ru="уволить" es="despedir a alguien" /> son acciones de personas distintas. La
        diferencia entera está en esas tres letras.
      </p>

      <div className="mt-10 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/courses/b1/21"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B1, lección 21 — Gerundios imperfectivos
            </Link>
            <span className="text-sm text-foreground/60"> · улыбаться → улыбаясь</span>
          </li>
          <li>
            <Link
              href="/es/courses/b1/22"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B1, lección 22 — Gerundios perfectivos
            </Link>
            <span className="text-sm text-foreground/60"> · вернуться → вернувшись</span>
          </li>
          <li>
            <Link
              href="/es/courses/b1/27"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B1, lección 27 — Búsqueda de trabajo y la entrevista
            </Link>
            <span className="text-sm text-foreground/60"> · устроиться / уволиться / уволить</span>
          </li>
          <li>
            <Link
              href="/es/courses/b2/6"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B2, lección 6 — Temas de actualidad y sociedad
            </Link>
            <span className="text-sm text-foreground/60"> · el impersonal, equivalente del «se» español</span>
          </li>
          <li>
            <Link
              href="/es/courses/b2/22"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              B2, lección 22 — Estilo científico y construcciones pasivas
            </Link>
            <span className="text-sm text-foreground/60"> · el pasivo con -ся en el registro escrito</span>
          </li>
          <li>
            <Link
              href={GLOSSARY_TERM_PATH}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Glosario: verbo reflexivo (con -ся)
            </Link>
            <span className="text-sm text-foreground/60"> · la definición breve del término</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
