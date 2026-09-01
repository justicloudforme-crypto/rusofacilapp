import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  legendBeforeStart: "antes de registrarte",
  legendFuture: "aún por llegar",
  legendToday: "hoy",
  months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  monthsInDate: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  datePattern: "{day} de {month}",
  weekdays: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
  weekdaysFull: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
  summaryStudied: "Días de estudio este mes",
  summarySaved: "Días salvados este mes",
  dayOpenLabel: "Ver qué hiciste este día",
  dayCloseLabel: "Cerrar el detalle del día",
  dayDetailHeading: "Qué hiciste el {date}",
  sourceLabels: {
    lesson: "una lección",
    story: "un relato",
    flashcards: "tarjetas de vocabulario",
    "word-game": "un juego de palabras",
    exam: "un examen",
    media: "una canción o un vídeo",
  },
};

const RU = {
  prevMonth: "Предыдущий месяц",
  nextMonth: "Следующий месяц",
  legendActive: "день занятия",
  legendFrozen: "день спасён заморозкой",
  legendMissed: "пропуск",
  legendBeforeStart: "до регистрации",
  legendFuture: "ещё впереди",
  legendToday: "сегодня",
  months: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
  monthsInDate: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  datePattern: "{day} {month}",
  weekdays: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"],
  weekdaysFull: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
  summaryStudied: "Дней занятий в этом месяце",
  summarySaved: "Спасено дней в этом месяце",
  dayOpenLabel: "Посмотреть, чем занимался в этот день",
  dayCloseLabel: "Закрыть подробности дня",
  dayDetailHeading: "Чем ты занимался {date}",
  sourceLabels: {
    lesson: "урок",
    story: "рассказ",
    flashcards: "карточки",
    "word-game": "игра в слова",
    exam: "экзамен",
    media: "песня или видео",
  },
};

const TODAY = "2026-08-31";

const SOURCES: Record<string, string[]> = {
  "2026-08-10": ["lesson", "flashcards", "media"],
  "2026-08-12": ["story"],
  "2026-07-20": ["exam"],
};

