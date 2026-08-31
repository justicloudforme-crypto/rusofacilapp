import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StreakExplanation from "./StreakExplanation";

// The sentence that keeps "nine flames on the calendar" and "racha actual:
// 2 días" from reading as a contradiction.
//
// What is actually checked here is not the wording but the SHAPE of the
// output: three cases, three whole sentences, and never a template with a
// placeholder left in it or a date that resolved to nothing. That is the
// failure mode this kind of string has — "La racha cuenta desde el ." is
// worse than saying nothing at all.

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS_RU = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

const ES = {
  sinceBreak: "La racha cuenta desde el {start}: el {broken} no estudiaste y volvió a empezar.",
  neverBroken: "La racha nunca se ha cortado: cuenta desde el {start}, tu primer día.",
  none: "Completa una lección, repasa tarjetas o lee una historia para empezar tu racha.",
  monthsInDate: MONTHS_ES,
  datePattern: "{day} de {month}",
};

const RU = {
  sinceBreak: "Серия считается с {start}: {broken} занятий не было, и она началась заново.",
  neverBroken: "Серия ни разу не прерывалась: считается с {start} — твоего первого дня.",
  none: "Выполни урок, повтори карточки или прочитай рассказ, чтобы начать серию.",
  monthsInDate: MONTHS_RU,
  datePattern: "{day} {month}",
};

function textOf(props: Parameters<typeof StreakExplanation>[0]) {
  return render(<StreakExplanation {...props} />).container.textContent ?? "";
}

/** No leftover placeholder, no empty date, no sentence that stops early. */
function looksWhole(text: string) {
  expect(text).not.toMatch(/\{[a-z]+\}/); // an unreplaced {start} / {broken}
  expect(text.trim().length).toBeGreaterThan(20);
  expect(text).not.toMatch(/\s\.|:\s*$|—\s*$|,\s*$/); // " ." / trailing ":" / dangling dash or comma
  expect(text.trim()).toMatch(/[.!?]$/); // it ends as a sentence
}

describe("объяснение серии — три случая, три целые фразы", () => {
  it("серия идёт, и до неё был пропуск: называет обе даты", () => {
    const text = textOf({
      currentStreak: 2,
      chainStartedOn: "2026-08-30",
      brokenOn: "2026-08-29",
      dict: ES,
    });
    expect(text).toContain("30 de agosto");
    expect(text).toContain("29 de agosto");
    looksWhole(text);
  });

  it("то же по-русски, в родительном падеже", () => {
    const text = textOf({
      currentStreak: 2,
      chainStartedOn: "2026-08-30",
      brokenOn: "2026-08-29",
      dict: RU,
    });
    expect(text).toContain("30 августа");
    expect(text).toContain("29 августа");
    expect(text).not.toContain("август 30");
    looksWhole(text);
  });

  it("пропусков не было вообще: не выдумывает дату пропуска", () => {
    for (const dict of [ES, RU]) {
      const text = textOf({ currentStreak: 12, chainStartedOn: "2026-08-20", brokenOn: null, dict });
      expect(text).toContain(dict === ES ? "20 de agosto" : "20 августа");
      looksWhole(text);
      // The break half of the other sentence must not leak in.
      expect(text).not.toContain(dict.sinceBreak.slice(0, 12));
    }
  });

  it("серия равна нулю: целая фраза о том, как её начать", () => {
    for (const dict of [ES, RU]) {
      const text = textOf({ currentStreak: 0, chainStartedOn: null, brokenOn: null, dict });
      expect(text).toBe(dict.none);
      looksWhole(text);
    }
  });

  it("защита от полуфразы: серия > 0 без старта цепочки всё равно даёт целое предложение", () => {
    // Cannot happen while both come out of the same walk, and is written
    // down anyway — this is exactly the input that would otherwise render
    // "La racha cuenta desde el ."
    const text = textOf({ currentStreak: 3, chainStartedOn: null, brokenOn: null, dict: ES });
    expect(text).toBe(ES.none);
    looksWhole(text);
  });

  it("контроль: проверка «целой фразы» умеет ловить полуфразу", () => {
    // Rule 4.1 — looksWhole() answers "fine" four times above, so it has to
    // be shown catching the thing it is looking for.
    expect(() => looksWhole("La racha cuenta desde el .")).toThrow();
    expect(() => looksWhole("La racha cuenta desde el {start}.")).toThrow();
    expect(() => looksWhole("Серия считается с")).toThrow();
    expect(() => looksWhole("")).toThrow();
  });
});

describe("настоящие строки словарей, а не фикстуры этого файла", () => {
  // The cases above use local copies, so they would keep passing after
  // someone shortened the real string to "Racha desde el {start}" and
  // forgot the period. These read src/dictionaries directly.
  const load = (locale: string) =>
    JSON.parse(readFileSync(join(process.cwd(), "src", "dictionaries", `${locale}.json`), "utf8")).profile;

  for (const locale of ["es", "ru"]) {
    it(`${locale}: все три фразы целые и на своих местах`, () => {
      const p = load(locale);
      const dict = {
        sinceBreak: p.streakSinceBreakNote,
        neverBroken: p.streakNeverBrokenNote,
        none: p.streakNoneNote,
        monthsInDate: p.calendarMonthsInDate,
        datePattern: p.calendarDatePattern,
      };
      expect(dict.monthsInDate).toHaveLength(12);

      looksWhole(textOf({ currentStreak: 2, chainStartedOn: "2026-08-30", brokenOn: "2026-08-29", dict }));
      looksWhole(textOf({ currentStreak: 9, chainStartedOn: "2026-08-01", brokenOn: null, dict }));
      looksWhole(textOf({ currentStreak: 0, chainStartedOn: null, brokenOn: null, dict }));

      // Both placeholders are actually used by the "since a break" string —
      // a template that dropped {broken} would still render a whole
      // sentence, and would silently stop naming the day that matters.
      expect(dict.sinceBreak).toContain("{start}");
      expect(dict.sinceBreak).toContain("{broken}");
      expect(dict.neverBroken).toContain("{start}");
    });
  }
});
