"use client";

import { useState } from "react";
import {
  clampMonth,
  formatDateKey,
  monthGrid,
  monthKeyOf,
  monthStates,
  monthSummary,
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
// effect in this file — every day it can ever show, and everything it can
// say about that day, arrives as a prop. Opening a day and paging to
// another month are `useState` over data already in hand. That is not an
// accident of the current implementation; it is the property
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
  /** Two separate words for what used to be one faint square. See
   * CalendarCellState in src/lib/activity-calendar.ts. */
  legendBeforeStart: string;
  legendFuture: string;
  legendToday: string;
  /** January first, twelve of them, nominative — the header's form. */
  months: string[];
  /** January first, in whatever form `datePattern` needs. Russian wants the
   * genitive here ("30 августа"), Spanish the same word as the header. */
  monthsInDate: string[];
  /** Carries {day} and {month}. */
  datePattern: string;
  /** Monday first, seven of them — the short forms in the header row. */
  weekdays: string[];
  /** Monday first — the full names, for screen readers. */
  weekdaysFull: string[];
  summaryStudied: string;
  summarySaved: string;
  dayOpenLabel: string;
  dayCloseLabel: string;
  /** Carries {date}. */
  dayDetailHeading: string;
  /** What each StudyDay source is called, keyed by the source string. */
  sourceLabels: Record<string, string>;
}

