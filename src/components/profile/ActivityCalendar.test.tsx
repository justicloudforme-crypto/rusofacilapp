import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityCalendar from "./ActivityCalendar";

// Two things this file is for, and the second is the one the brief asked
// for by name:
//
//  1. the calendar shows what the learner is told it shows, in both
//     locales, with the week starting on Monday;
//  2. THE CALENDAR WRITES NOTHING. Not "no write was noticed" — every way
//     this component could reach the outside world is replaced by a spy
//     before it renders, the learner is driven through it (paging months
//     back and forth, which is the only thing it can do), and every spy is
//     asserted to have zero calls.

const ES = {
  prevMonth: "Mes anterior",
  nextMonth: "Mes siguiente",
  legendActive: "día de estudio",
  legendFrozen: "día salvado con una congelación",
  legendMissed: "día sin estudiar",
  legendOutside: "fuera de tu periodo",
  legendToday: "hoy",
  months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
  weekdaysFull: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
};

const RU = {
  prevMonth: "Предыдущий месяц",
  nextMonth: "Следующий месяц",
  legendActive: "день занятия",
  legendFrozen: "день спасён заморозкой",
  legendMissed: "пропуск",
  legendOutside: "вне периода",
  legendToday: "сегодня",
  months: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  weekdays: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"],
  weekdaysFull: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
};

const TODAY = "2026-08-31";

function renderCalendar(dict = ES, over: Record<string, unknown> = {}) {
  return render(
    <ActivityCalendar
      activeDateKeys={["2026-08-10", "2026-08-12", "2026-07-20"]}
      frozenDateKeys={["2026-08-11"]}
      todayKey={TODAY}
      firstDateKey="2026-06-15"
      dict={dict}
      {...over}
    />,
  );
}

const cell = (dateKey: string) => document.querySelector(`[data-date="${dateKey}"]`);

