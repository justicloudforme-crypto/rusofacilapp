import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAllMedia } from "@/lib/media/data";
import MediaCatalog from "@/components/media/MediaCatalog";

export default async function MediaPage({ params }: PageProps<"/[lang]/media">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.media) notFound();

  const items = (await getAllMedia()).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    level: item.level,
    category: item.category,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.media.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict.media.pageSubtitle}</p>

      <div className="mt-10">
        <MediaCatalog lang={lang} items={items} dict={dict.media} />
      </div>
    </div>
  );
}