function renderCalendar(dict = ES, over: Record<string, unknown> = {}) {
  return render(
    <ActivityCalendar
      activeDateKeys={["2026-08-10", "2026-08-12", "2026-07-20"]}
      frozenDateKeys={["2026-08-11"]}
      daySources={SOURCES}
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

  it("виды клетки различимы без наведения — по data-state и по подписи", () => {
    renderCalendar(ES);
    expect(cell("2026-08-10")!.getAttribute("data-state")).toBe("active");
    expect(cell("2026-08-11")!.getAttribute("data-state")).toBe("frozen");
    expect(cell("2026-08-13")!.getAttribute("data-state")).toBe("missed");
    expect(cell("2026-08-31")!.getAttribute("data-state")).toBe("missed");
    // Tomorrow is not in this month's grid at all. A day that HAS not
    // happened yet is its own state, and it is not the state of a day
    // before the learner registered — the two shared one word until
    // 01.09.2026, and the legend could only describe them as "вне периода".
    expect(cell("2026-09-01")).toBeNull();
    const { container: july } = renderCalendar(ES, { todayKey: "2026-08-13" });
    expect(july.querySelector('[data-date="2026-08-20"]')!.getAttribute("data-state")).toBe("future");
    expect(july.querySelector('[data-date="2026-06-10"]')).toBeNull();
    // Today carries its own label on top of its state.
    expect(cell("2026-08-31")!.getAttribute("aria-label")).toContain("hoy");
    expect(cell("2026-08-10")!.getAttribute("aria-label")).toContain("día de estudio");
  });

  it("каждый ВИД, который нарисован в этом месяце, объяснён ТЕКСТОМ на странице", () => {
    const { container } = renderCalendar(ES);
    // The property, not a fixed list. The wording lives in two lines — the
    // month summary carries the flame and the blue square with a count, the
    // legend carries the rest — and since 02.09.2026 the legend names only
    // the kinds this month actually draws. `title` would not satisfy this,
    // and on the Capacitor build there is no hover at all (CLAUDE.md).
    const text = container.textContent ?? "";
    const drawn = new Set([...container.querySelectorAll("[data-state]")].map((el) => el.getAttribute("data-state")));
    const wordFor: Record<string, string> = {
      active: ES.summaryStudied,
      frozen: ES.summarySaved,
      missed: ES.legendMissed,
      beforeStart: ES.legendBeforeStart,
      future: ES.legendFuture,
    };
    for (const state of drawn) {
      expect(text, `state "${state}" is drawn but not named in text`).toContain(wordFor[state!]);
    }
    expect(text).toContain(ES.legendToday);

    // Control, and it is the whole point of the change: today is 31.08, the
    // LAST day of the month, so no square is "future" — and the legend must
    // not offer a line for it. Without this the assertion above would pass
    // on the old component, which printed all five unconditionally.
    expect(drawn.has("future")).toBe(false);
    expect(text).not.toContain(ES.legendFuture);

    // And the mirror: a month that is still running does get the line.
    const running = renderCalendar(ES, { todayKey: "2026-08-20" });
    expect(running.container.textContent).toContain(ES.legendFuture);

    // The two that moved to the summary line really did move rather than
    // vanish: their words are still what the cells announce to a reader.
    expect(cell("2026-08-10")!.getAttribute("aria-label")).toContain(ES.legendActive);
    expect(cell("2026-08-11")!.getAttribute("aria-label")).toContain(ES.legendFrozen);
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

describe("клетка: число не двигается и не меняет размер", () => {
  it("день с занятием и день без — число в одном и том же месте и одного кегля", () => {
    renderCalendar(ES);
    const active = cell("2026-08-10")!;
    const plain = cell("2026-08-13")!;

    // The number is the FIRST child of both, with the same classes. It used
    // to move to the bottom-right corner and drop to 10px on a studied day,
    // so a column of dates zig-zagged: the flame was moving the date.
    const num = (el: Element) => el.querySelector("span:not([class*='absolute'])");
    expect(num(active)!.textContent).toBe("10");
    expect(num(plain)!.textContent).toBe("13");
    expect(num(active)!.className).toBe(num(plain)!.className);
    expect(num(active)!.className).toContain("text-xs");

    // The flame is present on the studied day, positioned out of the
    // number's way, and cannot take a tap of its own.
    const flame = active.querySelector("span[class*='absolute']");
    expect(flame!.textContent).toBe("🔥");
    expect(flame!.className).toContain("pointer-events-none");
    expect(plain.querySelector("span[class*='absolute']")).toBeNull();
  });

  it("дни до регистрации — почти невидимая клетка, без пунктирной рамки", () => {
    renderCalendar(ES);
    // June is the registration month (15.06), so 1–14 June are outside.
    // Check on the July grid instead: nothing before 15.06 is reachable
    // from August, so page back twice.
    const august = cell("2026-08-13")!;
    expect(august.className).not.toContain("border-dashed"); // control: neither is a plain day

    const { container } = renderCalendar(ES, { firstDateKey: "2026-08-10", todayKey: "2026-08-20" });
    const outside = container.querySelectorAll('[data-state="beforeStart"]');
    const future = container.querySelectorAll('[data-state="future"]');
    expect(outside.length).toBeGreaterThan(0);
    expect(future.length).toBeGreaterThan(0);
    for (const el of outside) {
      // Still no DASHED frame — that is the 2px outline 7.71 removed,
      // which drew a box around every day of the first half of the month.
      expect(el.className).not.toContain("border-dashed");
      // But a hairline, added 02.09.2026, and it is required rather than
      // tolerated: "before you registered" and "hasn't happened yet" were
      // the same declaration character for character, so the two squares
      // were one square with two names.
      expect(el.className).toContain("border-foreground/15");
    }
    for (const el of future) {
      expect(el.className).toContain("border-dotted");
    }
    // Three greys, three shapes — asserted as "no two are alike" rather
    // than against three literals, so a future retune cannot quietly make
    // two of them equal again the way it already did once.
    const missed = container.querySelector('[data-state="missed"]');
    const shapes = new Set(
      [missed, outside[0], future[0]].map((el) =>
        (el!.className.match(/(bg-foreground[^\s]*|border-\S+)/g) ?? []).sort().join(" "),
      ),
    );
    expect(shapes.size).toBe(3);

    // The legend swatch matches the square, so the line explains what is
    // actually drawn.
    const legendSwatch = [...container.querySelectorAll("li")].find((li) =>
      li.textContent?.includes(ES.legendBeforeStart),
    );
    expect(legendSwatch!.querySelector("span")!.className).not.toContain("border-dashed");
    expect(legendSwatch!.querySelector("span")!.className).toContain("border-foreground/15");
  });
});

describe("итог месяца под сеткой", () => {
  it("считает дни занятий и спасённые дни ИМЕННО этого месяца", () => {
    const { container, unmount } = renderCalendar(ES);
    // August in the fixture: two studied days (10, 12) and one frozen (11).
    // July's studied day (20.07) must not leak in.
    const summary = container.textContent ?? "";
    expect(summary).toContain(`${ES.summaryStudied}: 2`);
    expect(summary).toContain(`${ES.summarySaved}: 1`);
    // The control that the month filter is real: the counts come from the
    // grid, and the grid has exactly those squares.
    expect(container.querySelectorAll('[data-state="active"]').length).toBe(2);
    expect(container.querySelectorAll('[data-state="frozen"]').length).toBe(1);
    unmount();
  });

  it("пересчитывается при переходе на другой месяц", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);
    await user.click(screen.getByLabelText(ES.prevMonth));
    expect(container.textContent).toContain(`${ES.summaryStudied}: 1`); // 20.07
    expect(container.textContent).toContain(`${ES.summarySaved}: 0`);
  });

  it("месяц без занятий говорит «0», а не молчит", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);
    await user.click(screen.getByLabelText(ES.prevMonth));
    await user.click(screen.getByLabelText(ES.prevMonth)); // June — nothing at all
    expect(container.textContent).toContain(`${ES.summaryStudied}: 0`);
    expect(container.textContent).toContain(`${ES.summarySaved}: 0`);
  });
});

