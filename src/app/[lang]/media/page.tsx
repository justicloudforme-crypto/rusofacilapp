import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAllMedia } from "@/lib/media/data";
import { mediaLevels } from "@/lib/media/types";
import { canAccessMediaItem, getEntitlementTier } from "@/lib/entitlement";
import MediaCatalog from "@/components/media/MediaCatalog";

export async function generateMetadata({ params }: PageProps<"/[lang]/media">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  if (!dict?.media) return {};
  return { title: `${dict.media.pageTitle} | RusoFácilapp`, description: dict.media.pageSubtitle };
}

export default async function MediaPage({ params }: PageProps<"/[lang]/media">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [dict, tier, allMedia] = await Promise.all([getDictionary(lang), getEntitlementTier(), getAllMedia()]);
  if (!dict?.media) notFound();

  const levelRank = new Map(mediaLevels.map((level, index) => [level, index]));

  // Grammar explainer videos are the platform's standout content (see
  // media content policy) and should surface before songs/movies/video
  // in the default "all categories" view; within that, accessible-first
  // per the access-tier policy's list-ordering rule (stable sort, so
  // neither reordering disturbs the other). Level (A1->C1) and then
  // alphabetical-by-title break remaining ties — without them, items
  // within each of those buckets were left in getAllMedia()'s raw
  // (effectively arbitrary) order, which read as no order at all
  // (reported: "материалы отсортированы хаотично").
  const items = allMedia
    // Hide items the embed-status checker (npm run check:media-embeds /
    // the admin "Verificar enlaces de YouTube" button) has confirmed are
    // broken — better an item silently missing from the catalog than a
    // dead "Video unavailable" player reaching a real user.
    .filter((item) => item.embedStatus !== "blocked")
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      level: item.level,
      category: item.category,
      youtubeVideoId: item.youtubeVideoId,
      locked: !canAccessMediaItem(tier, item),
    }))
    .sort(
      (a, b) =>
        (a.category === "grammar" ? 0 : 1) - (b.category === "grammar" ? 0 : 1) ||
        Number(a.locked) - Number(b.locked) ||
        (levelRank.get(a.level) ?? 0) - (levelRank.get(b.level) ?? 0) ||
        a.title.localeCompare(b.title, lang)
    );

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
