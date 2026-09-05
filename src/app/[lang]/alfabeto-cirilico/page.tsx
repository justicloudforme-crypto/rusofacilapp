import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import SpeakButton from "@/components/lesson/SpeakButton";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { alphabetAudioKey } from "@/lib/lessons/audioKeys";
import {
  ALPHABET_PAGE_PATH,
  ALPHABET_TRAPS,
  CYRILLIC_ALPHABET,
} from "@/lib/alphabet/cyrillic-alphabet";
import { clipUrl, getAlphabetAudio } from "@/lib/alphabet/alphabet-audio";

/**
 * Точка входа из поиска «alfabeto cirílico»: бесплатная, полностью
 * открытая анониму, вне курса и вне игр.
 *
 * ES-ONLY, и это не копия чужого решения, а тот же замер. Соседние
 * страницы этого класса — четыре гида `/es/gramatica/*`, три общих
 * игровых лендинга, шесть тематических и 23 страницы категорий словаря —
 * все до одной стоят под `if (lang !== "es") notFound()` и перечислены в
 * `esOnlyPaths` карты сайта. Замер на живом проде 06.09.2026: из 1912 URL
 * карты ни один такой адрес не существует в `/ru`, а всё, что живёт в обеих
 * локалях, — это контент (рассказы, медиа, уроки, словарь, пазлы), а не
 * страницы-объяснения. Причина у решения одна и та же: метод здесь —
 * сравнение с испанским, так что русскоязычная копия была бы тем же
 * испанским текстом по второму адресу и ни для кого.
 *
 * ЧЕМ ЭТА СТРАНИЦА ОТЛИЧАЕТСЯ ОТ УЖЕ СУЩЕСТВУЮЩИХ ТРЁХ — длинно и с
 * числами в `src/lib/alphabet/cyrillic-alphabet.ts`. Коротко: урок a1-1
 * даёт букву и её НАЗВАНИЕ, гид `/es/gramatica/alfabeto-ruso` — прозу по
 * трудности узнавания, лендинг филворда — два абзаца и сетку. Слова-
 * примера на букву и транскрипции слова по реальному произношению нет ни
 * у одного из трёх; здесь они есть у всех 33, со звуком. Все три страницы
 * отсюда названы ссылками, и все три ссылаются сюда.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/alfabeto-cirilico">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${ALPHABET_PAGE_PATH}`;
  return {
    title: "El alfabeto cirílico: las 33 letras rusas con sonido y ejemplos",
    description:
      "Las 33 letras del alfabeto ruso con su sonido, el sonido español más parecido y una palabra de ejemplo que puedes escuchar, transcrita como se pronuncia de verdad.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

export default async function AlfabetoCirilicoPage({
  params,
}: PageProps<"/[lang]/alfabeto-cirilico">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");
  const audio = await getAlphabetAudio();
  const url = `${SITE_URL}/es${ALPHABET_PAGE_PATH}`;
  const listen = dict.lesson.alphabet.listenLabel;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "El alfabeto cirílico: las 33 letras rusas con sonido y ejemplos",
          description:
            "Tabla de las 33 letras del alfabeto ruso: el sonido de cada letra, el sonido español más parecido y una palabra de ejemplo con audio, transcrita según su pronunciación real.",
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "El alfabeto cirílico", url },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        El alfabeto cirílico: las 33 letras rusas con sonido y ejemplos
      </h1>
      <p className="mt-4 text-lg leading-8 text-foreground/70">
        Saber cómo se llama una letra no sirve de mucho: lo que hace falta es oírla dentro de una
        palabra. Esta página da las 33 letras del cirílico con su sonido, el sonido español más
        cercano y una palabra real donde escucharla. Las transcripciones están escritas{" "}
        <strong>como se pronuncia de verdad</strong>, no letra por letra — por eso{" "}
        <span lang="ru">вода</span> aparece como «vadá» y no como «voda».
      </p>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">
        Las 33 letras, una por una
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        En cada fila: la letra, cómo se llama en ruso, el sonido que representa, a qué se parece en
        español y una palabra de ejemplo. Los dos botones suenan cosas distintas — el de arriba
        dice el <em>nombre</em> de la letra, el de la palabra dice la <em>palabra</em>.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {CYRILLIC_ALPHABET.map((entry) => (
          <li
            key={entry.letter}
            className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 sm:flex-row sm:gap-4 dark:border-white/30"
          >
            <div className="flex items-center gap-3 sm:w-40 sm:flex-shrink-0 sm:flex-col sm:items-start sm:gap-1">
              <span lang="ru" className="text-3xl font-semibold leading-9">
                {entry.letter}
              </span>
              <span className="flex items-center gap-2">
                <span lang="ru" className="text-sm text-foreground/70">
                  {entry.name}
                </span>
                <SpeakButton
                  text={entry.name}
                  label={listen}
                  audioUrl={clipUrl(audio, "a1-1", alphabetAudioKey(entry.lessonAlphabetIndex))}
                />
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="leading-7 text-foreground/80">
                <span className="font-mono text-sm text-foreground/60">[{entry.sound}]</span>{" "}
                — {entry.spanish}.
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-7">
                <strong lang="ru" className="font-semibold">
                  {entry.example.ru}
                </strong>
                <span className="font-mono text-sm text-foreground/60">[{entry.example.tr}]</span>
                <span className="text-foreground/60">— {entry.example.es}</span>
                <SpeakButton
                  text={entry.example.ru}
                  label={listen}
                  audioUrl={clipUrl(audio, entry.example.audio.lessonId, entry.example.audio.itemKey)}
                />
              </p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">
        Las ocho letras que engañan a un hispanohablante
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Seis de estas letras existen también en el alfabeto latino, así que el ojo las lee solo — y
        se equivoca cada vez. Las otras dos engañan al revés: <span lang="ru">ы</span> no se parece
        a nada y se salta al leer, y <span lang="ru">ь</span> parece un adorno que se puede
        ignorar. Ninguna de las ocho es un detalle fino: todas cambian palabras enteras.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {ALPHABET_TRAPS.map((trap) => (
          <li
            key={trap.letter}
            className="rounded-2xl border border-black/10 p-4 dark:border-white/30"
          >
            <p className="leading-7">
              <span lang="ru" className="text-2xl font-semibold">
                {trap.letter}
              </span>
              <span className="text-foreground/60"> — parece {trap.looksLike}, es {trap.reallyIs}.</span>
            </p>
            <p className="mt-1 leading-7">
              <strong lang="ru" className="font-semibold">
                {trap.proof.ru}
              </strong>{" "}
              <span className="font-mono text-sm text-foreground/60">[{trap.proof.tr}]</span>{" "}
              <span className="text-foreground/60">— {trap.proof.es}</span>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">
        Por qué lo escrito y lo oído no coinciden
      </h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Tres reglas explican casi todas las diferencias entre la fila «letra» y la fila
        «transcripción» de la tabla de arriba. No son excepciones: funcionan siempre, y aprenderlas
        ahorra memorizar palabra por palabra.
      </p>
      <h3 className="mt-6 text-lg font-medium">1. La «o» sin acento suena «a»</h3>
      <p className="mt-2 leading-7 text-foreground/80">
        El acento no se escribe, pero manda. Una <span lang="ru">о</span> que no lo lleva se
        debilita hasta sonar como una «a»: <strong lang="ru">окно</strong> es «aknó»,{" "}
        <strong lang="ru">город</strong> es «górat», <strong lang="ru">яблоко</strong> es
        «yáblaka». Es la diferencia más audible entre alguien que lee las letras y alguien que
        habla ruso.
      </p>
      <h3 className="mt-6 text-lg font-medium">2. La consonante final se ensordece</h3>
      <p className="mt-2 leading-7 text-foreground/80">
        Al final de palabra, <span lang="ru">б</span> suena «p», <span lang="ru">д</span> suena
        «t», <span lang="ru">г</span> suena «k», <span lang="ru">ж</span> suena «sh» y{" "}
        <span lang="ru">з</span> suena «s». Por eso <strong lang="ru">хлеб</strong> es «khlyep»,{" "}
        <strong lang="ru">этаж</strong> es «etásh» y <strong lang="ru">подъезд</strong> es
        «padyést». Lo mismo pasa dentro de la palabra cuando la consonante siguiente es sorda:{" "}
        <strong lang="ru">юбка</strong> es «yúpka».
      </p>
      <h3 className="mt-6 text-lg font-medium">3. Consonantes duras y blandas</h3>
      <p className="mt-2 leading-7 text-foreground/80">
        Casi toda consonante rusa tiene dos versiones, dura y blanda, y la blanda suena como si le
        siguiera una «i» muy breve — algo parecido a la distancia española entre <em>n</em> y{" "}
        <em>ñ</em>. Lo que ablanda es la letra siguiente: las vocales{" "}
        <span lang="ru">е, ё, и, ю, я</span> o el signo blando <span lang="ru">ь</span>. En las
        transcripciones de esta página eso se marca con un apóstrofo: <strong lang="ru">мать</strong>{" "}
        es «mat’» y <strong lang="ru">мат</strong> es «mat» — dos palabras distintas. La oposición
        no es solo de pronunciación: decide terminaciones en toda la gramática, y eso lo explica el{" "}
        <Link
          href="/es/glossary/tema-duro-y-blando"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          glosario, en «tema duro y tema blando»
        </Link>
        .
      </p>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">Cómo leer las transcripciones</h2>
      <p className="mt-3 leading-7 text-foreground/80">
        Están pensadas para un hispanohablante, no en alfabeto fonético. La vocal con tilde es la
        acentuada (<strong lang="ru">вода</strong> «vadá»). El apóstrofo marca consonante blanda
        («mat’»). Los grupos «sh», «zh», «ch», «shch», «ts» y «kh» son un solo sonido cada uno, los
        cinco de la tabla que el español no tiene o tiene con otro valor. Y «y» al principio de
        sílaba es la «y» de <em>ya</em>, mientras que «y» sola es la vocal{" "}
        <span lang="ru">ы</span>, que no se parece a ninguna española.
      </p>

      <div className="mt-12 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/gramatica/alfabeto-ruso"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              El alfabeto ruso, por dificultad
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · las mismas 33 letras agrupadas por lo que cuesta reconocerlas, en vez de en orden
            </span>
          </li>
          <li>
            <Link
              href="/es/courses/a1/1"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              A1, lección 1 — El alfabeto cirílico y los sonidos del ruso
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · la lección del curso, con ejercicios y práctica de lectura
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
              · reconocer las letras jugando, gratis y sin registro
            </span>
          </li>
          <li>
            <Link
              href="/es/media/video-alfabeto-ruso"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Vídeo: el alfabeto ruso explicado en español
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · una clase introductoria narrada entera en español
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
