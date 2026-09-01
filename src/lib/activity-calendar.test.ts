import { describe, expect, it } from "vitest";
import {
  clampMonth,
  daysInMonth,
  monthGrid,
  monthKeyOf,
  formatDateKey,
  monthSummary,
  navigableMonths,
  shiftMonth,
  weekdayIndex,
  type CalendarCell,
} from "./activity-calendar";
import { dateKeyIn } from "./timezone";

// The month grid of the /profile activity calendar.
//
// Every case here is written the way PROGRESS.md 7.68 demands of anything
// defined by a human calendar: the answer is checked against a SECOND way
// of getting it, or against the wrong answer the naive implementation would
// give, so that "it returns 31" cannot pass on a broken function.

const TODAY = "2026-08-31";
const REGISTERED = "2026-08-07";

const grid = (month: string, over: Partial<Parameters<typeof monthGrid>[1]> = {}) =>
  monthGrid(month, {
    activeDateKeys: [],
    frozenDateKeys: [],
    todayKey: TODAY,
    firstDateKey: REGISTERED,
    ...over,
  });

const cellFor = (weeks: CalendarCell[][], dateKey: string) =>
  weeks.flat().find((cell) => cell.dateKey === dateKey);

describe("календарная арифметика", () => {
  it("неделя начинается с понедельника, и это проверено вторым способом", () => {
    // 2026-08-31 is a Monday. Checked against Date's own answer rather than
    // asserted from memory.
    expect(new Date("2026-08-31T12:00:00.000Z").getUTCDay()).toBe(1); // 1 = Monday
    expect(weekdayIndex("2026-08-31")).toBe(0); // 0 = Monday in this module

    expect(new Date("2026-08-30T12:00:00.000Z").getUTCDay()).toBe(0); // Sunday
    expect(weekdayIndex("2026-08-30")).toBe(6); // last column

    // A full week, in order, with no gaps and no repeats.
    const week = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
    expect(week.map(weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("длина месяца, включая февраль високосного года", () => {
    expect(daysInMonth("2026-08")).toBe(31);
    expect(daysInMonth("2026-09")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2024-02")).toBe(29); // leap
    expect(daysInMonth("2000-02")).toBe(29); // divisible by 400
    expect(daysInMonth("1900-02")).toBe(28); // divisible by 100 but not 400
  });

  it("шаг по месяцам не спотыкается о 31-е число", () => {
    // The bug this guards: adding one month to a Date on the 31st lands in
    // the month after next, so a grid built that way skips a month.
    const naive = new Date("2026-01-31T12:00:00.000Z");
    naive.setUTCMonth(naive.getUTCMonth() + 1);
    expect(naive.toISOString().slice(0, 7)).toBe("2026-03"); // ← the wrong answer

    expect(shiftMonth("2026-01", 1)).toBe("2026-02");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-08", -8)).toBe("2025-12");

    // Symmetry: +n then -n is the identity, at both ends of a year.
    for (const month of ["2026-01", "2026-12", "2026-08"]) {
      for (const delta of [1, -1, 5, -13]) {
        expect(shiftMonth(shiftMonth(month, delta), -delta)).toBe(month);
      }
    }
  });

  it("границы навигации: месяц регистрации и текущий месяц", () => {
    const { min, max } = navigableMonths(REGISTERED, TODAY);
    expect(min).toBe("2026-08");
    expect(max).toBe("2026-08");

    const older = navigableMonths("2026-03-14", TODAY);
    expect(older).toEqual({ min: "2026-03", max: "2026-08" });

    expect(clampMonth("2026-02", older.min, older.max)).toBe("2026-03"); // не дальше регистрации
    expect(clampMonth("2026-09", older.min, older.max)).toBe("2026-08"); // не дальше сегодня
    expect(clampMonth("2026-05", older.min, older.max)).toBe("2026-05"); // внутри — не трогаем

    // A registration date in the future (a clock skew, a hand-edited row)
    // must not produce an empty window with min after max.
    expect(navigableMonths("2099-01-01", TODAY)).toEqual({ min: "2026-08", max: "2026-08" });
  });

  it("monthKeyOf — просто префикс, но проверенный", () => {
    expect(monthKeyOf("2026-08-31")).toBe("2026-08");
    expect(monthKeyOf("2026-01-01")).toBe("2026-01");
  });
});

describe("сетка месяца", () => {
  it("каждая строка ровно семь клеток, и все дни месяца на месте", () => {
    for (const month of ["2026-02", "2026-08", "2026-09", "2024-02"]) {
      const weeks = grid(month, { todayKey: "2026-12-31", firstDateKey: "2000-01-01" });
      for (const week of weeks) expect(week).toHaveLength(7);
      const days = weeks.flat().filter((cell) => cell.dateKey !== null);
      expect(days).toHaveLength(daysInMonth(month));
      expect(days[0].day).toBe(1);
      expect(days[days.length - 1].day).toBe(daysInMonth(month));
      // The first day of the month sits in the column its weekday says.
      expect(weeks[0].findIndex((cell) => cell.day === 1)).toBe(weekdayIndex(`${month}-01`));
    }
  });

  it("четыре вида клетки, и ни один не подменяет другой", () => {
    const weeks = grid("2026-08", {
      activeDateKeys: ["2026-08-10", "2026-08-12"],
      frozenDateKeys: ["2026-08-11"],
    });

    expect(cellFor(weeks, "2026-08-10")!.state).toBe("active");
    expect(cellFor(weeks, "2026-08-11")!.state).toBe("frozen");
    expect(cellFor(weeks, "2026-08-13")!.state).toBe("missed");
    // Before registration (07.08) and after today (31.08).
    expect(cellFor(weeks, "2026-08-06")!.state).toBe("outside");
    expect(cellFor(weeks, "2026-08-05")!.state).toBe("outside");
    // The registration day itself is inside.
    expect(cellFor(weeks, "2026-08-07")!.state).toBe("missed");
    // Today is inside, and marked.
    expect(cellFor(weeks, "2026-08-31")!.isToday).toBe(true);
    expect(weeks.flat().filter((cell) => cell.isToday)).toHaveLength(1);

    // All four kinds actually occur in this fixture — otherwise the four
    // assertions above could all be passing on one default value.
    expect(new Set(weeks.flat().map((cell) => cell.state))).toEqual(
      new Set(["active", "frozen", "missed", "outside"]),
    );
  });

  it("день будущего месяца — вне периода, а не пропуск", () => {
    const weeks = grid("2026-08", {});
    // The whole month is navigable, but only up to today.
    expect(cellFor(weeks, "2026-08-30")!.state).toBe("missed");
    const september = grid("2026-09", {});
    expect(september.flat().filter((c) => c.dateKey !== null).every((c) => c.state === "outside")).toBe(true);
  });

  it("занятие побеждает заморозку, если данные противоречат сами себе", () => {
    // A day can never be both in practice — a freeze is only ever spent on
    // a day with no activity. Asserted anyway so a future data change can
    // never paint a day the learner studied as one they missed.
    const weeks = grid("2026-08", { activeDateKeys: ["2026-08-20"], frozenDateKeys: ["2026-08-20"] });
    expect(cellFor(weeks, "2026-08-20")!.state).toBe("active");
  });

  it("клетки-заполнители соседних месяцев пусты и не считаются пропуском", () => {
    // August 2026 starts on a Saturday, so the first row has five padding
    // squares before it.
    expect(weekdayIndex("2026-08-01")).toBe(5);
    const weeks = grid("2026-08", {});
    const padding = weeks[0].slice(0, 5);
    expect(padding.every((cell) => cell.dateKey === null && cell.day === null)).toBe(true);
    expect(padding.every((cell) => cell.state === "outside")).toBe(true);
  });

  it("сетка одинакова в обеих локалях — она не знает про язык", () => {
    // There is no locale argument, and that is the point: the month grid is
    // the same object for a Spanish and a Russian reader, and only the
    // NAMES differ (they come from the dictionaries). A calendar that
    // started the week on Sunday for one of them would be two products.
    const a = grid("2026-08", { activeDateKeys: ["2026-08-10"] });
    const b = grid("2026-08", { activeDateKeys: ["2026-08-10"] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("сетка чистая: тот же вход — тот же выход, десять раз подряд", () => {
    // The calendar must not accumulate anything between renders. Ten calls,
    // one answer.
    const results = Array.from({ length: 10 }, () =>
      JSON.stringify(grid("2026-08", { activeDateKeys: ["2026-08-10"], frozenDateKeys: ["2026-08-11"] })),
    );
    expect(new Set(results).size).toBe(1);
  });
});

describe("календарь и часовой пояс ученика", () => {
  it("тот же миг даёт разные сегодняшние клетки в разных зонах", () => {
    // The grid never asks what day it is; it is told. Feeding the same
    // instant through two zones therefore has to move which square is
    // "today" — the property that would be lost the moment this file grew
    // its own day boundary.
    const instant = new Date("2026-09-01T05:00:00.000Z");
    const tijuana = dateKeyIn(instant, "America/Tijuana"); // 22:00 on 31.08
    const auckland = dateKeyIn(instant, "Pacific/Auckland"); // 17:00 on 01.09
    expect(tijuana).toBe("2026-08-31");
    expect(auckland).toBe("2026-09-01");

    const west = monthGrid("2026-08", {
      activeDateKeys: [],
      frozenDateKeys: [],
      todayKey: tijuana,
      firstDateKey: REGISTERED,
    });
    const east = monthGrid("2026-08", {
      activeDateKeys: [],
      frozenDateKeys: [],
      todayKey: auckland,
      firstDateKey: REGISTERED,
    });

    expect(cellFor(west, "2026-08-31")!.isToday).toBe(true);
    expect(cellFor(east, "2026-08-31")!.isToday).toBe(false);
    // ...and for the Auckland learner the 31st is already behind them, so
    // it is a real missed day rather than an unfinished one.
    expect(cellFor(east, "2026-08-31")!.state).toBe("missed");
  });
});

describe("итог месяца и дата словами", () => {
  it("monthSummary считает только клетки ЭТОГО месяца", () => {
    const weeks = grid("2026-08", {
      activeDateKeys: ["2026-07-31", "2026-08-10", "2026-08-12", "2026-09-01"],
      frozenDateKeys: ["2026-08-11"],
      todayKey: "2026-09-30",
      firstDateKey: "2026-01-01",
    });
    // 31.07 and 01.09 are in the grid's padding, which carries no dateKey —
    // exactly the case a naive "count the flames I can see" would get wrong.
    expect(monthSummary(weeks)).toEqual({ active: 2, frozen: 1 });

    // Control: the neighbouring days really are in this grid's rows and
    // really are excluded, rather than simply absent.
    expect(weeks.flat()).toHaveLength(6 * 7);
    expect(weeks.flat().filter((c) => c.dateKey === null).length).toBeGreaterThan(0);
  });

  it("monthSummary на пустом месяце — нули, а не пустота", () => {
    expect(monthSummary(grid("2026-08", { todayKey: "2026-09-30", firstDateKey: "2026-01-01" }))).toEqual({
      active: 0,
      frozen: 0,
    });
  });

  it("formatDateKey: испанское «de» и русский родительный падеж", () => {
    const es = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const ru = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

    expect(formatDateKey("2026-08-30", "{day} de {month}", es)).toBe("30 de agosto");
    expect(formatDateKey("2026-08-30", "{day} {month}", ru)).toBe("30 августа");
    // Leading zeros are a date-key artefact, not something a person says.
    expect(formatDateKey("2026-01-05", "{day} de {month}", es)).toBe("5 de enero");
    expect(formatDateKey("2026-12-31", "{day} {month}", ru)).toBe("31 декабря");
    // The two locales really do differ — otherwise one list could be
    // serving both and nobody would notice the Russian was in the wrong case.
    expect(formatDateKey("2026-08-30", "{day} de {month}", es)).not.toBe(
      formatDateKey("2026-08-30", "{day} {month}", ru),
    );
  });
});
