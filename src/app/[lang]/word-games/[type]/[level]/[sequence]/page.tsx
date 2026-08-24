import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isFlashcardLevel } from "@/lib/flashcards";
import { isWordGameType } from "@/lib/word-games/types";
import { getPuzzle, toPublicPuzzle } from "@/lib/word-games/data";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCurvedPuzzle, getEntitlementTier, isFreeWordGamePuzzle } from "@/lib/entitlement";
import WordGamePlayer from "@/components/word-games/WordGamePlayer";

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

  // The section-wide proxy.ts gate was removed so the free-trial sample
  // (see isFreeWordGamePuzzle) can be reached without a subscription —
  // this page must now check entitlement itself, the same way the story
  // reader and lesson pages already do for their own free/premium splits.
  const tier = await getEntitlementTier();
  const entitled = tier !== "free";
  if (!entitled && !isFreeWordGamePuzzle({ type, level, sequence })) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }
  // ★ (curved) puzzles need Premium specifically, even for an otherwise
  // entitled standard subscriber.
  if (row.curved && !canAccessCurvedPuzzle(tier)) {
    redirect(`/${lang}/pricing?next=/${lang}/word-games/${type}/${level}/${sequence}`);
  }

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
          signedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
