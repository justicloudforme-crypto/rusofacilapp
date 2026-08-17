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

  // Grammar explainer videos are the platform's standout content (see
  // media content policy) and should surface before songs/movies/video
  // in the default "all categories" view — a stable sort just bumps
  // grammar items to the front without disturbing everything else's order.
  const items = (await getAllMedia())
    // Hide items the embed-status checker (npm run check:media-embeds /
    // the admin "Verificar enlaces de YouTube" button) has confirmed are
    // broken — better an item silently missing from the catalog than a
    // dead "Video unavailable" player reaching a real user.
    .filter((item) => item.embedStatus !== "blocked")
    .slice()
    .sort((a, b) => (a.category === "grammar" ? 0 : 1) - (b.category === "grammar" ? 0 : 1))
    .map((item) => ({
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
      <p className="mt-2 max-w-xl text-xs text-foreground/40">{dict.media.copyrightNote}</p>

      <div className="mt-10">
        <MediaCatalog lang={lang} items={items} dict={dict.media} />
      </div>
    </div>
  );
}
