"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { mediaLevels, mediaCategories, type MediaLevel, type MediaCategory } from "@/lib/media/types";
import LevelBadge from "@/components/LevelBadge";

export interface MediaSummary {
  id: string;
  title: string;
  description: string;
  level: MediaLevel;
  category: MediaCategory;
}

export interface MediaCatalogDict {
  filterAllLevels: string;
  filterAllCategories: string;
  categorySong: string;
  categoryMovie: string;
  categoryVideo: string;
  categoryGrammar: string;
  openButton: string;
  emptyState: string;
}

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

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLevel("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            level === "all"
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
          }`}
        >
          {dict.filterAllLevels}
        </button>
        {mediaLevels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setLevel(lvl)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              level === lvl
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            category === "all"
              ? "bg-foreground/80 text-background"
              : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
          }`}
        >
          {dict.filterAllCategories}
        </button>
        {mediaCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === cat
                ? "bg-foreground/80 text-background"
                : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/60">{dict.emptyState}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/${lang}/media/${item.id}`}
              className="group flex flex-col rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 dark:border-white/10"
            >
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
