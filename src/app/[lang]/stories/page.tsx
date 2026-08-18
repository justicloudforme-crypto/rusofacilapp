import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getStoryCatalog } from "@/lib/stories-catalog";
import StoriesCatalog from "@/components/stories/StoriesCatalog";

export default async function StoriesPage({ params }: PageProps<"/[lang]/stories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.stories) notFound();

  const stories = await getStoryCatalog();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict?.stories?.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict?.stories?.pageSubtitle}</p>

      <div className="mt-10">
        <StoriesCatalog lang={lang} stories={stories} dict={dict.stories} />
      </div>
    </div>
  );
}
