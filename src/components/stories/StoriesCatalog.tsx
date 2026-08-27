"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { storyLevels, storyTopics, type StoryLevel, type StoryTopic } from "@/lib/stories";
import LevelBadge from "@/components/LevelBadge";
import PremiumBadge from "@/components/ui/PremiumBadge";
import FilterChipGroup, { filterChipClass } from "@/components/ui/FilterChipGroup";
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
  levelFilterLabel: string;
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
  // Same navOffset-below-header technique as StoryAudioPlayer/StoryText —
  // the site header is itself `sticky top-0 z-50`, so this filter panel's
  // own `sticky` needs a matching `top` offset or it would pin to y=0 and
  // end up hidden behind the header instead of just under it. Measured at
  // runtime since header height varies with safe-area-inset padding.
  const [navOffset, setNavOffset] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgressById(getAllStoryProgress());
    syncStoryProgress().then(setProgressById);
  }, []);

  useEffect(() => {
    const header = document.querySelector("header");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (header) setNavOffset(header.getBoundingClientRect().height);
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

      {/* Sticky filter panel: pins just below the sticky Navbar once the
          catalog scrolls past it (same navOffset + bg-background/95
          backdrop-blur-sm sticky pattern as StoryAudioPlayer/ExamView/the
          flashcards filter bars). z-20 stays under the Navbar's z-50. */}
      <div
        style={{ top: navOffset }}
        className="sticky z-20 mt-4 flex flex-col gap-3 bg-background/95 py-3 backdrop-blur-sm"
      >
        <FilterChipGroup
          label={dict.levelFilterLabel}
          options={[
            { id: "all" as const, label: dict.filterAll },
            ...storyLevels.map((level) => ({ id: level, label: level })),
          ]}
          activeId={filter}
          onChange={(value) => { setFilter(value); setVisibleCount(PAGE_SIZE); }}
        />

        {/* 8 topics total (see storyTopics) — reads well as a horizontal
            chip row, so this replaces the previous <select> dropdown
            rather than just restyling its trigger. */}
        <FilterChipGroup
          label={dict.topicFilterLabel}
          options={[
            { id: "all" as const, label: dict.filterAll },
            ...storyTopics.map((topic) => ({ id: topic, label: dict.topics[topic] })),
          ]}
          activeId={topicFilter}
          onChange={(value) => { setTopicFilter(value); setVisibleCount(PAGE_SIZE); }}
        />

        <button
          type="button"
          onClick={() => {
            setClassicOnly((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          aria-pressed={classicOnly}
          className={`${filterChipClass(classicOnly)} self-start`}
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
