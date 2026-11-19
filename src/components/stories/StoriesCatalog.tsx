"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { storyLevels, storyTopics, type StoryLevel, type StoryTopic } from "@/lib/stories";
import LevelBadge from "@/components/LevelBadge";
import AccessMark from "@/components/ui/AccessMark";
import {
  accessSignFor,
  levelRequirement,
  sortSign,
  type AccessRequirement,
  type ViewerTier,
} from "@/lib/access-marks";
import { useIsNativeShell } from "@/lib/native-shell-client";
import FilterChipGroup, { filterChipClass } from "@/components/ui/FilterChipGroup";
import { getAllStoryProgress, syncStoryProgress, type StoryProgress } from "@/lib/reading-progress";
import { usePaywall } from "@/contexts/PaywallContext";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";
import StoryTitle from "@/components/stories/StoryTitle";
import type { StoryTitleView } from "@/lib/story-title";

export interface StorySummary {
  id: string;
  /** Готовая пара «что показать крупно / что мельче» — считается на
   * сервере (`storyTitles`), а не здесь: правило заморозки живёт в
   * `story-pilot.ts`, и тащить его список из 65 названий в браузерный
   * бандл ради карточки незачем. */
  titles: StoryTitleView;
  author: string;
  /** Готовая подпись: «Por …» у автора, без «Por» у народной сказки. */
  byline: string;
  level: StoryLevel;
  isPremium: boolean;
  /** Whether (and why) THIS visitor can't open this story right now — see
   * entitlement.ts's getStoryAccess. `null` means fully accessible. Drives
   * the crown badge + paywall-on-click below; the list itself already
   * arrives pre-sorted accessible-first (see [lang]/stories/page.tsx). */
  lockReason: "free" | "premium" | null;
  /** Чего требует САМ рассказ, независимо от роли смотрящего, — то, из
   *  чего общее правило делает знак сорта (7.196, часть 1). */
  requires: AccessRequirement;
  description: string | null;
  hasAudio: boolean;
  readingMinutes: number | null;
  topic: StoryTopic;
  isClassic: boolean;
}

export interface StoriesCatalogDict {
  filterAll: string;
  levelFilterLabel: string;
  subscriptionBadge: string;
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
  /** Кнопка «Filtros» — сворачивает липкий блок фильтров на телефоне
   *  (долг 178, 7.284). На `sm` и шире не показывается. */
  filtersButton: string;
  /** Template containing the literal placeholder "{minutes}". */
  readingTimeLabel: string;
  /** Template containing the literal placeholder "{percent}". */
  progressLabel: string;
  /** Подпись под прогрессом закрытого рассказа (долг 206, 7.292; решение
   *  владельца 15.11.2026, вариант «б»): прогресс честный, но рассказ
   *  сейчас не открыть — карточка говорит это словами. */
  closedProgressNote: string;
  closedProgressNotePremium: string;
  /** Template containing the literal placeholder "{count}". */
  loadMoreButton: PluralForms;
}

const PAGE_SIZE = 24;

