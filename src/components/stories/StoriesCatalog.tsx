"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { storyLevels, type StoryLevel } from "@/lib/stories";
import LevelBadge from "@/components/LevelBadge";
import { getAllStoryProgress, syncStoryProgress, type StoryProgress } from "@/lib/reading-progress";

export interface StorySummary {
  id: string;
  title: string;
  author: string;
  level: StoryLevel;
  isPremium: boolean;
  description: string | null;
}

export interface StoriesCatalogDict {
  filterAll: string;
  premiumBadge: string;
  byAuthor: string;
  readButton: string;
  emptyState: string;
  completedBadge: string;
  /** Template containing the literal placeholder "{percent}". */
  progressLabel: string;
}

export default function StoriesCatalog({
  lang,
  stories,
  dict,
}: {
  lang: string;
  stories: StorySummary[];
  dict: StoriesCatalogDict;
}) {
  const [filter, setFilter] = useState<"all" | StoryLevel>("all");
  // Empty until after mount (localStorage isn't available during SSR) —
  // cards simply render without a progress badge until this fills in,
  // same hydration-safe pattern used elsewhere for client-only state.
  const [progressById, setProgressById] = useState<Record<string, StoryProgress>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressById(getAllStoryProgress());
    syncStoryProgress().then(setProgressById);
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? stories : stories.filter((story) => story.level === filter)),
    [stories, filter]
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
          }`}
        >
          {dict.filterAll}
        </button>
        {storyLevels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFilter(level)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === level
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/70 hover:text-foreground dark:border-white/15"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/60">{dict.emptyState}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((story) => {
            const progress = progressById[story.id];
            return (
              <Link
                key={story.id}
                href={`/${lang}/stories/${story.id}`}
                className="group flex flex-col rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <LevelBadge level={story.level} />
                  {story.isPremium && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      ⭐ {dict.premiumBadge}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-medium">{story.title}</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  {dict.byAuthor} {story.author}
                </p>
                {story.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/70">{story.description}</p>
                )}

                {progress?.isCompleted ? (
                  <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <span aria-hidden="true">✓</span> {dict.completedBadge}
                  </span>
                ) : progress ? (
                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="mt-1.5 block text-xs text-foreground/60">
                      {dict.progressLabel.replace("{percent}", String(progress.percent))}
                    </span>
                  </div>
                ) : null}

                <span className="mt-4 text-sm font-medium text-foreground/70 group-hover:text-foreground">
                  {dict.readButton} →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
