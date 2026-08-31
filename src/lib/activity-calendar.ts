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
 * Four kinds, and they are the four the learner is told about in the legend:
 *   active  — a day they studied
 *   frozen  — a day a streak freeze covered
 *   missed  — a day inside their period with nothing on it
 *   outside — a day that is not theirs to have studied: before they
 *             registered, still in the future, or a square belonging to a
 *             neighbouring month (those carry `dateKey: null`).
 */
export type CalendarCellState = "active" | "frozen" | "missed" | "outside";

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
    cells.push({ dateKey: null, day: null, state: "outside", isToday: false });
  }

  for (let day = 1; day <= total; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    // Order matters and is checked in the tests: a day can only be frozen
    // if nothing was studied on it, so `active` is asked first and a data
    // change can never paint a studied day as frozen.
    const state: CalendarCellState = active.has(dateKey)
      ? "active"
      : dateKey < input.firstDateKey || dateKey > input.todayKey
        ? "outside"
        : frozen.has(dateKey)
          ? "frozen"
          : "missed";
    cells.push({ dateKey, day, state, isToday: dateKey === input.todayKey });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ dateKey: null, day: null, state: "outside", isToday: false });
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

/** Re-exported so a caller building a grid never reaches for a second
 * day-arithmetic helper. */
export { addDateKeyDays };
