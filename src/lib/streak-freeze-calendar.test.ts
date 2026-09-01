import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { monthGrid, type CalendarCell, type CalendarCellState } from "./activity-calendar";
import { formatDateKey } from "./activity-calendar";
import {
  freezesCoverWholeHistory,
  resolveStreakWithFreezes,
  type StreakResolution,
} from "./streak-freezes";

/**
 * ONE STORY, THREE PLACES: the rule, the sentence, and the colour of the
 * square. This file runs the real resolver and feeds its real output into
 * the real month grid — no fixture of frozen days invented by hand, because
 * a fixture would prove that the calendar can paint a blue square, not that
 * it paints one on the day the rule actually spent a freeze on.
 *
 * The report that produced it (PROGRESS.md 7.72). On production: three
 * missed days — 21, 23 and 28 August — none of them consecutive, "2 of 2"
 * freezes in hand, "saved by a freeze: 0", streak restarted on the 29th.
 * Read against the paragraph on the Progress tab ("a freeze covers one
 * missed day and your streak goes on") that looks like a dead feature.
 *
 * It is not. Freezes spend forward from an epoch — `User.streakFreezesSince`,
 * stamped on the first authenticated page load after the feature shipped —
 * and all three gaps fell before it. Every number on that page was correct;
 * the sentence beside them was not, because it never said "from when".
 *
 * So the cases below fix all three together: the rule keeps doing what it
 * does, the square is icy exactly on the days the rule spent a freeze on,
 * and the epoch note appears exactly when there is history the rule was
 * never allowed to touch.
 */

const DIR = join(process.cwd(), "src", "dictionaries");
const DICT = {
  es: JSON.parse(readFileSync(join(DIR, "es.json"), "utf8")),
  ru: JSON.parse(readFileSync(join(DIR, "ru.json"), "utf8")),
} as Record<"es" | "ru", { profile: Record<string, string & string[]> }>;

const AUGUST = "2026-08";
const TODAY = "2026-08-31";
/** The learner registered on 1 August, so nothing in this month is
 * "beforeStart" and every square is one the rule had an opinion about. */
const REGISTERED = "2026-08-01";

function day(n: number): string {
  return `${AUGUST}-${String(n).padStart(2, "0")}`;
}

/** Every day of August up to `TODAY` except the ones named. */
function studiedExcept(...missed: number[]): string[] {
  const skip = new Set(missed);
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) if (!skip.has(d)) out.push(day(d));
  return out;
}

/** The whole pipeline the profile page runs, in the order it runs it. */
function render(activity: string[], freezesSince: string | null) {
  const streak: StreakResolution = resolveStreakWithFreezes(activity, TODAY, {
    freezesLeft: null,
    freezesSince,
  });
  const weeks = monthGrid(AUGUST, {
    activeDateKeys: activity,
    frozenDateKeys: streak.frozenDateKeys,
    todayKey: TODAY,
    firstDateKey: REGISTERED,
  });
  const byDate = new Map<string, CalendarCell>();
  for (const cell of weeks.flat()) if (cell.dateKey) byDate.set(cell.dateKey, cell);
  return {
    streak,
    stateOf: (n: number): CalendarCellState => {
      const cell = byDate.get(day(n));
      if (!cell) throw new Error(`no cell for ${day(n)}`);
      return cell.state;
    },
    /** Every square the grid painted icy, in date order. */
    icyDays: [...byDate.values()]
      .filter((c) => c.state === "frozen")
      .map((c) => c.dateKey as string)
      .sort(),
  };
}

