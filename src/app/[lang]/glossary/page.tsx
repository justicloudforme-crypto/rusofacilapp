import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import GlossaryApp from "@/components/glossary/GlossaryApp";

export default async function GlossaryPage({ params }: PageProps<"/[lang]/glossary">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.glossary) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.glossary.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict.glossary.pageSubtitle}</p>

      <div className="mt-10">
        <GlossaryApp dict={dict.glossary} lang={lang} />
      </div>
    </div>
  );
}
