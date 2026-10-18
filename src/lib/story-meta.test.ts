import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storyMetaDescription } from "./story-meta";

/**
 * ДОЛГ 205 (7.274): на `/ru/stories/…` мета-описание — не испанское.
 *
 * Выборка — НАСТОЯЩИЕ строки: испанские аннотации, снятые 18.10.2026 с
 * живых страниц `/ru/stories/…` (там они и стояли в `<meta
 * name="description">`), и русские названия тех же рассказов.
 * Прежнее правило страницы лежит здесь же как подсадка: правило обязано
 * его поймать, иначе «0 находок» ничего не значит (правило замера 4.1).
 */
const PROD_SAMPLES = [
  {
    title: "Хамелеон",
    level: "B1",
    description:
      "Un relato satírico de Chéjov sobre un policía que cambia de opinión según el poder de quien tiene enfrente.",
  },
  {
    title: "Три медведя",
    level: "A1",
    description: "Un cuento clásico ruso sobre una niña que se pierde en el bosque y entra en la casa de tres osos.",
  },
  {
    title: "Каша из топора",
    level: "A2",
    description:
      "Un cuento popular sobre el ingenio de un soldado que consigue una comida deliciosa de la nada — una lección con humor sobre la generosidad y la picardía.",
  },
  {
    title: "Кофе на вынос",
    level: "B1",
    description:
      "Una historia moderna sobre un barista, una clienta silenciosa y cómo un pequeño gesto de generosidad puede cambiarlo todo.",
  },
];

type MetaFn = typeof storyMetaDescription;

/** Прежнее правило `generateMetadata` (до 7.274) — подсадка. */
const before7274: MetaFn = (story, lang) => {
  const text = lang === "ru" ? (story.descriptionRu ?? story.description) : story.description;
  return (
    text ??
    (lang === "ru"
      ? `Рассказ на русском языке, уровень ${story.level}, в RusoFácilapp.`
      : `Cuento en ruso, nivel ${story.level}, en RusoFácilapp.`)
  );
};

/** Латинские слова от трёх букв, кроме имени продукта, — испанский текст. */
function latinWords(text: string): string[] {
  return text.replace(/RusoFácil(?:app)?/g, "").match(/[a-záéíóúüñ]{3,}/giu) ?? [];
}

/** Правило: на `/ru` описание русское, на `/es` — испанская аннотация. */
function problems(fn: MetaFn): string[] {
  const found: string[] = [];
  for (const s of PROD_SAMPLES) {
    const row = { description: s.description, descriptionRu: null, level: s.level };
    const ru = fn(row, "ru", s.title);
    const latin = latinWords(ru);
    if (latin.length > 0) found.push(`/ru «${s.title}»: латиница ${latin.slice(0, 3).join(", ")}`);
    if (!/\p{Script=Cyrillic}/u.test(ru)) found.push(`/ru «${s.title}»: нет кириллицы`);
    const es = fn(row, "es", s.title);
    if (es !== s.description) found.push(`/es «${s.title}»: испанская аннотация подменена`);
  }
  return found;
}

describe("мета-описание рассказа — на языке страницы (долг 205)", () => {
  it("выборка не пуста", () => {
    expect(PROD_SAMPLES.length).toBeGreaterThanOrEqual(4);
  });

  it("новое правило: нарушений 0", () => {
    expect(problems(storyMetaDescription)).toEqual([]);
  });

  it("подсадка: прежнее правило страницы ловится на каждой строке выборки", () => {
    const found = problems(before7274);
    expect(found.filter((f) => f.startsWith("/ru")).length).toBeGreaterThanOrEqual(PROD_SAMPLES.length);
  });

  it("на /ru без русской аннотации — название рассказа и уровень, у каждой страницы своё", () => {
    const lines = PROD_SAMPLES.map((s) =>
      storyMetaDescription({ description: s.description, descriptionRu: null, level: s.level }, "ru", s.title),
    );
    expect(lines[0]).toBe("«Хамелеон» — рассказ на русском языке, уровень B1, в RusoFácilapp.");
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("на /ru русская аннотация, когда она есть (долг 204), — она и печатается", () => {
    const row = { description: PROD_SAMPLES[0].description, descriptionRu: "Сатира Чехова о полицейском.", level: "B1" };
    expect(storyMetaDescription(row, "ru", "Хамелеон")).toBe("Сатира Чехова о полицейском.");
  });

  it("на /es без аннотации — прежняя испанская строка", () => {
    expect(storyMetaDescription({ description: null, descriptionRu: null, level: "A2" }, "es", "x")).toBe(
      "Cuento en ruso, nivel A2, en RusoFácilapp.",
    );
  });
});

describe("страница рассказа берёт описание только из storyMetaDescription", () => {
  const PAGE = join(process.cwd(), "src", "app", "[lang]", "stories", "[id]", "page.tsx");

  /** Тело `generateMetadata` — от объявления до `export default`. */
  function metadataBody(source: string): string {
    const from = source.indexOf("export async function generateMetadata");
    const to = source.indexOf("export default", from);
    return from < 0 || to < 0 ? "" : source.slice(from, to);
  }

  function pageProblems(source: string): string[] {
    const body = metadataBody(source);
    if (!body) return ["generateMetadata не найден"];
    const found: string[] = [];
    if (!body.includes("storyMetaDescription(")) found.push("описание собрано не через storyMetaDescription");
    if (/descriptionRu\s*\?\?\s*story\.description/.test(body)) found.push("вернулась подстраховка «нет русского — дать испанское»");
    return found;
  }

  const source = readFileSync(PAGE, "utf8");

  it("настоящая страница: нарушений 0", () => {
    expect(pageProblems(source)).toEqual([]);
  });

  it("подсадка: прежняя подстраховка в generateMetadata ловится", () => {
    const planted = source.replace(
      /storyMetaDescription\(story, lang, storyTitles\(story, lang\)\.primary\)/,
      "(lang === \"ru\" ? (story.descriptionRu ?? story.description) : story.description) ?? \"\"",
    );
    expect(planted).not.toBe(source);
    expect(pageProblems(planted)).toEqual([
      "описание собрано не через storyMetaDescription",
      "вернулась подстраховка «нет русского — дать испанское»",
    ]);
  });

  it("подсадка: страница без generateMetadata — красный, а не «чисто»", () => {
    expect(pageProblems("export default function Page() {}")).toEqual(["generateMetadata не найден"]);
  });
});