describe("тап по дню раскрывает, чем человек занимался", () => {
  it("день с занятием — кнопка; раскрытие показывает ВСЕ источники", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);

    const day = cell("2026-08-10")!;
    expect(day.tagName).toBe("BUTTON");
    expect(day.getAttribute("aria-expanded")).toBe("false");
    // Nothing is disclosed before the tap.
    expect(container.textContent).not.toContain("Qué hiciste el 10 de agosto");

    await user.click(day);
    expect(cell("2026-08-10")!.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Qué hiciste el 10 de agosto");
    // Three sources on that day, all three shown — not just the first.
    for (const label of [ES.sourceLabels.lesson, ES.sourceLabels.flashcards, ES.sourceLabels.media]) {
      expect(container.textContent).toContain(label);
    }
    // And not one that did not happen that day.
    expect(container.textContent).not.toContain(ES.sourceLabels.exam);
  });

  it("второй тап закрывает, тап по другому дню переключает", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);

    await user.click(cell("2026-08-10") as HTMLElement);
    await user.click(cell("2026-08-10") as HTMLElement);
    expect(container.textContent).not.toContain("Qué hiciste el 10 de agosto");

    await user.click(cell("2026-08-12") as HTMLElement);
    expect(container.textContent).toContain("Qué hiciste el 12 de agosto");
    expect(container.textContent).toContain(ES.sourceLabels.story);
    expect(container.textContent).not.toContain("Qué hiciste el 10 de agosto");
  });

  it("день без занятия по нажатию не открывает ничего — это не кнопка", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);

    const plain = cell("2026-08-13")!;
    const frozen = cell("2026-08-11")!;
    expect(plain.tagName).toBe("SPAN");
    expect(frozen.tagName).toBe("SPAN"); // a saved day is not a studied day
    expect(container.querySelectorAll("button[data-date]").length).toBe(2); // only 10 and 12

    await user.click(plain);
    await user.click(frozen);
    expect(container.textContent).not.toContain("Qué hiciste el");
  });

  it("смена месяца закрывает раскрытый день", async () => {
    const user = userEvent.setup();
    const { container } = renderCalendar(ES);
    await user.click(cell("2026-08-10") as HTMLElement);
    expect(container.textContent).toContain("Qué hiciste el 10 de agosto");
    await user.click(screen.getByLabelText(ES.prevMonth));
    expect(container.textContent).not.toContain("Qué hiciste el");
  });

  it("русская дата в родительном падеже, испанская — с «de»", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderCalendar(ES);
    await user.click(cell("2026-08-10") as HTMLElement);
    expect(container.textContent).toContain("10 de agosto");
    unmount();

    const ru = renderCalendar(RU);
    await user.click(cell("2026-08-10") as HTMLElement);
    expect(ru.container.textContent).toContain("Чем ты занимался 10 августа");
    expect(ru.container.textContent).not.toContain("август 10");
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

    // Everything the learner can do here: open a day, close it, open
    // another, and page back to the floor and forward to the ceiling, twice
    // over. Tapping a day is new since 31.08.2026 and is the one thing in
    // this component that could plausibly want to talk to a server, which
    // is exactly why it belongs inside this walk and not beside it.
    for (let round = 0; round < 2; round++) {
      await user.click(cell("2026-08-10") as HTMLElement);
      await user.click(cell("2026-08-10") as HTMLElement);
      await user.click(cell("2026-08-12") as HTMLElement);
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
