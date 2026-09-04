import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import { markStudyDayVisit } from "@/lib/study-day-visit";
import {
  PUBLIC_VOCABULARY_LEVELS,
  VOCABULARY_CATEGORY_PAGES,
  getVocabularyCategoryPage,
} from "@/lib/vocabulary-categories";
import { getThemedPuzzlesByTopic } from "@/lib/word-games/data";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

// Forced dynamic, same reason as src/app/sitemap.ts: the card bank only
// exists in the production database, which is reachable at request time
// and not during `next build` (no TURSO_DATABASE_URL on Vercel's builder).
// Pre-rendering these would try to read an empty local SQLite file and
// ship 23 empty pages.
export const dynamic = "force-dynamic";

// ES-only, like the /es/gramatica guides and the game landing pages: these
// pages exist to answer a Spanish query ("vocabulario ruso de comida"), and
// the intros are written as Spanish-to-Russian comparisons, so a Russian
// interface copy would be the same Spanish text at a second URL.
//
// The interactive card trainer at /vocabulary and GET /api/flashcards keep
// their existing gating untouched. What is opened here is only the static
// server-rendered text — and only for A1–B2. All 898 C1 cards stay behind
// the paywall in full (same principle as the free word-game tier), and the
// filter runs here, before render, so they are absent from the HTML rather
// than hidden with CSS.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/vocabulary/[categoria]">): Promise<Metadata> {
  const { lang, categoria } = await params;
  if (lang !== "es") return {};
  const page = getVocabularyCategoryPage(categoria);
  if (!page) return {};
  const url = `${SITE_URL}/es/vocabulary/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url, languages: { es: url, "x-default": url } },
  };
}

export default async function VocabularyCategoryPage({
  params,
}: PageProps<"/[lang]/vocabulary/[categoria]">) {
  const { lang, categoria } = await params;
  if (lang !== "es") notFound();

  const page = getVocabularyCategoryPage(categoria);
  if (!page) notFound();

  // A signed-in learner reading a category word list is studying cards,
  // even though this page exists mainly for anonymous search traffic —
  // which marks nothing, having no account to mark.
  await markStudyDayVisit("flashcards");

  const publicLevels = new Set<string>(PUBLIC_VOCABULARY_LEVELS);
  const index = await getFlashcardIndex();
  const cards = index.filter(
    (card) => card.category === page.category && publicLevels.has(card.level),
  );
  // Только ЧИСЛО, ни одного слова. Страница по-прежнему перечисляет A1-B2:
  // фильтр выше не тронут, C1-карточки отсутствуют в отданном HTML, а не
  // спрятаны стилями. Счётчик нужен, чтобы подпись ниже была проверяемой
  // ("46 palabras"), а не общим обещанием — и он берётся из уже
  // загруженного индекса, без второго обращения к базе.
  const c1Count = index.filter(
    (card) => card.category === page.category && card.level === "C1",
  ).length;

  const byLevel = PUBLIC_VOCABULARY_LEVELS.map((level) => ({
    level,
    cards: cards.filter((card) => card.level === level),
  })).filter((group) => group.cards.length > 0);

  const url = `${SITE_URL}/es/vocabulary/${page.slug}`;
  // The free puzzles built entirely from this category's words. Read from
  // the DATABASE, not from the frozen table in word-games/topics.ts: the
  // table says which rungs are meant to be themed, the rows say which ones
  // are, and until the generator has actually run against production those
  // two disagree. While they did, this block claimed "6 puzles gratis
  // hechos solo con vocabulario de este tema" on all 16 pages and linked to
  // puzzles still built from a level-wide mix. Empty list = no block, which
  // is the correct thing to show before the regeneration and for any
  // category no rung could use.
  const puzzles = (await getThemedPuzzlesByTopic()).get(page.slug) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          // CollectionPage + ItemList, deliberately not DefinedTerm: that
          // type is the glossary's, and reusing it here would tell Google
          // these pages and the glossary are the same kind of thing when
          // the whole point is that they answer different questions.
          "@type": "CollectionPage",
          name: page.h1,
          description: page.metaDescription,
          inLanguage: "es",
          url,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: cards.length,
            itemListElement: cards.map((card, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: card.russian,
            })),
          },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: "Inicio", url: `${SITE_URL}/es` },
          { name: "Vocabulario ruso", url: `${SITE_URL}/es/vocabulary` },
          { name: page.h1, url },
        ])}
      />

      <Link
        href="/es/vocabulary"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Vocabulario ruso por temas
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{page.h1}</h1>
      <p className="mt-3 text-foreground/60">
        {cards.length} palabras con transcripción, traducción y una frase de ejemplo, ordenadas por
        nivel.
      </p>

      {page.intro.map((paragraph, index) => (
        <p key={index} className="mt-4 leading-7 text-foreground/80">
          {paragraph}
        </p>
      ))}

      {byLevel.map((group) => (
        <section key={group.level} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            Nivel {group.level}{" "}
            <span className="text-base font-normal text-foreground/50">
              · {group.cards.length} palabras
            </span>
          </h2>
          <ul className="mt-4 flex flex-col divide-y divide-black/10 dark:divide-white/20">
            {group.cards.map((card) => (
              <li key={card.id} className="flex gap-3 py-3">
                <span aria-hidden className="text-xl leading-7">
                  {card.emoji}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <strong lang="ru" className="font-semibold">
                      {card.russian}
                    </strong>
                    <span className="text-sm text-foreground/50">[{card.transcription}]</span>
                    <span className="text-foreground/80">— {card.translationEs}</span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-foreground/60">
                    <span lang="ru">{card.exampleRu}</span> — {card.exampleEs}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {c1Count > 0 && (
        <aside className="mt-12 rounded-2xl border border-black/10 p-5 dark:border-white/30">
          <h2 className="text-base font-semibold tracking-tight">El nivel C1 está en Premium</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/70">
            Esta lista llega hasta el B2. De este tema hay además{" "}
            {c1Count === 1 ? "una palabra" : `${c1Count} palabras`} de nivel C1 que no se publican
            en abierto: forman parte del plan Premium y se estudian en las tarjetas. El curso es
            A1–B2; el vocabulario, los cuentos y los juegos llegan hasta el C1.
          </p>
          <Link
            href="/es/pricing"
            className="tap mt-3 inline-block text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            Ver los planes
          </Link>
        </aside>
      )}

      <div className="mt-12 rounded-2xl border border-black/10 p-5 dark:border-white/30">
        <h2 className="text-base font-semibold tracking-tight">Seguir por aquí</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Estas palabras también están en las tarjetas interactivas, con audio de cada palabra y de
          su frase, y con repaso espaciado.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          <li>
            <Link
              href="/es/vocabulary"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Practicar con tarjetas
            </Link>
            <span className="text-sm text-foreground/60"> · las 23 categorías, con audio</span>
          </li>
          {puzzles.length > 0 && (
            <li>
              <Link
                href={`/es/word-games/${puzzles[0].type}/${puzzles[0].level}/${puzzles[0].sequence}`}
                className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                Jugar con estas palabras
              </Link>
              <span className="text-sm text-foreground/60">
                {" "}
                · {puzzles.length === 1 ? "un puzle gratis hecho" : `${puzzles.length} puzles gratis hechos`} solo con
                vocabulario de este tema
                {puzzles.length > 1 && (
                  <>
                    :{" "}
                    {puzzles.map((puzzle, index) => (
                      <span key={`${puzzle.type}-${puzzle.level}-${puzzle.sequence}`}>
                        {index > 0 && ", "}
                        <Link
                          href={`/es/word-games/${puzzle.type}/${puzzle.level}/${puzzle.sequence}`}
                          className="tap underline-offset-2 hover:underline active:underline"
                        >
                          {puzzle.type === "CROSSWORD" ? "crucigrama" : "sopa de letras"} {puzzle.level}
                        </Link>
                      </span>
                    ))}
                  </>
                )}
              </span>
            </li>
          )}
          {/* The games entry page. These 23 category pages are in the
              sitemap, are linked from every other one of them, and already
              hand a crawler the themed puzzles — so they are the widest
              crawlable surface the site has that is not the frozen header
              or footer. Measured on production 04.09.2026,
              /es/juegos-para-aprender-ruso had six inbound links in total;
              this line is 23 more. */}
          <li>
            <Link
              href="/es/juegos-para-aprender-ruso"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Juegos para aprender ruso
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · sopas de letras y crucigramas gratis, por nivel y por tema
            </span>
          </li>
          <li>
            <Link
              href="/es/glossary"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Glosario de gramática rusa
            </Link>
            <span className="text-sm text-foreground/60">
              {" "}
              · qué significan los términos que aparecen arriba (caso, aspecto, instrumental)
            </span>
          </li>
          <li>
            <Link
              href="/es/courses"
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              Curso de ruso por niveles
            </Link>
            <span className="text-sm text-foreground/60"> · cómo se usa todo esto en una frase</span>
          </li>
        </ul>
      </div>

      <nav className="mt-10 border-t border-black/10 pt-6 dark:border-white/30">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          Otros temas
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {VOCABULARY_CATEGORY_PAGES.filter((other) => other.slug !== page.slug).map((other) => (
            <li key={other.slug}>
              <Link
                href={`/es/vocabulary/${other.slug}`}
                className="tap text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
              >
                {other.h1.replace(/^Vocabulario ruso (de la |de |del )?/, "")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
