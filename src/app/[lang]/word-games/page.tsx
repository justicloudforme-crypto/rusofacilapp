import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { flashcardLevels } from "@/lib/flashcards";
import { wordGameTypes } from "@/lib/word-games/types";
import { countSequences } from "@/lib/word-games/data";
import { getCompletedSequences } from "@/lib/word-games/progress";
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

  const data = {} as PickerData;
  for (const type of wordGameTypes) {
    const levelData = {} as PickerData[typeof type];
    for (const level of flashcardLevels) {
      const [total, completed] = await Promise.all([
        countSequences(type, level),
        user ? getCompletedSequences(user.id, type, level) : Promise.resolve(new Set<number>()),
      ]);
      levelData[level] = { total, completed: Array.from(completed) };
    }
    data[type] = levelData;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.wordGames.title}</h1>
      <p className="mt-2 text-lg text-foreground/70">{dict.wordGames.subtitle}</p>
      <WordGamesPicker lang={lang} dict={dict.wordGames} data={data} />
    </div>
  );
}
