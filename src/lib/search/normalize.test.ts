import { describe, expect, it } from "vitest";
import { fold, sharesStem, tokenize, tokensAreClose, withinEditDistance1 } from "./normalize";

/**
 * Три случая из замера 05.09.2026 (PROGRESS.md 7.127, часть 2), на
 * которых прежний поиск отвечал нулём, — и три разных приёма, которыми
 * они закрыты. Файл проверяет именно приёмы: если завтра кто-то заменит
 * порог 5 на 4, `casa` и `caso` станут одним словом, и об этом должно
 * стать известно здесь, а не из выдачи.
 */

describe("свёртка", () => {
  it("снимает испанскую диакритику: Précios и Precios — одна строка", () => {
    expect(fold("Précios")).toBe(fold("Precios"));
    expect(fold("PRÉCIOS")).toBe("precios");
  });

  it("схлопывает ё и й, потому что в NFD это буква плюс надстрочный знак", () => {
    expect(fold("ёлка")).toBe(fold("елка"));
    expect(fold("Йогурт")).toBe(fold("иогурт"));
  });

  it("контроль: свёртка не склеивает разные буквы", () => {
    // Иначе первые два случая доказывали бы только то, что fold всё
    // приводит к одному.
    expect(fold("gato")).not.toBe(fold("pato"));
    expect(fold("дом")).not.toBe(fold("том"));
  });

  it("режет на слова по всему, что не буква и не цифра", () => {
    expect(tokenize(fold("Examen A1 · Lecciones 1 a 10"))).toEqual(["examen", "a1", "lecciones", "1", "a", "10"]);
  });
});

describe("расстояние не больше единицы", () => {
  it("ловит перестановку соседних букв — это Cuenots", () => {
    expect(withinEditDistance1("cuenots", "cuentos")).toBe(true);
  });

  it("ловит лишнюю, пропущенную и заменённую букву", () => {
    expect(withinEditDistance1("cuentoss", "cuentos")).toBe(true);
    expect(withinEditDistance1("расказы", "рассказы")).toBe(true);
    expect(withinEditDistance1("cuentas", "cuentos")).toBe(true);
  });

  it("контроль: две правки — уже не опечатка", () => {
    expect(withinEditDistance1("cuenta", "cuentos")).toBe(false);
    expect(withinEditDistance1("расазы", "рассказы")).toBe(false);
  });
});

describe("общее начало слова", () => {
  it("ловит падежное окончание — это Рассказов", () => {
    expect(sharesStem("рассказов", "рассказы")).toBe(true);
    expect(sharesStem("рассказе", "рассказы")).toBe(true);
    expect(sharesStem("comidas", "comida")).toBe(true);
  });

  it("контроль: короткое общее начало — это разные слова, а не форма", () => {
    // Ровно то, что запрещает порог в пять знаков.
    expect(sharesStem("casa", "caso")).toBe(false);
    expect(sharesStem("рассказ", "расследование")).toBe(false);
    expect(sharesStem("дом", "дон")).toBe(false);
  });
});

describe("похожесть двух слов целиком", () => {
  it("на коротких словах одна правка не считается опечаткой", () => {
    // `casa`/`cosa` — разные слова, и расстояние 1 здесь ничего не
    // означает. Порог длины именно про это.
    expect(tokensAreClose("casa", "cosa")).toBe(false);
    expect(tokensAreClose("dos", "tos")).toBe(false);
  });

  it("а на длинных — считается", () => {
    expect(tokensAreClose("cuenots", "cuentos")).toBe(true);
    expect(tokensAreClose("рассказов", "рассказы")).toBe(true);
  });
});