export default function ActivityCalendar({
  activeDateKeys,
  frozenDateKeys,
  daySources,
  todayKey,
  firstDateKey,
  dict,
}: {
  activeDateKeys: string[];
  /** Days a streak freeze covered. Their own kind of square, never merged
   * into "studied": the streak survived those days, the learner did not
   * study on them, and saying otherwise would make the number a lie. */
  frozenDateKeys: string[];
  /** For each studied day, what the learner did on it. Read-only, handed
   * down whole — the disclosure below is a display of data already loaded,
   * not a lookup that goes anywhere. */
  daySources: Record<string, string[]>;
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
  // Which day's detail is open, or null. Closing on a month change is
  // deliberate: a panel describing the 12th of August while the grid shows
  // September is a panel nobody can trace back to a square.
  const [openDay, setOpenDay] = useState<string | null>(null);

  const goToMonth = (delta: number) => {
    setMonthKey((current) => clampMonth(shiftMonth(current, delta), min, max));
    setOpenDay(null);
  };

  const weeks = monthGrid(monthKey, { activeDateKeys, frozenDateKeys, todayKey, firstDateKey });
  const summary = monthSummary(weeks);
  // Only the squares this month actually has get a line in the key below.
  const drawn = monthStates(weeks);
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const year = monthKey.slice(0, 4);
  const canGoBack = monthKey > min;
  const canGoForward = monthKey < max;

  const openSources = openDay ? daySources[openDay] ?? [] : [];

  return (
    // The cap exists so the squares stay squares a person can read rather
    // than a wall: seven aspect-square cells across a 720px column are
    // 100px each. Below `md` the calendar is still the full width of the
    // page, so the cap is what keeps a cell near 48px — the touch-target
    // floor the project keeps (CLAUDE.md).
    //
    // From `md` up it is REMOVED, because from there the Overview page puts
    // the calendar in its own column beside the tiles and the column is
    // already the right size: the cap was measured holding the grid at
    // 384px inside a 720px container at 768, 820, 834 and 1024 alike —
    // 53.3% of the container, with 336px of bare page to its right — and a
    // fixed 384px inside a ~348px column would be the same defect pointing
    // the other way. Inside the column the cells follow the column, which
    // is the whole point of having one.
    <div className="max-w-sm md:max-w-none">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
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
          onClick={() => goToMonth(1)}
          disabled={!canGoForward}
          aria-label={dict.nextMonth}
          className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-black/10 text-foreground/70 disabled:opacity-30 dark:border-white/25"
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      {/* 2px gaps below `sm` and 4px from there up. Measured, not guessed:
          at a 320px viewport the grid has 288px to divide by seven, and every
          pixel spent on a gap comes straight out of the finger target — the
          two saved per gap are 1.7px added to each day. */}
      <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-xs text-foreground/50 sm:gap-1">
        {dict.weekdays.map((label, i) => (
          <abbr key={label} title={dict.weekdaysFull[i]} className="no-underline">
            {label}
          </abbr>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-1">
        {weeks.flat().map((cell, index) => (
          <Day
            key={cell.dateKey ?? `pad-${index}`}
            cell={cell}
            dict={dict}
            hasSources={cell.dateKey !== null && (daySources[cell.dateKey]?.length ?? 0) > 0}
            isOpen={cell.dateKey !== null && cell.dateKey === openDay}
            onToggle={() => setOpenDay((current) => (current === cell.dateKey ? null : cell.dateKey))}
          />
        ))}
      </div>

      {/* The day disclosure: what the learner did, ON THE PAGE, opened by a
          tap. Not a `title` and not a hover — the Capacitor build has
          neither (CLAUDE.md), so a calendar that answers "what did I do on
          the 12th?" only on hover does not answer it at all on a phone. */}
      {openDay && openSources.length > 0 && (
        <div className="mt-3 rounded-xl border border-black/10 bg-foreground/[0.04] p-3 dark:border-white/25">
          <p className="text-sm font-medium">
            {dict.dayDetailHeading.replace(
              "{date}",
              formatDateKey(openDay, dict.datePattern, dict.monthsInDate),
            )}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/70">
            {openSources.map((source) => (
              <li key={source} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="text-[13px] leading-none">
                  🔥
                </span>
                {/* An unknown source (an old row, a surface added later)
                    shows its own name rather than vanishing: a day that
                    happened must not read as empty. */}
                {dict.sourceLabels[source] ?? source}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* How the month on screen went. Counted from the grid itself, so this
          line can never disagree with the squares above it. Written as
          label-then-number, the same shape as the freeze balance below the
          calendar — which also means neither locale has to inflect a noun
          against a count it cannot know in advance.
          NO SNOWFLAKE HERE, deliberately. Both items wear the swatch of the
          square they count, and the ❄️ is reserved for the one thing that is
          not a day on this grid: the balance below. Until 01.09.2026 a
          snowflake stood next to "Спасено заморозкой" here and next to
          "Осталось заморозок" two lines down, in the same small grey type,
          and the two read as one repeated fact. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/60">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-[13px] leading-none">
            🔥
          </span>
          {dict.summaryStudied}: <b className="tabular-nums">{summary.active}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3.5 w-3.5 rounded border-2 border-dashed border-sky-500/70 bg-sky-400/25 dark:border-sky-300/70 dark:bg-sky-300/25"
          />
          {dict.summarySaved}: <b className="tabular-nums">{summary.frozen}</b>
        </span>
      </p>

      {/* A LINE ON THE PAGE, not a tooltip. Hover does not exist on the
          Capacitor build (CLAUDE.md), so a colour explained only by `title`
          is a colour a learner on a phone can never look up. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground/60 md:flex-nowrap md:gap-x-3 md:whitespace-nowrap md:text-xs">
        {/* The flame and the blue square are NOT repeated here: the summary
            line directly above already shows each of them next to the words
            for what it means, with a count. Saying it twice, two lines
            apart, in the same small grey type, made three stacked rows that
            all looked like the same sentence. Every one of the five kinds is
            still named in text on this page — which is the property the
            legend exists for, and the one the test asserts. */}
        {drawn.states.has("missed") && (
          <LegendItem label={dict.legendMissed}>
            {/* Three greys stood on this line and two of them were the SAME
                value: beforeStart and future were both bg-foreground/[0.04],
                byte for byte, and "missed" at /10 differed from them by six
                hundredths of an alpha on a 14px square. So they are now told
                apart by SHAPE — solid here, a hairline outline for "before
                you registered", a dotted one for "hasn't happened yet" —
                with every fill left exactly as 7.71 tuned it.
                The same three shapes are on the squares themselves (see
                `tone` below), because a key that does not look like the
                thing it explains is not a key. A 1px hairline is not the
                2px dashed border 7.71 took off: that one drew a frame
                around every day of the first half of the month and was the
                loudest thing in the grid; this one is the quietest mark
                that makes two identical squares two squares. */}
            {/* The swatch carries the cold flame for the same reason the
                studied day's line carries a hot one two lines up: a key that
                does not look like the thing it explains is not a key. */}
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-foreground/10 dark:bg-foreground/15">
              <span aria-hidden className="ice-flame text-[9px] leading-none">
                🔥
              </span>
            </span>
          </LegendItem>
        )}
        {/* The two faint squares. They look alike on purpose — neither is
            a day the learner could have studied — but they are named apart,
            because "fuera de tu periodo" had to stand for both "before you
            existed here" and "hasn't happened yet", and it told the learner
            neither. */}
        {drawn.states.has("beforeStart") && (
          <LegendItem label={dict.legendBeforeStart}>
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded border border-foreground/15 bg-foreground/[0.04] dark:border-foreground/25 dark:bg-foreground/[0.06]"
            />
          </LegendItem>
        )}
        {drawn.states.has("future") && (
          <LegendItem label={dict.legendFuture}>
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded border border-dotted border-foreground/30 bg-foreground/[0.04] dark:border-foreground/40 dark:bg-foreground/[0.06]"
            />
          </LegendItem>
        )}
        {/* Today keeps its place at the END of the line and is never
            dropped: the ring is drawn on top of whatever state the square
            already has, so it is the one entry that is not a colour of its
            own. Before this the line wrapped to two rows at every tablet
            width and "hoy" was the orphan on the second one. */}
        {drawn.today && (
          <LegendItem label={dict.legendToday}>
            <span
              aria-hidden
              className="h-3.5 w-3.5 flex-shrink-0 rounded ring-2 ring-primary/60 ring-offset-1 ring-offset-background"
            />
          </LegendItem>
        )}
      </ul>
    </div>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="inline-flex flex-shrink-0 items-center gap-1.5">
      {children}
      {label}
    </li>
  );
}

function Day({
  cell,
  dict,
  hasSources,
  isOpen,
  onToggle,
}: {
  cell: CalendarCell;
  dict: ActivityCalendarDict;
  hasSources: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (cell.state === "padding" || cell.dateKey === null) {
    // A square belonging to a neighbouring month. Kept in the flow so the
    // grid stays seven wide, and empty so it never reads as a missed day.
    return <span aria-hidden className="aspect-square" />;
  }

  const legend =
    cell.state === "active"
      ? dict.legendActive
      : cell.state === "frozen"
        ? dict.legendFrozen
        : cell.state === "beforeStart"
          ? dict.legendBeforeStart
          : cell.state === "future"
            ? dict.legendFuture
            : dict.legendMissed;

  const tone =
    cell.state === "active"
      ? // Warm, and tied to the flame rather than to the page's blue. At
        // bg-primary/15 a studied day and a missed day were the same weight
        // of grey on cream, so the flame was carrying the whole distinction
        // on its own.
        "bg-folk-red/10 text-foreground"
      : cell.state === "frozen"
        ? "border-2 border-dashed border-sky-500/70 bg-sky-400/25 text-foreground dark:border-sky-300/70 dark:bg-sky-300/25"
        : cell.state === "beforeStart"
          ? // Barely there, and the fill is exactly what 7.71 tuned it to:
            // a dashed 2px outline used to draw a frame around every day of
            // the first half of the month for an account registered
            // mid-month, and it was the loudest thing in the grid. The
            // hairline added here is a tenth of that weight, and it is what
            // makes this square tellable from "future" at all — the two
            // were the same declaration, character for character.
            "border border-foreground/15 bg-foreground/[0.04] text-foreground/25 dark:border-foreground/25 dark:bg-foreground/[0.06]"
          : cell.state === "future"
            ? "border border-dotted border-foreground/30 bg-foreground/[0.04] text-foreground/25 dark:border-foreground/40 dark:bg-foreground/[0.06]"
            : "bg-foreground/10 text-foreground/60 dark:bg-foreground/15";

  // The number is in the SAME place and at the SAME size in every square,
  // whatever else the square carries. It used to move to the corner and
  // shrink on a studied day, so scanning a column of dates meant the eye
  // re-finding the number in two different places — the flame was moving
  // the date around, which is backwards.
  const label = `${cell.dateKey} — ${legend}${cell.isToday ? `, ${dict.legendToday}` : ""}`;
  const body = (
    <>
      <span aria-hidden className="text-xs leading-none tabular-nums">
        {cell.day}
      </span>
      {/* Today is not a day without study until it is over — the same grace
          the streak itself gives it (src/lib/streak-freezes.ts) — so it wears
          its ring and no cold flame. */}
      {(cell.state === "active" || (cell.state === "missed" && !cell.isToday)) && (
        <span
          aria-hidden
          // ONE glyph for both kinds of day, and the difference between them
          // is that the missed one is cold (`.ice-flame`, src/app/globals.css).
          // A day without study used to be a bare grey square, which reads as
          // "nothing was drawn here" rather than as "the fire went out"; the
          // pair only says that if it is visibly the same fire.
          //
          // The glyph paints a little above its own box, so the box sits
          // lower than the corner it looks like it is in.
          className={`pointer-events-none absolute right-[3px] top-[5px] text-[9px] leading-none${
            cell.state === "missed" ? " ice-flame" : ""
          }`}
        >
          🔥
        </span>
      )}
    </>
  );
  // `min-h-11` = 44px, the project's touch-target floor (CLAUDE.md), and it
  // is a floor on HEIGHT only because height is the dimension that is free.
  // Width at 320px is 288/7 minus gaps ≈ 41px and cannot be 44 without a
  // grid wider than the phone — the arithmetic is printed by
  // e2e/activity-calendar.spec.ts, which asserts on both numbers.
  const shape = `relative flex aspect-square min-h-11 items-center justify-center rounded-lg ${tone} ${
    cell.isToday ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""
  }`;

  // Only a day with something to say is a control. A day with nothing on it
  // must do nothing when tapped — a button that opens an empty panel is
  // worse than no button.
  if (!hasSources) {
    return (
      <span data-state={cell.state} data-date={cell.dateKey} aria-label={label} className={shape}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-state={cell.state}
      data-date={cell.dateKey}
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${label}. ${isOpen ? dict.dayCloseLabel : dict.dayOpenLabel}`}
      className={`tap ${shape} ${isOpen ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      {body}
    </button>
  );
}
