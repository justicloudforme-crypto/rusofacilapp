import { describe, expect, it } from "vitest";
import { agarrarFor, replaceCoger } from "./no-coger-filter";
import { findCoger } from "../../scripts/check-no-coger.mjs";

describe("replaceCoger — находка 7.319 (живые ответы MyMemory)", () => {
  it.each([
    ["cogió", "agarró"], // «взяла»
    ["Lo cojo.", "Lo agarro."], // «возьму», «беру»
    ["Coge", "Agarra"], // «возьми»
  ])("%s → %s", (from, to) => {
    expect(replaceCoger(from)).toBe(to);
  });
});

describe("replaceCoger — формы и спряжение", () => {
  it.each([
    ["coger", "agarrar"],
    ["cojo", "agarro"],
    ["coja", "agarre"],
    ["cojas", "agarres"],
    ["cojamos", "agarremos"],
    ["cojan", "agarren"],
    ["cojáis", "agarréis"],
    ["coge", "agarra"],
    ["cogí", "agarré"],
    ["cogiste", "agarraste"],
    ["cogieron", "agarraron"],
    ["cogía", "agarraba"],
    ["cogíamos", "agarrábamos"],
    ["cogeré", "agarraré"],
    ["cogería", "agarraría"],
    ["cogiera", "agarrara"],
    ["cogiéramos", "agarráramos"],
    ["cogido", "agarrado"],
    ["cogidas", "agarradas"],
    ["cogiendo", "agarrando"],
    ["coged", "agarrad"],
  ])("%s → %s", (from, to) => {
    expect(replaceCoger(from)).toBe(to);
  });

  it("заглавная в начале фразы и ЗАГЛАВНЫЕ целиком", () => {
    expect(replaceCoger("Cogió el libro y se fue.")).toBe("Agarró el libro y se fue.");
    expect(replaceCoger("Cojo el autobús.")).toBe("Agarro el autobús.");
    expect(replaceCoger("COGE")).toBe("AGARRA");
    expect(replaceCoger("¡Cógelo!")).toBe("¡Agárralo!");
  });

  it.each([
    ["cógelo", "agárralo"],
    ["cógela", "agárrala"],
    ["cógemelo", "agárramelo"],
    ["cogerlo", "agarrarlo"],
    ["cogérselo", "agarrárselo"],
    ["cogiéndolo", "agarrándolo"],
    ["cójalo", "agárrelo"],
    ["cójanlo", "agárrenlo"],
    ["cojámoslo", "agarrémoslo"],
    ["cojámonos", "agarrémonos"],
    ["cogedlo", "agarradlo"],
    ["cogeos", "agarraos"],
    ["cogelo", "agárralo"], // без ударения, как иногда пишут
  ])("энклитики: %s → %s", (from, to) => {
    expect(replaceCoger(from)).toBe(to);
  });

  it("несколько форм и знаки препинания в одной строке", () => {
    expect(replaceCoger("tomar, coger; lo cogí, ¿lo coges?")).toBe("tomar, agarrar; lo agarré, ¿lo agarras?");
  });

  it("после замены сторож check:no-coger ничего не находит", () => {
    const samples = ["cogió", "Lo cojo.", "Coge", "¡Cógelo!", "cogérselo", "Si cogiéramos el tren", "No cojas eso"];
    for (const s of samples) expect(findCoger(replaceCoger(s))).toEqual([]);
  });
});

describe("replaceCoger — НЕ трогает чужие слова", () => {
  it.each([
    "recoger",
    "Recoge la mesa.",
    "escoger",
    "escogió",
    "encogerse",
    "se encogió de hombros",
    "acoger",
    "acogieron",
    "sobrecoger",
    "cojear",
    "cojeaba",
    "cojeó",
    "la cojera",
    "cognitivo",
    "el cogote",
    "cogollo",
    "colocar",
    "cocina",
    "tomar, agarrar",
    "",
  ])("%s — как есть", (text) => {
    expect(replaceCoger(text)).toBe(text);
  });

  it("«хромой»: cojo/coja остаются, если русское слово — «хром…»", () => {
    expect(replaceCoger("cojo", { russian: "хромой" })).toBe("cojo");
    expect(replaceCoger("Coja", { russian: "Хромая" })).toBe("Coja");
    expect(replaceCoger("cojo", { russian: "беру" })).toBe("agarro");
  });

  it("agarrarFor — null для не-форм", () => {
    expect(agarrarFor("recoger")).toBeNull();
    expect(agarrarFor("cojear")).toBeNull();
    expect(agarrarFor("casa")).toBeNull();
  });
});
