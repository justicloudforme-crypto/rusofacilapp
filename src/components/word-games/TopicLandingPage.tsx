import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getLandingPuzzleForTopic, getThemedPuzzlesByTopic, toPublicPuzzle } from "@/lib/word-games/data";
import { getVocabularyCategoryPage } from "@/lib/vocabulary-categories";
import { landingPath, type TopicLanding } from "@/lib/word-games/topic-landings";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";
import { wordGamePlayerDict } from "@/lib/word-games/player-dict";

/**
 * One `/es/sopa-de-letras-ruso-<tema>` page. Six thin route files call
 * this with their own entry from TOPIC_LANDINGS; the prose lives in that
 * table, not here, so nothing about a page is shared except its shape.
 *
 * Everything variable is read from the database at request time: the
 * embedded puzzle is found by `topic`, and the "otros puzles de este tema"
 * list comes from the stored rows, so neither can advertise a theme the
 * data no longer has.
 */
export default async function TopicLandingPage({ landing }: { landing: TopicLanding }) {
  const [dict, user, puzzle, themed] = await Promise.all([
    getDictionary("es"),
    getCurrentUser(),
    getLandingPuzzleForTopic(landing.topic),
    getThemedPuzzlesByTopic(),
  ]);

  // No themed puzzle for this topic any more means the page's own premise
  // is gone. A 404 is the honest answer; embedding an unrelated grid under
  // a themed title is not.
  if (!puzzle) notFound();

  const vocabularyPage = getVocabularyCategoryPage(landing.topic);
  const path = landingPath(landing);
  const url = `${SITE_URL}/es${path}`;

  // The theme's other puzzles, minus the one already on this page.
  const others = (themed.get(landing.topic) ?? []).filter(
    (p) => !(p.type === puzzle.type && p.level === puzzle.level && p.sequence === puzzle.sequence),
  );

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: landing.h1,
          description: landing.articleDescription,
          inLanguage: "es",
          isAccessibleForFree: true,
          url,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          publisher: { "@type": "Organization", name: "RusoFácilapp", url: SITE_URL },
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Sopa de letras en ruso", url: `${SITE_URL}/es/sopa-de-letras-ruso` },
          { name: landing.h1, url },
        ])}
      />

      <Link
        href="/es/sopa-de-letras-ruso"
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← Sopa de letras en ruso
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{landing.h1}</h1>

      {landing.intro.map((paragraph, index) => (
        <p
          key={index}
          className={index === 0 ? "mt-4 text-lg leading-8 text-foreground/70" : "mt-4 leading-7 text-foreground/70"}
        >
          {paragraph}
        </p>
      ))}

      <div className="mt-10">
        <WordGamePlayer
          lang="es"
          puzzle={toPublicPuzzle(puzzle)}
          dict={wordGamePlayerDict(dict)}
          resultDict={{ ...dict.gameResult, locale: "es" }}
          signedIn={Boolean(user)}
        />
      </div>

      <section className="mt-10 flex flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/30">
        {vocabularyPage && (
          <Link
            href={`/es/vocabulary/${vocabularyPage.slug}`}
            className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            Toda la lista de palabras {landing.linkLabel}, con transcripción y ejemplos →
          </Link>
        )}

        {others.length > 0 && (
          <p className="text-sm leading-6 text-foreground/70">
            Más puzles {landing.linkLabel}:{" "}
            {others.map((p, index) => (
              <span key={`${p.type}-${p.level}-${p.sequence}`}>
                {index > 0 && ", "}
                <Link
                  href={`/es/word-games/${p.type}/${p.level}/${p.sequence}`}
                  className="tap underline-offset-2 hover:underline active:underline"
                >
                  {p.type === "CROSSWORD" ? "crucigrama" : "sopa de letras"} {p.level}
                </Link>
              </span>
            ))}
          </p>
        )}

        <Link
          href="/es/courses/a1/1"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          Prueba la primera lección de ruso, gratis y sin límite de tiempo →
        </Link>
        <Link
          href="/es/sopa-de-letras-ruso"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          Sopa de letras en ruso, todos los temas →
        </Link>
        <Link
          href="/es/juegos-para-aprender-ruso"
          className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
        >
          Todos los juegos para aprender ruso →
        </Link>
      </section>
    </div>
  );
}
