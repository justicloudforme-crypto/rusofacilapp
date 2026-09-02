import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";
import { PUBLIC_VOCABULARY_LEVELS } from "./vocabulary-categories";

/**
 * «C1 подписан, но не опубликован» — инвариант из двух половин, и обе
 * ломаются по-разному.
 *
 * Половина первая: подпись существует и говорит про Premium. Половина
 * вторая — и она важнее: подпись НЕ должна открыть то, что подписывает.
 * Сорваться это может ровно одним способом — если кто-нибудь, дописывая
 * блок, заодно снимет фильтр уровней или добавит C1 в список
 * публикуемых. Поэтому тест читает исходники страниц, а не только
 * словари: словарная строка сама по себе ничего не гарантирует.
 */
const ROOT = join(__dirname, "..", "app", "[lang]", "vocabulary");
const indexPage = readFileSync(join(ROOT, "page.tsx"), "utf-8");
const categoryPage = readFileSync(join(ROOT, "[categoria]", "page.tsx"), "utf-8");

describe("C1 is signposted on /vocabulary without being published", () => {
  it("keeps the published levels at A1–B2 on both pages", () => {
    expect(PUBLIC_VOCABULARY_LEVELS).toEqual(["A1", "A2", "B1", "B2"]);
    // Списки строятся только из PUBLIC_VOCABULARY_LEVELS; если появится
    // второй источник уровней, эта строка перестанет быть правдой.
    expect(categoryPage).toContain("publicLevels.has(card.level)");
  });

  it("never renders a C1 card's text on the category page", () => {
    // Разрешено ровно одно обращение к C1 — подсчёт. Всё, что берёт у
    // C1-карточки текст (russian/translationEs/exampleRu), — регрессия.
    const c1Lines = categoryPage
      .split("\n")
      .filter((line) => line.includes('"C1"'));
    expect(c1Lines.length).toBeGreaterThan(0);
    for (const line of c1Lines) {
      expect(line, line.trim()).not.toMatch(/russian|translationEs|exampleRu|transcription/);
    }
    expect(categoryPage).toContain("const c1Count");
  });

  it("carries the levels promise in both locales", () => {
    // Действующая формула (PROGRESS 7.76): курс A1–B2, материалы до C1.
    // Проверяется целая фраза, а не два токена по отдельности: первый
    // прогон позитивного контроля показал, что `toContain("A1–B2")`
    // проходит и тогда, когда из самой формулы половину вырезали, —
    // «A1–B2» есть в тексте и выше, в предложении про списки.
    const formula = {
      es: /curso es A1–B2[^.]*hasta el C1/,
      ru: /[Кк]урс — A1–B2[^.]*до C1/,
    } as const;
    for (const [locale, dict] of [["es", es], ["ru", ru]] as const) {
      const v = dict.vocabulary as unknown as Record<string, string>;
      expect(v.c1PremiumHeading, locale).toBeTruthy();
      expect(v.c1PremiumCta, locale).toBeTruthy();
      expect(v.c1PremiumBody, locale).toMatch(formula[locale]);
    }
    expect(indexPage).toContain("dict.vocabulary.c1PremiumBody");
    expect(categoryPage).toContain("A1–B2; el vocabulario, los cuentos y los juegos llegan hasta el C1");
  });

  it("adds no new URL: the notice links to pricing, not to a C1 page", () => {
    for (const source of [indexPage, categoryPage]) {
      expect(source).not.toMatch(/vocabulary\/[^"'`\s]*c1/i);
    }
    expect(indexPage).toContain("/pricing");
    expect(categoryPage).toContain("/es/pricing");
  });
});
