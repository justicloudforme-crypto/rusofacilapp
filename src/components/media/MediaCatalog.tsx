"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { mediaLevels, mediaCategories, type MediaLevel, type MediaCategory } from "@/lib/media/types";
import LevelBadge from "@/components/LevelBadge";
import { usePaywall } from "@/contexts/PaywallContext";
import FilterChipGroup from "@/components/ui/FilterChipGroup";

export interface MediaSummary {
  id: string;
  title: string;
  description: string;
  level: MediaLevel;
  category: MediaCategory;
  youtubeVideoId: string;
  /** Whether THIS visitor needs a subscription to open it — see
   * entitlement.ts's canAccessMediaItem. The list itself already arrives
   * pre-sorted accessible-first (see [lang]/media/page.tsx). */
  locked: boolean;
}

export interface MediaCatalogDict {
  filterAllLevels: string;
  filterAllCategories: string;
  levelFilterLabel: string;
  categoryFilterLabel: string;
  categorySong: string;
  categoryMovie: string;
  categoryVideo: string;
  categoryGrammar: string;
  openButton: string;
  emptyState: string;
  loadMoreButton: string; // template, contains literal "{count}"
  premiumBadge: string;
}

const PAGE_SIZE = 24;

export default function MediaCatalog({
  lang,
  items,
  dict,
}: {
  lang: string;
  items: MediaSummary[];
  dict: MediaCatalogDict;
}) {
  const [level, setLevel] = useState<"all" | MediaLevel>("all");
  const [category, setCategory] = useState<"all" | MediaCategory>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { openPaywall } = usePaywall();
  // Same navOffset-below-header sticky technique as StoriesCatalog/
  // StoryAudioPlayer — the Navbar is itself `sticky top-0 z-50`.
  const [navOffset, setNavOffset] = useState(0);

  useEffect(() => {
    const header = document.querySelector("header");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (header) setNavOffset(header.getBoundingClientRect().height);
  }, []);

  const categoryLabels: Record<MediaCategory, string> = {
    song: dict.categorySong,
    movie: dict.categoryMovie,
    video: dict.categoryVideo,
    grammar: dict.categoryGrammar,
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (level === "all" || item.level === level) &&
          (category === "all" || item.category === category)
      ),
    [items, level, category]
  );

  // A filter change can make `visibleCount` stale (too low to show a
  // just-narrowed list in full, or pointlessly high after switching to a
  // smaller filter) — reset the page window whenever the filtered set
  // itself changes rather than tracking level/category separately.
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  return (
    <div>
      {/* Sticky filter panel: pins just below the sticky Navbar once the
          catalog scrolls past it (same navOffset + bg-background/95
          backdrop-blur-sm sticky pattern as StoriesCatalog/StoryAudioPlayer/
          the flashcards filter bars). z-20 stays under the Navbar's z-50. */}
      <div
        style={{ top: navOffset }}
        className="sticky z-20 flex flex-col gap-3 bg-background/95 py-3 backdrop-blur-sm"
      >
        <FilterChipGroup
          label={dict.levelFilterLabel}
          options={[
            { id: "all" as const, label: dict.filterAllLevels },
            ...mediaLevels.map((lvl) => ({ id: lvl, label: lvl })),
          ]}
          activeId={level}
          onChange={(value) => { setLevel(value); setVisibleCount(PAGE_SIZE); }}
        />

        <FilterChipGroup
          label={dict.categoryFilterLabel}
          options={[
            { id: "all" as const, label: dict.filterAllCategories },
            ...mediaCategories.map((cat) => ({ id: cat, label: categoryLabels[cat] })),
          ]}
          activeId={category}
          onChange={(value) => { setCategory(value); setVisibleCount(PAGE_SIZE); }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/60">{dict.emptyState}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <Link
              key={item.id}
              href={`/${lang}/media/${item.id}`}
              onClick={(e) => {
                if (!item.locked) return;
                e.preventDefault();
                openPaywall("free");
              }}
              className="tap group flex flex-col overflow-hidden rounded-2xl border border-black/10 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-foreground/5">
                {/* Static YouTube-hosted thumbnail (img.youtube.com) — no
                    API call, no re-hosting, same "read-only, no runtime
                    generation" spirit as the rest of this catalog. */}
                <Image
                  src={`https://img.youtube.com/vi/${item.youtubeVideoId}/mqdefault.jpg`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {item.locked && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    🔒 {dict.premiumBadge}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <LevelBadge level={item.level} />
                  <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground/70">
                    {categoryLabels[item.category]}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-medium">{item.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-foreground/70">{item.description}</p>
                <span className="mt-4 text-sm font-medium text-foreground/70 group-hover:text-foreground">
                  {dict.openButton} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="tap rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 active:bg-foreground/5 dark:border-white/15"
          >
            {dict.loadMoreButton.replace("{count}", String(remaining))}
          </button>
        </div>
      )}
    </div>
  );
}
