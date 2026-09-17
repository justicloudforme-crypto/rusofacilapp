import { describe, it, expect } from "vitest";
import { learnedProgressText } from "./learned-progress";
import esDict from "@/dictionaries/es.json";
import ruDict from "@/dictionaries/ru.json";

const es = {
  learnedProgressLabel: esDict.vocabulary.learnedProgressLabel,
  learnedProgressAvailableLabel: esDict.vocabulary.learnedProgressAvailableLabel,
  learnedProgressSubscriptionLabel: esDict.vocabulary.learnedProgressSubscriptionLabel,
  learnedProgressBothLabel: esDict.vocabulary.learnedProgressBothLabel,
};
const ru = {
  learnedProgressLabel: ruDict.vocabulary.learnedProgressLabel,
  learnedProgressAvailableLabel: ruDict.vocabulary.learnedProgressAvailableLabel,
  learnedProgressSubscriptionLabel: ruDict.vocabulary.learnedProgressSubscriptionLabel,
  learnedProgressBothLabel: ruDict.vocabulary.learnedProgressBothLabel,
};

describe("learnedProgressText", () => {
  it("prints the short sentence when nothing is locked", () => {
    expect(learnedProgressText("ru", ru, { known: 6, available: 5683, locked: 0 })).toBe(
      "Вы выучили 6 из 5683 слов",
    );
    expect(learnedProgressText("es", es, { known: 6, available: 5683, locked: 0 })).toBe(
      "Has aprendido 6 de 5683 palabras",
    );
  });

  it("names both numbers when something is behind Premium", () => {
    expect(learnedProgressText("ru", ru, { known: 6, available: 4787, locked: 896 })).toBe(
      "Вы выучили 6 из 4787 доступных · ещё 896 в Premium",
    );
    expect(learnedProgressText("es", es, { known: 6, available: 4787, locked: 896 })).toBe(
      "Llevas 6 de 4787 palabras disponibles · 896 más con Premium",
    );
  });

  it("never says «and 0 more» — the switch is `locked === 0`, not the tier", () => {
    for (const locale of ["ru", "es"] as const) {
      const dict = locale === "ru" ? ru : es;
      const text = learnedProgressText(locale, dict, { known: 1, available: 7, locked: 0, lockedBySubscription: 0 });
      expect(text).not.toMatch(/\b0\b/);
      expect(text).not.toMatch(/Premium/);
    }
  });

  // ——— ЗАХОД 7.206: закрытое разделено по ПРИЧИНЕ ———
  //
  // Числа настоящие, снятые с боевого банка 17.09.2026: всего 5771 строка,
  // не-C1 4783, тем 23, бесплатная проба 10 на тему → 230 доступно, 4553
  // закрыты ПОДПИСКОЙ, 988 (весь C1) — планом Premium.

  it("бесплатному аккаунту названы ОБЕ причины, и подписка — первой", () => {
    const es1 = learnedProgressText("es", es, {
      known: 0, available: 230, locked: 988, lockedBySubscription: 4553,
    });
    expect(es1).toBe(
      "Llevas 0 de 230 palabras disponibles · 4553 más con la suscripción y 988 con Premium",
    );
    expect(es1).not.toContain("4783"); // ровно то число, которое стояло до правки
    const ru1 = learnedProgressText("ru", ru, {
      known: 0, available: 230, locked: 988, lockedBySubscription: 4553,
    });
    expect(ru1).toContain("из 230 доступных слов");
    expect(ru1).toContain("ещё 4553 открывает подписка");
    expect(ru1).toContain("988 — Premium");
  });

  it("подписчику standard названа только Premium — подписка у него уже есть", () => {
    expect(
      learnedProgressText("es", es, { known: 6, available: 4783, locked: 988, lockedBySubscription: 0 }),
    ).toBe("Llevas 6 de 4783 palabras disponibles · 988 más con Premium");
  });

  it("если закрыто только пробой — про Premium не сказано ни слова", () => {
    const text = learnedProgressText("es", es, {
      known: 1, available: 230, locked: 0, lockedBySubscription: 4553,
    });
    expect(text).toContain("con la suscripción");
    expect(text).not.toContain("Premium");
  });

  it("Premium/сотруднику закрытого нет вовсе — предложение короткое", () => {
    const text = learnedProgressText("es", es, {
      known: 12, available: 5771, locked: 0, lockedBySubscription: 0,
    });
    expect(text).toBe("Has aprendido 12 de 5771 palabras");
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
