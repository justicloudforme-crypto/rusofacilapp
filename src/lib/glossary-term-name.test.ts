import { describe, expect, it } from "vitest";
import { glossaryTermNames, glossaryTermPrimaryName } from "./glossary-term-name";

/** Все четыре случая — те самые, что измерены по боевой базе 19.09.2026:
 * обычный термин (113 из 119), совпадение полей (6 из 119), пустой
 * русский эквивалент (0 из 119, но правило обязано на него отвечать) и
 * зеркальное поведение испанской локали. */
describe("glossaryTermNames", () => {
  const ordinary = { term: "caso vocativo", russianEquivalent: "звательный падеж" };

  it("в /ru главным печатается русский эквивалент, испанское — второй строкой", () => {
    expect(glossaryTermNames(ordinary, "ru")).toEqual({
      primary: "звательный падеж",
      secondary: "caso vocativo",
    });
  });

  it("в /es главным остаётся испанское название и второй строки нет", () => {
    expect(glossaryTermNames(ordinary, "es")).toEqual({ primary: "caso vocativo", secondary: null });
  });

  it("незнакомая локаль ведёт себя как испанская, а не как русская", () => {
    expect(glossaryTermNames(ordinary, "en").primary).toBe("caso vocativo");
  });

  it("совпадающие поля не печатаются дважды: второй строки нет (6 терминов из 119)", () => {
    const pair = { term: "бежать / бегать", russianEquivalent: "бежать / бегать" };
    expect(glossaryTermNames(pair, "ru")).toEqual({ primary: "бежать / бегать", secondary: null });
  });

  it("пустой русский эквивалент не оставляет на экране дыру: главным остаётся испанское", () => {
    expect(glossaryTermNames({ term: "artículo", russianEquivalent: "" }, "ru")).toEqual({
      primary: "artículo",
      secondary: null,
    });
    expect(glossaryTermNames({ term: "artículo", russianEquivalent: "   " }, "ru").primary).toBe("artículo");
    expect(glossaryTermNames({ term: "artículo", russianEquivalent: null }, "ru").primary).toBe("artículo");
    expect(glossaryTermNames({ term: "artículo" }, "ru").primary).toBe("artículo");
  });

  it("пробелы по краям не делают из одинаковых полей разные", () => {
    expect(glossaryTermNames({ term: " идти / ходить ", russianEquivalent: "идти / ходить" }, "ru").secondary).toBeNull();
  });

  it("glossaryTermPrimaryName отдаёт то же главное имя", () => {
    expect(glossaryTermPrimaryName(ordinary, "ru")).toBe("звательный падеж");
    expect(glossaryTermPrimaryName(ordinary, "es")).toBe("caso vocativo");
  });
});
