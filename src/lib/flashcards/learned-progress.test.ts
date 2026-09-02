import { describe, it, expect } from "vitest";
import { learnedProgressText } from "./learned-progress";
import esDict from "@/dictionaries/es.json";
import ruDict from "@/dictionaries/ru.json";

const es = {
  learnedProgressLabel: esDict.vocabulary.learnedProgressLabel,
  learnedProgressAvailableLabel: esDict.vocabulary.learnedProgressAvailableLabel,
};
const ru = {
  learnedProgressLabel: ruDict.vocabulary.learnedProgressLabel,
  learnedProgressAvailableLabel: ruDict.vocabulary.learnedProgressAvailableLabel,
};

describe("learnedProgressText", () => {
  it("prints the short sentence when nothing is locked", () => {
    expect(learnedProgressText("ru", ru, { known: 6, available: 5683, locked: 0 })).toBe(
      "Ты выучил 6 из 5683 слов",
    );
    expect(learnedProgressText("es", es, { known: 6, available: 5683, locked: 0 })).toBe(
      "Has aprendido 6 de 5683 palabras",
    );
  });

  it("names both numbers when something is behind Premium", () => {
    expect(learnedProgressText("ru", ru, { known: 6, available: 4787, locked: 896 })).toBe(
      "Ты выучил 6 из 4787 доступных · ещё 896 в Premium",
    );
    expect(learnedProgressText("es", es, { known: 6, available: 4787, locked: 896 })).toBe(
      "Llevas 6 de 4787 palabras disponibles · 896 más con Premium",
    );
  });

  it("never says «and 0 more» — the switch is `locked === 0`, not the tier", () => {
    for (const locale of ["ru", "es"] as const) {
      const dict = locale === "ru" ? ru : es;
      const text = learnedProgressText(locale, dict, { known: 1, available: 7, locked: 0 });
      expect(text).not.toMatch(/\b0\b/);
      expect(text).not.toMatch(/Premium/);
    }
  });

  it("inflects with the denominator, not with the number known", () => {
    // 1 available, 5 known would be nonsense data, but the point is which
    // number picks the noun's form: "1 доступного" / "1 palabra disponible".
    expect(learnedProgressText("ru", ru, { known: 0, available: 1, locked: 2 })).toContain(
      "из 1 доступного",
    );
    expect(learnedProgressText("es", es, { known: 0, available: 1, locked: 2 })).toContain(
      "1 palabra disponible",
    );
    // 22 → "few" in Russian; the Spanish forms are identical by design.
    expect(learnedProgressText("ru", ru, { known: 0, available: 22, locked: 2 })).toContain(
      "из 22 доступных",
    );
  });
});