describe("календарь занятий — что видит ученик", () => {
  it("открывается на текущем месяце и подписывает его на локали ученика", () => {
    const { unmount } = renderCalendar(ES);
    expect(screen.getByText("agosto 2026")).toBeTruthy();
    unmount();

    renderCalendar(RU);
    expect(screen.getByText("август 2026")).toBeTruthy();
  });

  it("неделя с понедельника, одинаково в обеих локалях", () => {
    const { unmount } = renderCalendar(ES);
    expect(screen.getByText("lun")).toBeTruthy();
    // The first weekday column is Monday, not Sunday: the abbreviation list
    // is rendered in order, so its first entry IS the first column.
    expect(document.querySelectorAll("abbr")[0].textContent).toBe("lun");
    expect(document.querySelectorAll("abbr")[6].textContent).toBe("dom");
    unmount();

    renderCalendar(RU);
    expect(document.querySelectorAll("abbr")[0].textContent).toBe("пн");
    expect(document.querySelectorAll("abbr")[6].textContent).toBe("вс");
  });

  it("четыре вида клетки различимы без наведения — по data-state и по подписи", () => {
    renderCalendar(ES);
    expect(cell("2026-08-10")!.getAttribute("data-state")).toBe("active");
    expect(cell("2026-08-11")!.getAttribute("data-state")).toBe("frozen");
    expect(cell("2026-08-13")!.getAttribute("data-state")).toBe("missed");
    expect(cell("2026-08-31")!.getAttribute("data-state")).toBe("missed");
    // Tomorrow is outside the period — the learner has not missed it yet.
    expect(cell("2026-09-01")).toBeNull(); // not in this month's grid at all
    // Today carries its own label on top of its state.
    expect(cell("2026-08-31")!.getAttribute("aria-label")).toContain("hoy");
    expect(cell("2026-08-10")!.getAttribute("aria-label")).toContain("día de estudio");
  });

  it("легенда — строка на странице, не подсказка по наведению", () => {
    renderCalendar(ES);
    // All five kinds are readable as text in the document. `title` would
    // not satisfy this, and on the Capacitor build there is no hover at all
    // (CLAUDE.md) — that is why this assertion exists.
    for (const label of [
      ES.legendActive,
      ES.legendFrozen,
      ES.legendMissed,
      ES.legendOutside,
      ES.legendToday,
    ]) {
      const list = screen.getByRole("list");
      expect(within(list).getByText(label)).toBeTruthy();
    }
  });

  it("назад — не дальше месяца регистрации, вперёд — не дальше текущего", async () => {
    const user = userEvent.setup();
    renderCalendar(ES); // registered 2026-06-15, today 2026-08-31

    const next = screen.getByLabelText(ES.nextMonth) as HTMLButtonElement;
    const prev = screen.getByLabelText(ES.prevMonth) as HTMLButtonElement;

    // Already at the newest month.
    expect(next.disabled).toBe(true);
    expect(prev.disabled).toBe(false);

    await user.click(prev);
    expect(screen.getByText("julio 2026")).toBeTruthy();
    expect((screen.getByLabelText(ES.nextMonth) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByLabelText(ES.prevMonth));
    expect(screen.getByText("junio 2026")).toBeTruthy();
    // The registration month is the floor.
    expect((screen.getByLabelText(ES.prevMonth) as HTMLButtonElement).disabled).toBe(true);

    // Forward again, to the ceiling.
    await user.click(screen.getByLabelText(ES.nextMonth));
    await user.click(screen.getByLabelText(ES.nextMonth));
    expect(screen.getByText("agosto 2026")).toBeTruthy();
    expect((screen.getByLabelText(ES.nextMonth) as HTMLButtonElement).disabled).toBe(true);
  });

  it("июльское занятие видно, когда пролистать назад — данные не обрезаны 30 днями", async () => {
    const user = userEvent.setup();
    renderCalendar(ES);
    expect(cell("2026-07-20")).toBeNull(); // not on the August grid
    await user.click(screen.getByLabelText(ES.prevMonth));
    expect(cell("2026-07-20")!.getAttribute("data-state")).toBe("active");
  });
});

describe("календарь только читает", () => {
  const spies: Array<{ name: string; spy: ReturnType<typeof vi.fn> }> = [];

  beforeEach(() => {
    spies.length = 0;
    // Every route out of a browser component. If the calendar ever grows a
    // "mark today" call, a prefetch, a beacon or a stored preference, one of
    // these counts stops being zero.
    const record = (name: string) => {
      const spy = vi.fn();
      spies.push({ name, spy });
      return spy;
    };
    vi.stubGlobal("fetch", record("fetch"));
    vi.stubGlobal("XMLHttpRequest", class {
      open = record("XMLHttpRequest.open");
      send = record("XMLHttpRequest.send");
    });
    const beacon = record("navigator.sendBeacon");
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    const setItem = record("localStorage.setItem");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(setItem);
    const sessionSet = record("history.pushState");
    vi.spyOn(history, "pushState").mockImplementation(sessionSet);
    const replace = record("history.replaceState");
    vi.spyOn(history, "replaceState").mockImplementation(replace);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("отрисовка и листание месяцев не делают ни одного вызова наружу", async () => {
    const user = userEvent.setup();
    renderCalendar(ES);

    // Everything the learner can do here: page back to the floor and
    // forward to the ceiling, twice over.
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 3; i++) await user.click(screen.getByLabelText(ES.prevMonth));
      for (let i = 0; i < 3; i++) await user.click(screen.getByLabelText(ES.nextMonth));
    }

    expect(screen.getByText("agosto 2026")).toBeTruthy(); // it really did run
    for (const { name, spy } of spies) {
      expect(`${name}: ${spy.mock.calls.length}`).toBe(`${name}: 0`);
    }
  });

  it("контроль: эти же шпионы ловят обращение наружу", async () => {
    // Rule 4.1 — a check that answers "zero" proves nothing until it has
    // been shown to catch the thing it is looking for. The same spies, one
    // deliberate call each.
    await fetch("/api/study-day", { method: "POST" });
    navigator.sendBeacon("/api/study-day");
    localStorage.setItem("x", "1");
    history.replaceState(null, "", "?month=2026-07");

    const called = spies.filter(({ spy }) => spy.mock.calls.length > 0).map(({ name }) => name);
    expect(called).toContain("fetch");
    expect(called).toContain("navigator.sendBeacon");
    expect(called).toContain("localStorage.setItem");
    expect(called).toContain("history.replaceState");
  });
});
