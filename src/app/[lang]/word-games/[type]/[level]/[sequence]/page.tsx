import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isFlashcardLevel } from "@/lib/flashcards";
import { isWordGameType } from "@/lib/word-games/types";
import { getFreeSequences, getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import { freeNeighbours } from "@/lib/word-games/free-index";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCurvedPuzzle, getEntitlementTier, isFreeWordGamePuzzle } from "@/lib/entitlement";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import { puzzleDescription, puzzleTitle } from "@/lib/word-games/metadata";
import { getTopicInfo, vocabularyPathForTopic } from "@/lib/word-games/topics";
import { routeAlternates } from "@/lib/site";
import { wordGamePlayerDict } from "@/lib/word-games/player-dict";

/**
 * The link from a themed puzzle to the vocabulary page its words come
 * from. Returns null unless the puzzle is themed AND the category still
 * has a page, so this can never render a link to a 404.
 *
 * The vocabulary pages are Spanish-only by design (they explain Russian
 * through comparison with Spanish — see vocabulary-categories.ts), so the
 * Russian copy says the destination is in Spanish instead of quietly
 * sending a Russian-interface reader somewhere they didn't expect.
 */
function buildTopicLink(
  lang: string,
  topic: string | null,
): { href: string; linkText: string; tail: string } | null {
  const info = getTopicInfo(topic);
  if (!info) return null;
  const href = vocabularyPathForTopic(info.slug);
  if (!href) return null;
  return lang === "ru"
    ? {
        href,
        linkText: `Все слова по теме «${info.ru}»`,
        tail: "— с транскрипцией, переводом и примером. Страница на испанском.",
      }
    : {
        href,
        linkText: `Todas las palabras de ${info.es}`,
        tail: "— con transcripción, traducción y una frase de ejemplo.",
      };
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/word-games/[type]/[level]/[sequence]">): Promise<Metadata> {
  const { lang, type, level, sequence } = await params;
  const alternates = routeAlternates(
    lang,
    `/word-games/${encodeURIComponent(type)}/${encodeURIComponent(level)}/${encodeURIComponent(sequence)}`,
  );
  // Measured 29.08.2026: all 160 puzzle URLs served the home page's title
  // and description, because this route had none of its own. The title is
  // built from the puzzle's own row — including `topic`, which since
  // 02.09.2026 names the vocabulary category 69 of the 80 free puzzles are
  // built from. Passing the ROW's topic rather than looking it up keeps
  // the title honest if a rung ever comes back mixed.
  const seq = Number(sequence);
  if (!isLocale(lang) || !isWordGameType(type) || !isFlashcardLevel(level) || !Number.isInteger(seq) || seq < 1) {
    return { alternates };
  }
  // getPuzzle is React-cached, so this does not add a second DB round trip
  // on top of the component's own read.
  const row = await getPuzzle(type, level, seq);
  if (!row) return { alternates };
  return {
    title: puzzleTitle(lang, type, level, seq, row.words.length, row.topic),
    description: puzzleDescription(lang, type, level, seq, row.words.length, row.topic),
    alternates,
  };
}

