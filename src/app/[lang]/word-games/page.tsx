import type { Metadata } from "next";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlementTier } from "@/lib/entitlement";
import { flashcardLevels } from "@/lib/flashcards";
import { wordGameTypes } from "@/lib/word-games/types";
import { countAllSequences, getAllCurvedSequences, getAllPremiumOnlySequences, getFreeSequences } from "@/lib/word-games/data";
import { getAllCompletedSequences } from "@/lib/word-games/progress";
import WordGamesPicker, { type PickerData } from "@/components/word-games/WordGamesPicker";
import FreePuzzleIndex from "@/components/word-games/FreePuzzleIndex";
import { notFound } from "next/navigation";
import { hubMetadata } from "@/lib/word-games/metadata";
import { routeAlternates } from "@/lib/site";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/word-games">): Promise<Metadata> {
  const { lang } = await params;
  const alternates = routeAlternates(lang, "/word-games");
  // Same fallback-metadata problem the 160 puzzle pages had: this hub
  // announced itself with the home page's title and description.
  if (!isLocale(lang)) return { alternates };
  return { ...hubMetadata(lang), alternates };
}

export default async function WordGamesPage({ params }: PageProps<"/[lang]/word-games">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const user = await getCurrentUser();

  // 3 queries total (2 for a signed-out visitor) instead of up to 30 — one
  // per (type, level) pair, times 3 pieces of data, run sequentially. Each
  // round trip pays real cross-region Turso latency (see the load-test
  // notes in PROJECT_SUMMARY.md), so this page used to take 1.6-2.4s cold
  // and was the single worst offender in a production load test. Batched
  // functions return everything keyed by `${type}:${level}`, grouped here
  // in memory instead of by the database.
  const [totals, completedByPair, curvedByPair, premiumOnlyByPair, freeByPair, tier] = await Promise.all([
    countAllSequences(),
    user ? getAllCompletedSequences(user.id) : Promise.resolve(new Map<string, Set<number>>()),
    getAllCurvedSequences(),
    getAllPremiumOnlySequences(),
    getFreeSequences(),
    getEntitlementTier(),
  ]);

  const data = {} as PickerData;
  for (const type of wordGameTypes) {
    const levelData = {} as PickerData[typeof type];
    for (const level of flashcardLevels) {
      const key = `${type}:${level}`;
      levelData[level] = {
        total: totals.get(key) ?? 0,
        completed: Array.from(completedByPair.get(key) ?? []),
        curved: Array.from(curvedByPair.get(key) ?? []),
        premiumOnly: Array.from(premiumOnlyByPair.get(key) ?? []),
      };
    }
    data[type] = levelData;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.wordGames.title}</h1>
      <p className="mt-2 text-lg text-foreground/70">{dict.wordGames.subtitle}</p>
      <WordGamesPicker lang={lang} dict={dict.wordGames} data={data} isPremium={tier === "premium"} />
      {/* Server-rendered links to the whole free sample. The picker above
          is a client component whose grid follows React state, so the
          server emits links for its initial tab only — measured on
          production 02.09.2026, that left 78 of the 160 free puzzle URLs
          with no inbound link anywhere on the site, in the sitemap and
          allowed by robots.txt but reachable by no link at all. See
          src/lib/word-games/free-index.ts. */}
      <FreePuzzleIndex
        lang={lang}
        dict={dict.wordGames}
        available={(type, level) => freeByPair.get(`${type}:${level}`)}
      />
    </div>
  );
}
