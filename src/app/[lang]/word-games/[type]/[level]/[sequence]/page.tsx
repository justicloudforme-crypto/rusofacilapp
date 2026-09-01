import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isFlashcardLevel } from "@/lib/flashcards";
import { isWordGameType } from "@/lib/word-games/types";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import { getCurrentUser } from "@/lib/auth";
import { markStudyDayVisit } from "@/lib/study-day-visit";
import { canAccessCurvedPuzzle, getEntitlementTier, isFreeWordGamePuzzle } from "@/lib/entitlement";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";
import { puzzleDescription, puzzleTitle } from "@/lib/word-games/metadata";
import { getTopicInfo, vocabularyPathForTopic } from "@/lib/word-games/topics";
import { routeAlternates } from "@/lib/site";

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

  // The section-wide proxy.ts gate was removed so the free-trial sample
  // (see isFreeWordGamePuzzle) can be reached without a subscription —
  // this page must now check entitlement itself, the same way the story
  // reader and lesson pages already do for their own free/premium splits.
  const tier = await getEntitlementTier();
  const entitled = tier !== "free";
  if (!entitled && !isFreeWordGamePuzzle({ type, level, sequence })) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }
  // ★ (curved) and premiumOnly puzzles need Premium specifically, even for
  // an otherwise entitled standard subscriber.
  if ((row.curved || row.premiumOnly) && !canAccessCurvedPuzzle(tier)) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }

  // Opening the puzzle is the study action — finishing it is not required.
  // A logged-out visitor on a free-trial puzzle marks nothing, because
  // there is no account to mark it on.
  await markStudyDayVisit("word-game", user);

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
          dict={dict.wordGames}
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
