import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import VocabularyApp from "@/components/flashcards/VocabularyApp";

export default async function VocabularyPage({ params }: PageProps<"/[lang]/vocabulary">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.vocabulary) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.vocabulary.pageTitle}</h1>

      <div className="mt-10">
        <VocabularyApp dict={dict.vocabulary} celebrationDict={dict.celebration} />
      </div>
    </div>
  );
}