export default async function WordGamePuzzlePage({
  params,
}: PageProps<"/[lang]/word-games/[type]/[level]/[sequence]">) {
  const { lang, type, level, sequence: sequenceRaw } = await params;
  const sequence = Number(sequenceRaw);
  if (
    !isLocale(lang) ||
    !isWordGameType(type) ||
    !isFlashcardLevel(level) ||
    !Number.isInteger(sequence) ||
    sequence < 1
  ) {
    notFound();
  }

  const row = await getPuzzle(type, level, sequence);
  if (!row) notFound();

  const dict = await getDictionary(lang);
  const user = await getCurrentUser();
  const topicPage = buildTopicLink(lang, row.topic);

  // Neighbour rungs, and only for a free puzzle.
  //
  // Measured on production 03.09.2026 over 1912 crawled pages: the 160
  // free puzzle URLs had exactly one kind of outgoing edge between them —
  // none. Every one of them pointed back at /word-games (and, when themed,
  // at one vocabulary page), so the free sample was a star with no path
  // through it: a crawler that lands on rung 4 learns about rung 5 only by
  // going back up to the hub. These two links are that path.
  //
  // The read is skipped entirely for a paywalled rung, which is both the
  // cheap case and the honest one: see freeNeighbours on why rung 10 must
  // not link to rung 11.
  const free = isFreeWordGamePuzzle({ type, level, sequence });
  const freeByPair = free ? await getFreeSequences() : null;
  const neighbours = freeByPair
    ? freeNeighbours(lang, type, level, sequence, (t, l) => freeByPair.get(`${t}:${l}`))
    : { prev: null, next: null };

  // The section-wide proxy.ts gate was removed so the free-trial sample
  // (see isFreeWordGamePuzzle) can be reached without a subscription —
  // this page must now check entitlement itself, the same way the story
  // reader and lesson pages already do for their own free/premium splits.
  const tier = await getEntitlementTier();
  const entitled = tier !== "free";
  if (!entitled && !free) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }
  // ★ (curved) and premiumOnly puzzles need Premium specifically, even for
  // an otherwise entitled standard subscriber.
  if ((row.curved || row.premiumOnly) && !canAccessCurvedPuzzle(tier)) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }

  // NO day mark here — deliberately, since 03.09.2026 (owner's decision).
  //
  // Opening this page used to count as a day of study on its own, before a
  // single letter: measured 03.09.2026, a page open with 0 keystrokes put
  // one "studied" day on /profile. For a crossword the day is now marked by
  // POST /api/word-games/check instead, i.e. by the first letter actually
  // entered — see that route.
  //
  // The consequence for WORD_SEARCH, stated rather than hidden: it has no
  // per-move server call at all (its grid and word list are public, so the
  // whole game is graded in the browser), so opening one now marks nothing
  // and its day comes from finishing it — WordGameProgress.completedAt,
  // already a streak source in src/lib/streaks.ts. This is the same rule,
  // not a second one: a puzzle nobody touched is not a day of study.

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href={`/${lang}/word-games`}
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        {dict.wordGames.backToWordGames}
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        {(type === "CROSSWORD" ? dict.wordGames.typeCrossword : dict.wordGames.typeWordSearch)}
        {" · "}
        {level}
        {" · "}
        {dict.wordGames.puzzleLabel.replace("{n}", String(sequence))}
      </h1>

      <div className="mt-8">
        <WordGamePlayer
          lang={lang}
          puzzle={toPublicPuzzle(row)}
          dict={wordGamePlayerDict(dict)}
          resultDict={{ ...dict.gameResult, locale: lang }}
          signedIn={Boolean(user)}
        />
      </div>

      {/* The topic's own vocabulary page — every word in this puzzle comes
          from it, with transcription, translation and an example sentence.
          A plain server-rendered <a> (next/link renders one): a crawler has
          to see this edge in the HTML, and a player who wants the meanings
          shouldn't need JavaScript to get there. Rendered only when the
          puzzle really is themed and the category really has a page, so it
          can never point at a 404. The page is Spanish-only, which is why
          the Russian label says so rather than pretending otherwise. */}
      {/* The path through the free sample. Server-rendered <a>, no
          JavaScript: this is the crawler's surface and also the visitor's
          — "next puzzle" should not need the hub. Rendered only when a
          neighbour really exists and really is free, so it can never be a
          link into the paywall. */}
      {(neighbours.prev || neighbours.next) && (
        <nav aria-label={dict.wordGames.freeLadderNavLabel} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          {neighbours.prev && (
            <Link
              href={neighbours.prev.href}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              {dict.wordGames.prevPuzzle.replace("{n}", String(neighbours.prev.sequence))}
            </Link>
          )}
          {neighbours.next && (
            <Link
              href={neighbours.next.href}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              {dict.wordGames.nextPuzzle.replace("{n}", String(neighbours.next.sequence))}
            </Link>
          )}
        </nav>
      )}

      {topicPage && (
        <p className="mt-8 rounded-2xl border border-black/10 p-5 text-sm leading-6 text-foreground/70 dark:border-white/30">
          <Link
            href={topicPage.href}
            className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
          >
            {topicPage.linkText}
          </Link>{" "}
          {topicPage.tail}
        </p>
      )}
    </div>
  );
}