export default function StoriesCatalog({
  lang,
  stories,
  dict,
  tier,
}: {
  lang: Locale;
  stories: StorySummary[];
  dict: StoriesCatalogDict;
  /** Тариф смотрящего — нужен общему правилу знака. В вебе оно с этим
   *  тарифом возвращает ровно прежний `accessMarkFor`. */
  tier: ViewerTier;
}) {
  const nativeShell = useIsNativeShell();
  const [filter, setFilter] = useState<"all" | StoryLevel>("all");
  const [topicFilter, setTopicFilter] = useState<"all" | StoryTopic>("all");
  const [classicOnly, setClassicOnly] = useState(false);
  // ДОЛГ 178 (7.284). На телефоне липкий блок с тремя рядами фильтров
  // занимал 228 из 640 CSS-пикселей (вместе с шапкой — 46 % экрана), и
  // в кадр влезала одна карточка. Теперь ниже `sm` липкой остаётся одна
  // кнопка «Filtros», ряды раскрываются по нажатию и сами сворачиваются
  // после выбора. Ряды остаются в DOM (скрыты CSS), поэтому сторож знаков
  // `check:access-signs` и подписи для чтения экрана видят их как прежде.
  // На `sm` и шире всё как было. Стережёт e2e/stories-catalog-phone.spec.ts.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(filter !== "all") + Number(topicFilter !== "all") + Number(classicOnly);
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
        // Обе строки названия, а не только напечатанная крупно: на
        // `/es` испаноговорящий ищет по испанскому, а тот, кто уже
        // услышал русское, — по русскому, и найтись обязаны оба.
        const matches =
          story.titles.primary.toLowerCase().includes(trimmedQuery) ||
          (story.titles.secondary?.toLowerCase().includes(trimmedQuery) ?? false) ||
          story.author.toLowerCase().includes(trimmedQuery);
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
        data-testid="story-filters"
        className="sticky z-20 mt-4 flex flex-col gap-3 bg-background/95 py-2 backdrop-blur-sm sm:py-3"
      >
        <button
          type="button"
          data-testid="story-filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="story-filter-rows"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${filterChipClass(activeFilters > 0)} gap-1.5 self-start sm:hidden`}
        >
          {dict.filtersButton}
          {activeFilters > 0 && <span>· {activeFilters}</span>}
          <svg aria-hidden viewBox="0 0 20 20" fill="none" className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`}>
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div id="story-filter-rows" className={`${filtersOpen ? "flex" : "hidden"} flex-col gap-3 sm:flex`}>
        {/* ЗНАК НА ПОЛОСЕ УРОВНЕЙ — 7.196, часть 1. Владелец снял с
            телефона: в словаре на C1 стоит «C1 👑», а в каталоге
            рассказов у того же C1 знака нет вовсе, хотя все 65 рассказов
            уровня требуют плана Premium (`getStoryAccess`). Знак приходит
            от общего правила; в вебе полоса остаётся прежней. */}
        <FilterChipGroup
          testId="story-level-filter"
          label={dict.levelFilterLabel}
          options={[
            { id: "all" as const, label: dict.filterAll },
            ...storyLevels.map((level) => {
              const sign = nativeShell ? sortSign(levelRequirement("stories", level)) : null;
              return {
                id: level,
                label: level,
                accessMark: sign?.mark,
                accessLabel: sign
                  ? sign.labelKey === "premiumTierBadge"
                    ? dict.premiumTierBadge
                    : dict.subscriptionBadge
                  : undefined,
              };
            }),
          ]}
          activeId={filter}
          onChange={(value) => { setFilter(value); setVisibleCount(PAGE_SIZE); setFiltersOpen(false); }}
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
          onChange={(value) => { setTopicFilter(value); setVisibleCount(PAGE_SIZE); setFiltersOpen(false); }}
        />

        <button
          type="button"
          onClick={() => {
            setClassicOnly((v) => !v);
            setVisibleCount(PAGE_SIZE);
            setFiltersOpen(false);
          }}
          aria-pressed={classicOnly}
          className={`${filterChipClass(classicOnly)} self-start`}
        >
          {dict.classicOnlyLabel}
        </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-foreground/60">{dict.emptyState}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {visible.map((story) => {
            const progress = progressById[story.id];
            const isLocked = story.lockReason !== null;
            return (
              <Link
                key={story.id}
                data-testid="story-card"
                href={`/${lang}/stories/${story.id}`}
                onClick={(e) => {
                  if (!isLocked) return;
                  e.preventDefault();
                  openPaywall(story.lockReason ?? "free", "story");
                }}
                className="tap group flex flex-col rounded-2xl border border-black/10 p-4 transition-colors sm:p-6 hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
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
                    {/* ОДИН значок, и только тому, кто не может открыть.
                        До 07.09.2026 их печаталось до двух сразу — «⭐
                        Premium» по колонке `isPremium` (то есть у 225
                        рассказов из 323, которым никакого Premium не
                        нужно) плюс «👑 Solo Premium» у ещё 98. Что
                        рисовать, решает один признак на весь сайт, см.
                        src/lib/access-marks.ts. */}
                    {/* 7.196: знак решает ОБЩЕЕ правило. Внутри
                        оболочки 👑 стоит у премиального рассказа при любой
                        роли (метка сорта), 🔒 — у закрытого обычного; в
                        вебе возвращается ровно прежнее поведение, знак в
                        знак, потому что `nativeShell: false` отдаёт старый
                        `accessMarkFor`. */}
                    {(() => {
                      // 7.212: рассказ — единица целиком, «частично
                      // открытым» он не бывает. Прежняя строка
                      // `closed: story.lockReason !== null` была тем же
                      // ответом другими словами: равенство
                      // `meetsRequirement(storyRequirement(...), tier)` и
                      // `getStoryAccess(...).entitled` заперто пробой
                      // `access-marks.test.ts` по всем восьми сочетаниям
                      // колонок.
                      const sign = accessSignFor(story.requires, tier, { nativeShell });
                      if (!sign) return null;
                      return (
                        <AccessMark
                          mark={sign.mark}
                          label={sign.labelKey === "premiumTierBadge" ? dict.premiumTierBadge : dict.subscriptionBadge}
                        />
                      );
                    })()}
                  </span>
                </div>
                <StoryTitle as="h2" titles={story.titles} className="mt-3 text-lg font-medium" />
                <p className="mt-1 text-sm text-foreground/60">
                  {story.byline}
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
                {/* Ниже `sm` колонка одна, ровнять соседей по ряду незачем:
                    пустое место не держится (долг 178, 7.284). */}
                <div className={`mt-4 sm:min-h-[38px] ${progress ? "" : "hidden sm:block"}`}>
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
                  {/* Долг 206 (7.292): прогресс у ЗАКРЫТОГО рассказа — настоящий
                      (записан, пока он был открыт), но без этой строки
                      карточка обещала «продолжить» то, что не откроется. */}
                  {progress && isLocked && (
                    <span data-rf-closed-progress className="mt-1.5 block text-xs font-medium text-foreground/70">
                      {story.lockReason === "premium" ? dict.closedProgressNotePremium : dict.closedProgressNote}
                    </span>
                  )}
                </div>

                <span className="mt-3 text-sm font-medium text-foreground/70 group-hover:text-foreground sm:mt-4">
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
            {plural(lang, remaining, dict.loadMoreButton, { count: remaining })}
          </button>
        </div>
      )}
    </div>
  );
}
