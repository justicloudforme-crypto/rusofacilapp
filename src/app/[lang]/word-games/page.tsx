import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getEntitlementTier } from "@/lib/entitlement";
import { flashcardLevels } from "@/lib/flashcards";
import { wordGameTypes } from "@/lib/word-games/types";
import { countAllSequences, getAllCurvedSequences } from "@/lib/word-games/data";
import { getAllCompletedSequences } from "@/lib/word-games/progress";
import WordGamesPicker, { type PickerData } from "@/components/word-games/WordGamesPicker";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
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
  const [totals, completedByPair, curvedByPair, tier] = await Promise.all([
    countAllSequences(),
    user ? getAllCompletedSequences(user.id) : Promise.resolve(new Map<string, Set<number>>()),
    getAllCurvedSequences(),
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
      };
    }
    data[type] = levelData;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.wordGames.title}</h1>
      <p className="mt-2 text-lg text-foreground/70">{dict.wordGames.subtitle}</p>
      <WordGamesPicker lang={lang} dict={dict.wordGames} data={data} isPremium={tier === "premium"} />
    </div>
  );
}
