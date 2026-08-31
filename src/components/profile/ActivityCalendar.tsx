"use client";

import { useState } from "react";
import {
  clampMonth,
  monthGrid,
  monthKeyOf,
  navigableMonths,
  shiftMonth,
  type CalendarCell,
} from "@/lib/activity-calendar";

// The month calendar on the /profile Overview tab. It replaced the 30-day
// heatmap strip on 31.08.2026 rather than joining it: both drew the same
// four facts from the same keys, and two pictures of one thing in two
// visual languages on one screen is how a page stops being believable.
//
// It READS AND WRITES NOTHING. There is no fetch, no server action and no
// effect in this file — every day it can ever show arrives as a prop, and
// paging to another month is a `useState` over data already in hand. That
// is not an accident of the current implementation; it is the property
// ActivityCalendar.test.tsx asserts directly, and the reason the day mark
// lives on the study pages and not here.
//
// Month navigation is component state rather than a URL parameter on
// purpose: /profile's query string already means "which tab", the whole
// 1500-line page would re-render on every arrow, and there is nothing here
// worth deep-linking to.

export interface ActivityCalendarDict {
  prevMonth: string;
  nextMonth: string;
  legendActive: string;
  legendFrozen: string;
  legendMissed: string;
  legendOutside: string;
  legendToday: string;
  /** January first, twelve of them. */
  months: string[];
  /** Monday first, seven of them — the short forms in the header row. */
  weekdays: string[];
  /** Monday first — the full names, for screen readers. */
  weekdaysFull: string[];
}

export default function ActivityCalendar({
  activeDateKeys,
  frozenDateKeys,
  todayKey,
  firstDateKey,
  dict,
}: {
  activeDateKeys: string[];
  /** Days a streak freeze covered. Their own kind of square, never merged
   * into "studied": the streak survived those days, the learner did not
   * study on them, and saying otherwise would make the number a lie. */
  frozenDateKeys: string[];
  /** Today in the LEARNER's zone, resolved server-side by dateKeyIn. Passed
   * in rather than computed here so the grid and the keys it is matched
   * against are one calendar — see src/lib/activity-calendar.ts. */
  todayKey: string;
  /** The learner's registration day, in the same zone. */
  firstDateKey: string;
  dict: ActivityCalendarDict;
}) {
  const { min, max } = navigableMonths(firstDateKey, todayKey);
  const [monthKey, setMonthKey] = useState(() => clampMonth(monthKeyOf(todayKey), min, max));

  const weeks = monthGrid(monthKey, { activeDateKeys, frozenDateKeys, todayKey, firstDateKey });
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const year = monthKey.slice(0, 4);
  const canGoBack = monthKey > min;
  const canGoForward = monthKey < max;

  return (
    // Capped so the squares stay squares a person can read rather than a
    // wall: the Overview column is 768px wide on a desktop, and seven
    // aspect-square cells across it are 100px each. At this cap a cell is
    // ~48px at every width from 320 up, which is also the touch-target
    // floor the project keeps (CLAUDE.md).
    <div className="max-w-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonthKey((current) => clampMonth(shiftMonth(current, -1), min, max))}
          disabled={!canGoBack}
          aria-label={dict.prevMonth}
          // 44×44 is the project's minimum touch target (CLAUDE.md) — this
          // is the one control on the page a learner taps repeatedly.
          className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-black/10 text-foreground/70 disabled:opacity-30 dark:border-white/25"
        >
          <span aria-hidden>‹</span>
        </button>
        <p className="text-center text-base font-semibold tabular-nums">
          {dict.months[monthIndex]} {year}
        </p>
        <button
          type="button"
          onClick={() => setMonthKey((current) => clampMonth(shiftMonth(current, 1), min, max))}
          disabled={!canGoForward}
          aria-label={dict.nextMonth}
          className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-black/10 text-foreground/70 disabled:opacity-30 dark:border-white/25"
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-foreground/50">
        {dict.weekdays.map((label, i) => (
          <abbr key={label} title={dict.weekdaysFull[i]} className="no-underline">
            {label}
          </abbr>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, index) => (
          <Day key={cell.dateKey ?? `pad-${index}`} cell={cell} dict={dict} />
        ))}
      </div>

      {/* A LINE ON THE PAGE, not a tooltip. Hover does not exist on the
          Capacitor build (CLAUDE.md), so a colour explained only by `title`
          is a colour a learner on a phone can never look up. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-foreground/60">
        <LegendItem label={dict.legendActive}>
          <span aria-hidden className="text-[13px] leading-none">🔥</span>
        </LegendItem>
        <LegendItem label={dict.legendFrozen}>
          <span
            aria-hidden
            className="h-3.5 w-3.5 rounded border-2 border-dashed border-sky-500/70 bg-sky-400/25 dark:border-sky-300/70 dark:bg-sky-300/25"
          />
        </LegendItem>
        <LegendItem label={dict.legendMissed}>
          <span aria-hidden className="h-3.5 w-3.5 rounded bg-foreground/10 dark:bg-foreground/15" />
        </LegendItem>
        <LegendItem label={dict.legendOutside}>
          <span aria-hidden className="h-3.5 w-3.5 rounded border border-dashed border-foreground/20" />
        </LegendItem>
        <LegendItem label={dict.legendToday}>
          <span
            aria-hidden
            className="h-3.5 w-3.5 rounded ring-2 ring-primary/60 ring-offset-1 ring-offset-background"
          />
        </LegendItem>
      </ul>
    </div>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      {children}
      {label}
    </li>
  );
}

function Day({ cell, dict }: { cell: CalendarCell; dict: ActivityCalendarDict }) {
  if (cell.dateKey === null) {
    // A square belonging to a neighbouring month. Kept in the flow so the
    // grid stays seven wide, and empty so it never reads as a missed day.
    return <span aria-hidden className="aspect-square" />;
  }

  const legend =
    cell.state === "active"
      ? dict.legendActive
      : cell.state === "frozen"
        ? dict.legendFrozen
        : cell.state === "outside"
          ? dict.legendOutside
          : dict.legendMissed;

  const tone =
    cell.state === "active"
      ? "bg-primary/15 text-foreground"
      : cell.state === "frozen"
        ? "border-2 border-dashed border-sky-500/70 bg-sky-400/25 text-foreground dark:border-sky-300/70 dark:bg-sky-300/25"
        : cell.state === "outside"
          ? "border border-dashed border-foreground/15 text-foreground/25"
          : "bg-foreground/10 text-foreground/60 dark:bg-foreground/15";

  return (
    <span
      data-state={cell.state}
      data-date={cell.dateKey}
      aria-label={`${cell.dateKey} — ${legend}${cell.isToday ? `, ${dict.legendToday}` : ""}`}
      className={`relative flex aspect-square items-center justify-center rounded-lg text-xs tabular-nums ${tone} ${
        cell.isToday ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""
      }`}
    >
      {cell.state === "active" ? (
        // The flame is the day itself, so the number moves out from under
        // it rather than fighting it for the middle of a 30px square.
        <>
          <span aria-hidden className="text-[13px] leading-none">
            🔥
          </span>
          <span aria-hidden className="absolute bottom-0.5 right-1 text-[10px] leading-none text-foreground/60">
            {cell.day}
          </span>
        </>
      ) : (
        <span aria-hidden>{cell.day}</span>
      )}
    </span>
  );
}