describe("a single missed day, with a freeze in hand", () => {
  // The epoch sits on the learner's first day, so the rule applies to
  // everything on screen — which is what the plain paragraph describes.
  const activity = studiedExcept(23);
  const { streak, stateOf, icyDays } = render(activity, REGISTERED);

  it("does not break the streak", () => {
    // 30 studied days of 31, and the chain runs through the gap rather than
    // restarting after it.
    expect(streak.currentStreak).toBe(30);
    expect(streak.chainStartedOn).toBe(day(1));
    expect(streak.brokenOn).toBeNull();
  });

  it("spends exactly one freeze on exactly that day", () => {
    expect(streak.frozenDateKeys).toEqual([day(23)]);
  });

  it("paints that square icy, and only that square", () => {
    expect(stateOf(23)).toBe("frozen");
    expect(icyDays).toEqual([day(23)]);
  });

  it("control: with no freeze left, the same gap is grey and the streak restarts", () => {
    // Same history, same day missed — but four earlier gaps have already
    // eaten the budget, so the rule cannot cover this one. If the square
    // came out icy here, the colour would be decoration rather than a
    // reading of the ledger.
    const spent = studiedExcept(4, 9, 14, 19, 23);
    const r = render(spent, REGISTERED);
    expect(r.streak.frozenDateKeys).not.toContain(day(23));
    expect(r.stateOf(23)).toBe("missed");
    expect(r.streak.chainStartedOn).toBe(day(24));
    expect(r.streak.brokenOn).toBe(day(23));
  });
});

describe("two missed days in a row, with freezes still in hand", () => {
  const activity = studiedExcept(23, 24);
  const { streak, stateOf } = render(activity, REGISTERED);

  it("breaks the streak anyway", () => {
    expect(streak.currentStreak).toBe(7); // 25..31
    expect(streak.chainStartedOn).toBe(day(25));
  });

  it("still has a freeze left — the balance is not what ended the chain", () => {
    expect(streak.freezesLeft).toBeGreaterThan(0);
  });

  it("shows the first of the two as icy and the second as a plain miss", () => {
    // The freeze spent on the first hole is not refunded (PROGRESS.md 7.69),
    // so the grid must show it as spent. The second hole is what ended the
    // chain and must not wear the colour that means "covered".
    expect(streak.frozenDateKeys).toEqual([day(23)]);
    expect(stateOf(23)).toBe("frozen");
    expect(stateOf(24)).toBe("missed");
  });

  it("names the second day as the break, never the frozen one", () => {
    expect(streak.brokenOn).toBe(day(24));
    expect(streak.frozenDateKeys).not.toContain(streak.brokenOn);
  });
});

describe("the production report of 01.09.2026, reproduced exactly", () => {
  // 21, 23 and 28 missed; none consecutive; the epoch stamped today, which
  // is what the first authenticated page load after the deploy does to an
  // account that already had history.
  const activity = studiedExcept(21, 23, 28);
  const { streak, icyDays, stateOf } = render(activity, TODAY);

  it("reproduces every number the owner saw", () => {
    expect(streak.freezesLeft).toBe(2);
    expect(streak.frozenDateKeys).toEqual([]);
    expect(streak.chainStartedOn).toBe(day(29));
    expect(streak.brokenOn).toBe(day(28));
  });

  it("paints all three as plain misses — the grid agrees with the ledger", () => {
    expect(icyDays).toEqual([]);
    for (const n of [21, 23, 28]) expect(stateOf(n)).toBe("missed");
  });

  it("is the epoch, not a broken rule: move it back and the same history is saved twice", () => {
    // THE control this whole diagnosis rests on. Same activity, same today,
    // only the epoch moved to the learner's first day.
    const r = render(activity, REGISTERED);
    expect(r.streak.frozenDateKeys).toEqual([day(21), day(23), day(28)]);
    expect(r.icyDays).toEqual([day(21), day(23), day(28)]);
    expect(r.streak.currentStreak).toBe(28);
  });

  it("is exactly the case the epoch note must appear for", () => {
    expect(freezesCoverWholeHistory(streak.freezesSince, REGISTERED)).toBe(false);
  });
});

