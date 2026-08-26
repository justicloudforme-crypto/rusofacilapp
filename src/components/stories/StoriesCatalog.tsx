"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { storyLevels, storyTopics, type StoryLevel, type StoryTopic } from "@/lib/stories";
import LevelBadge from "@/components/LevelBadge";
import PremiumBadge from "@/components/ui/PremiumBadge";
import { getAllStoryProgress, syncStoryProgress, type StoryProgress } from "@/lib/reading-progress";
import { usePaywall } from "@/contexts/PaywallContext";

export interface StorySummary {
  id: string;
  title: string;
  author: string;
  level: StoryLevel;
  isPremium: boolean;
  /** Whether (and why) THIS visitor can't open this story right now — see
   * entitlement.ts's getStoryAccess. `null` means fully accessible. Drives
   * the crown badge + paywall-on-click below; the list itself already
   * arrives pre-sorted accessible-first (see [lang]/stories/page.tsx). */
  lockReason: "free" | "premium" | null;
  description: string | null;
  hasAudio: boolean;
  readingMinutes: number | null;
  topic: StoryTopic;
  isClassic: boolean;
}

export interface StoriesCatalogDict {
  filterAll: string;
  premiumBadge: string;
  premiumTierBadge: string;
  byAuthor: string;
  readButton: string;
  emptyState: string;
  completedBadge: string;
  audioBadge: string;
  searchPlaceholder: string;
  topicFilterLabel: string;
  topics: Record<StoryTopic, string>;
  classicLabel: string;
  classicOnlyLabel: string;
  /** Template containing the literal placeholder "{minutes}". */
  readingTimeLabel: string;
  /** Template containing the literal placeholder "{percent}". */
  progressLabel: string;
  /** Template containing the literal placeholder "{count}". */
  loadMoreButton: string;
}

const PAGE_SIZE = 24;

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
  const [topicFilter, setTopicFilter] = useState<"all" | StoryTopic>("all");
  const [classicOnly, setClassicOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Empty until after mount (localStorage isn't available during SSR) —
  // cards simply render without a progress badge until this fills in,
  // same hydration-safe pattern used elsewhere for client-only state.
  const [progressById, setProgressById] = useState<Record<string, StoryProgress>>({});
  const { openPaywall } = usePaywall();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressById(getAllStoryProgress());
    syncStoryProgress().then(setProgressById);
  }, []);

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    return stories.filter((story) => {
      if (filter !== "all" && story.level !== filter) return false;
      if (topicFilter !== "all" && story.topic !== topicFilter) return false;
      if (classicOnly && !story.isClassic) return false;
      if (trimmedQuery) {
        const matches =
          story.title.toLowerCase().includes(trimmedQuery) || story.author.toLowerCase().includes(trimmedQuery);
        if (!matches) return false;
      }
      return true;
    });
  }, [stories, filter, topicFilter, classicOnly, query]);
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
        placeholder={dict.searchPlaceholder}
        className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setFilter("all"); setVisibleCount(PAGE_SIZE); }}
          className={`tap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {dict.filterAll}
        </button>
        {storyLevels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => { setFilter(level); setVisibleCount(PAGE_SIZE); }}
            className={`tap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === level
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="story-topic-filter" className="sr-only">
          {dict.topicFilterLabel}
        </label>
        <select
          id="story-topic-filter"
          value={topicFilter}
          onChange={(e) => {
            setTopicFilter(e.target.value as "all" | StoryTopic);
            setVisibleCount(PAGE_SIZE);
          }}
          className="min-h-11 rounded-full border border-black/10 bg-transparent px-4 py-2 text-sm font-medium outline-none focus:border-foreground/40 dark:border-white/15"
        >
          <option value="all">{dict.topicFilterLabel}</option>
          {storyTopics.map((topic) => (
            <option key={topic} value={topic}>
              {dict.topics[topic]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setClassicOnly((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          aria-pressed={classicOnly}
          className={`tap min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            classicOnly
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {dict.classicOnlyLabel}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/60">{dict.emptyState}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((story) => {
            const progress = progressById[story.id];
            const isLocked = story.lockReason !== null;
            return (
              <Link
                key={story.id}
                href={`/${lang}/stories/${story.id}`}
                onClick={(e) => {
                  if (!isLocked) return;
                  e.preventDefault();
                  openPaywall(story.lockReason ?? "free");
                }}
                className="tap group flex flex-col rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <LevelBadge level={story.level} />
                    {story.isClassic && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground/60"
                        title={dict.classicLabel}
                        aria-label={dict.classicLabel}
                      >
                        <span aria-hidden="true">📖</span>
                      </span>
                    )}
                    {story.hasAudio && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary-text dark:bg-primary-400/15 dark:text-primary-400"
                        title={dict.audioBadge}
                        aria-label={dict.audioBadge}
                      >
                        <span aria-hidden="true">🔊</span>
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {story.isPremium && <PremiumBadge icon="⭐">{dict.premiumBadge}</PremiumBadge>}
                    {story.lockReason === "premium" && <PremiumBadge>{dict.premiumTierBadge}</PremiumBadge>}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-medium">{story.title}</h2>
                <p className="mt-1 text-sm text-foreground/60">
                  {dict.byAuthor} {story.author}
                  {story.readingMinutes !== null && (
                    <> · {dict.readingTimeLabel.replace("{minutes}", String(story.readingMinutes))}</>
                  )}
                </p>
                {story.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/70">{story.description}</p>
                )}

                {/* Fixed-height slot regardless of which of the three states
                    below renders — without it, cards in the same grid row
                    end up different heights depending on whether a visitor
                    has any reading progress for that story yet (a confirmed
                    AUDIT.md bug: progress loads client-side after mount, so
                    this was also flashing empty->populated on every visit). */}
                <div className="mt-4 min-h-[38px]">
                  {progress?.isCompleted ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span aria-hidden="true">✓</span> {dict.completedBadge}
                    </span>
                  ) : progress ? (
                    <div>
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
                </div>

                <span className="mt-4 text-sm font-medium text-foreground/70 group-hover:text-foreground">
                  {dict.readButton} →
                </span>
              </Link>
            );
          })}
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
