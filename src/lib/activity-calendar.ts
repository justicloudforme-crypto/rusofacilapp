import { addDateKeyDays } from "./timezone";

// The month grid behind the /profile activity calendar.
//
// Pure string arithmetic over "YYYY-MM-DD" date keys, with no Date
// construction of its own beyond what addDateKeyDays already does, and no
// notion of "now": the caller passes today's key in. That is deliberate and
// it is the same rule the streak follows — the day boundary of anything a
// learner sees comes from src/lib/timezone.ts and from nowhere else. A
// calendar that called `new Date().getMonth()` would be a second
// implementation of "what day is it", which is exactly the defect fixed on
// 31.08.2026 (PROGRESS.md 7.68).
//
// It also writes nothing and reads nothing: given the same arguments it
// returns the same grid, which is what lets "the calendar only reads" be a
// test rather than a promise.

/** What a single square of the grid is.
 *
 * Five kinds a learner can see, plus one they cannot:
 *   active      — a day they studied
 *   frozen      — a day a streak freeze covered
 *   missed      — a day inside their period with nothing on it
 *   beforeStart — a day before they registered: not theirs to have missed
 *   future      — a day that has not happened yet
 *   padding     — a square belonging to a neighbouring month, kept only so
 *                 every row is seven wide. Carries `dateKey: null` and is
 *                 rendered `aria-hidden`, so it never needs a legend.
 *
 * `beforeStart` and `future` were ONE state ("outside") until 01.09.2026,
 * and that is why the legend could only call it "fuera de tu periodo" /
 * "вне периода" — a phrase that had to cover two opposite things at once.
 * Splitting them is what lets the legend say "antes de registrarte" /
 * "до регистрации" without lying about the days after today, which wear the
 * same faint wash. */
export type CalendarCellState = "active" | "frozen" | "missed" | "beforeStart" | "future" | "padding";

export interface CalendarCell {
  /** null only for the padding squares of a neighbouring month. */
  dateKey: string | null;
  /** Day of month, for the label. null for padding squares. */
  day: number | null;
  state: CalendarCellState;
  isToday: boolean;
}

/** "YYYY-MM" of a date key. */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** Shifts a "YYYY-MM" month key by whole months.
 *
 * Month arithmetic on the numbers, not on a Date: adding a month to a Date
 * that happens to be the 31st lands in the month after next, and a grid
 * that skips March once a year is the kind of bug nobody reports because it
 * looks like a mistake they made themselves. */
export function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)); // 1-12
  const zeroBased = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(zeroBased / 12);
  const newMonth = zeroBased - newYear * 12 + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

/** Keeps a month key inside [min, max]. Both bounds inclusive; string
 * comparison is correct here because "YYYY-MM" sorts chronologically. */
export function clampMonth(monthKey: string, min: string, max: string): string {
  if (monthKey < min) return min;
  if (monthKey > max) return max;
  return monthKey;
}

/** Days in the given "YYYY-MM". */
export function daysInMonth(monthKey: string): number {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday, for a "YYYY-MM-DD" key.
 *
 * The week starts on Monday in both locales — Spanish and Russian calendars
 * both do, and a calendar that started on Sunday for one of them would be
 * two different products. Anchored at noon UTC for the same reason
 * addDateKeyDays is: a date key is a calendar date, not an instant, and
 * midnight is the one hour a DST shift can move across a day boundary. */
export function weekdayIndex(dateKey: string): number {
  const sundayFirst = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return (sundayFirst + 6) % 7;
}

export interface MonthGridInput {
  /** Days the learner studied. */
  activeDateKeys: Iterable<string>;
  /** Days a freeze covered — painted as their own kind, never as studied. */
  frozenDateKeys: Iterable<string>;
  /** Today, in the learner's zone. */
  todayKey: string;
  /** The learner's first day: their registration date, in their zone.
   * Everything before it is "outside" — they cannot have missed a day that
   * predates their account, and a grid that scolds them for it is lying. */
  firstDateKey: string;
}

/** The month laid out as weeks of seven, Monday first, padded at both ends
 * so every row is exactly seven squares. */
export function monthGrid(monthKey: string, input: MonthGridInput): CalendarCell[][] {
  const active = new Set(input.activeDateKeys);
  const frozen = new Set(input.frozenDateKeys);
  const total = daysInMonth(monthKey);
  const firstKey = `${monthKey}-01`;
  const leadingBlanks = weekdayIndex(firstKey);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ dateKey: null, day: null, state: "padding", isToday: false });
  }

  for (let day = 1; day <= total; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    // Order matters and is checked in the tests: a day can only be frozen
    // if nothing was studied on it, so `active` is asked first and a data
    // change can never paint a studied day as frozen.
    // Order matters and the tests pin it. `active` is asked first, so a data
    // change can never paint a studied day as frozen. The two "not theirs"
    // cases are asked next and kept apart, because the learner is told two
    // different things about them.
    const state: CalendarCellState = active.has(dateKey)
      ? "active"
      : dateKey < input.firstDateKey
        ? "beforeStart"
        : dateKey > input.todayKey
          ? "future"
          : frozen.has(dateKey)
            ? "frozen"
            : "missed";
    cells.push({ dateKey, day, state, isToday: dateKey === input.todayKey });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, state: "padding", isToday: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The window the learner may page through: from the month they registered
 * in to the month they are in now, both inclusive. Back is bounded because
 * there is nothing behind it; forward because a calendar that offers next
 * month is offering an empty grid. */
export function navigableMonths(firstDateKey: string, todayKey: string): { min: string; max: string } {
  const min = monthKeyOf(firstDateKey);
  const max = monthKeyOf(todayKey);
  return { min: min > max ? max : min, max };
}

/** How the month that is on screen went: studied days and days a freeze
 * covered, counted from the grid itself so the number under the calendar can
 * never disagree with the squares above it.
 *
 * Padding squares carry `dateKey: null` and are skipped, so a month whose
 * grid leans into its neighbours is still counted correctly. */
export function monthSummary(weeks: CalendarCell[][]): { active: number; frozen: number } {
  let active = 0;
  let frozen = 0;
  for (const cell of weeks.flat()) {
    if (cell.dateKey === null) continue;
    if (cell.state === "active") active++;
    else if (cell.state === "frozen") frozen++;
  }
  return { active, frozen };
}

/** A date key as a person reads it, in their own language.
 *
 * Built from the dictionary rather than from `Intl.DateTimeFormat` for the
 * same reason the grid's month names are: locale data is not a contract, the
 * two locales need different shapes ("30 de agosto" against "30 августа"),
 * and Russian needs the genitive form of the month, which the nominative
 * list used by the calendar header cannot supply. Both come from the
 * dictionaries, so what a translator sees is what a reader gets.
 *
 * `pattern` carries {day} and {month}; `months` is January-first and in
 * whatever form the pattern needs. */
export function formatDateKey(dateKey: string, pattern: string, months: string[]): string {
  const day = Number(dateKey.slice(8, 10));
  const monthIndex = Number(dateKey.slice(5, 7)) - 1;
  const month = months[monthIndex] ?? "";
  return pattern.replace("{day}", String(day)).replace("{month}", month);
}

/** Re-exported so a caller building a grid never reaches for a second
 * day-arithmetic helper. */
export { addDateKeyDays };