describe("the sentence and the ledger say the same thing", () => {
  it("names the epoch only when there is history freezes never covered", () => {
    // Stamped today on an account that predates the feature: there is a
    // stretch the rule was not allowed to touch, so the learner is told.
    expect(freezesCoverWholeHistory(TODAY, REGISTERED)).toBe(false);
    // Stamped on the learner's own first day (a new account): the plain rule
    // is the whole truth and the extra clause would be noise.
    expect(freezesCoverWholeHistory(REGISTERED, REGISTERED)).toBe(true);
    // An epoch earlier than the account can exist after a zone change; it is
    // still full cover.
    expect(freezesCoverWholeHistory("2026-07-01", REGISTERED)).toBe(true);
  });

  for (const locale of ["es", "ru"] as const) {
    it(`${locale}: the note is a whole sentence with the date filled in`, () => {
      const template = DICT[locale].profile.streakFreezeSinceNote as unknown as string;
      const rendered = template.replace(
        "{date}",
        formatDateKey(
          TODAY,
          DICT[locale].profile.calendarDatePattern as unknown as string,
          DICT[locale].profile.calendarMonthsInDate as unknown as string[],
        ),
      );
      expect(rendered).not.toContain("{date}");
      expect(rendered).toMatch(/[.!?]$/);
      expect(rendered).toContain("31");
      // Positive control on the check itself: an unfilled template and a
      // truncated one both have to fail it.
      expect(template).toContain("{date}");
      expect("Заморозки действуют с .").not.toMatch(/\d/);
    });

    it(`${locale}: the legend no longer calls two opposite days one thing`, () => {
      const p = DICT[locale].profile as unknown as Record<string, string>;
      expect(p.calendarLegendBeforeStart).toBeTruthy();
      expect(p.calendarLegendFuture).toBeTruthy();
      expect(p.calendarLegendBeforeStart).not.toBe(p.calendarLegendFuture);
      // The key it replaced is gone, so nothing can quietly go on using it.
      expect(p.calendarLegendOutside).toBeUndefined();
    });

    it(`${locale}: the two snowflake lines are not the same sentence twice`, () => {
      const p = DICT[locale].profile as unknown as Record<string, string>;
      // One counts days on the month currently on screen; the other counts a
      // stock that has nothing to do with that month. They must not read
      // alike, and the month-scoped one has to say so.
      expect(p.calendarSummarySaved).not.toBe(p.streakFreezesLeftLabel);
      const monthWord = locale === "es" ? "mes" : "месяц";
      expect(p.calendarSummarySaved.toLowerCase()).toContain(monthWord);
      expect(p.streakFreezesLeftLabel.toLowerCase()).not.toContain(monthWord);
    });
  }
});

describe("the grid before the learner existed and after today", () => {
  // Registered on the 5th, today is the 20th. Day 1 carries a study mark
  // anyway — possible after a zone change (PROGRESS.md 7.70) — so the order
  // the states are asked in is exercised, not assumed.
  const weeks = monthGrid(AUGUST, {
    activeDateKeys: [day(1), ...Array.from({ length: 14 }, (_, i) => day(6 + i))].filter(
      (k) => k !== day(23),
    ),
    frozenDateKeys: [day(15)],
    todayKey: "2026-08-20",
    firstDateKey: "2026-08-05",
  });
  const byDate = new Map(weeks.flat().filter((c) => c.dateKey).map((c) => [c.dateKey as string, c]));

  it("separates the two kinds that used to share one word", () => {
    expect(byDate.get(day(3))?.state).toBe("beforeStart");
    expect(byDate.get(day(25))?.state).toBe("future");
  });

  it("still lets a studied day outrank both", () => {
    // A day marked before the account's own registration date (possible
    // after a zone change) is activity, not a hole in the past.
    expect(byDate.get(day(1))?.state).toBe("active");
  });

  it("keeps neighbouring-month squares out of the legend entirely", () => {
    const padding = weeks.flat().filter((c) => c.dateKey === null);
    expect(padding.length).toBeGreaterThan(0);
    expect(padding.every((c) => c.state === "padding")).toBe(true);
  });
});
