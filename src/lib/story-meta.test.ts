import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storyArticleDescription, storyMetaDescription, storyVisibleDescription } from "./story-meta";

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
  // «День стирки» (`/ru/stories/cmt07mslt0000bance9fb6rkw`) — строка, на
  // которой владелец 18.10.2026 нашёл испанский `description` в ld+json
  // при уже русском мета-описании (остаток долга 205, 7.275).
  {
    title: "День стирки",
    level: "A1",
    description: "Nastia lava la ropa como cada semana y encuentra en un bolsillo una pequeña sorpresa olvidada.",
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

/**
 * ДОЛГ 204 И ОСТАТОК ДОЛГА 205 (7.275): на `/ru/stories/…` нет испанского
 * описания ни в видимом абзаце под заголовком, ни в `description` разметки
 * `Article`; на `/es` испанская аннотация на месте — и там, и там.
 *
 * Сторож двусторонний и судит не пустоту: выборка — те же настоящие строки
 * прода, прежнее правило страницы (до 7.275) — подсадка, которую обязано
 * поймать на каждой строке; правило, отдающее пустоту на `/es`, — вторая
 * подсадка, которую тоже обязано поймать.
 */
type VisibleFn = typeof storyVisibleDescription;
type ArticleFn = typeof storyArticleDescription;

/** Прежнее правило страницы (до 7.275): одна строка на абзац и на разметку. */
const before7275Visible: VisibleFn = (story, lang) =>
  (lang === "ru" ? (story.descriptionRu ?? story.description) : story.description) || null;
const before7275Article: ArticleFn = (story, lang) => before7275Visible(story, lang);

function descriptionProblems(visible: VisibleFn, article: ArticleFn): string[] {
  const found: string[] = [];
  for (const s of PROD_SAMPLES) {
    const row = { description: s.description, descriptionRu: null, level: s.level };
    // /ru: абзаца нет вовсе (русской аннотации нет ни у одного рассказа).
    const ruVisible = visible(row, "ru");
    if (ruVisible !== null) found.push(`/ru «${s.title}»: видимый абзац «${ruVisible.slice(0, 30)}…»`);
    // /ru: в разметке — русская строка, та же, что в мета-описании.
    const ruArticle = article(row, "ru", s.title);
    if (ruArticle === null) found.push(`/ru «${s.title}»: в Article нет description`);
    else {
      const latin = latinWords(ruArticle);
      if (latin.length > 0) found.push(`/ru «${s.title}»: Article.description латиницей ${latin.slice(0, 3).join(", ")}`);
      if (ruArticle !== storyMetaDescription(row, "ru", s.title)) found.push(`/ru «${s.title}»: Article.description ≠ мета-описанию`);
    }
    // /es: всё на месте.
    if (visible(row, "es") !== s.description) found.push(`/es «${s.title}»: видимой аннотации нет или она подменена`);
    if (article(row, "es", s.title) !== s.description) found.push(`/es «${s.title}»: Article.description не испанская аннотация`);
  }
  return found;
}

describe("описание рассказа: видимый абзац и Article.description — на языке страницы (долги 204, 205)", () => {
  it("выборка не пуста, и в ней есть строка владельца «День стирки»", () => {
    expect(PROD_SAMPLES.length).toBeGreaterThanOrEqual(5);
    expect(PROD_SAMPLES.some((s) => s.title === "День стирки")).toBe(true);
  });

  it("новое правило: нарушений 0", () => {
    expect(descriptionProblems(storyVisibleDescription, storyArticleDescription)).toEqual([]);
  });

  it("подсадка: прежнее правило страницы ловится на каждой строке — и в абзаце, и в разметке", () => {
    const found = descriptionProblems(before7275Visible, before7275Article);
    expect(found.filter((f) => f.includes("видимый абзац")).length).toBe(PROD_SAMPLES.length);
    expect(found.filter((f) => f.includes("Article.description латиницей")).length).toBe(PROD_SAMPLES.length);
  });

  it("подсадка с другой стороны: правило, стирающее описание и на /es, ловится", () => {
    const found = descriptionProblems(
      () => null,
      (story, lang, title) => (lang === "ru" ? storyMetaDescription(story, lang, title) : null),
    );
    expect(found.filter((f) => f.startsWith("/es")).length).toBe(2 * PROD_SAMPLES.length);
  });

  it("«День стирки» на /ru: Article.description — ровно мета-описание", () => {
    const row = { description: PROD_SAMPLES.at(-1)!.description, descriptionRu: null, level: "A1" };
    expect(storyArticleDescription(row, "ru", "День стирки")).toBe(
      "«День стирки» — рассказ на русском языке, уровень A1, в RusoFácilapp.",
    );
  });

  it("русская аннотация, когда появится (долг 204), — и в абзаце, и в разметке", () => {
    const row = { description: PROD_SAMPLES[0].description, descriptionRu: "Сатира Чехова о полицейском.", level: "B1" };
    expect(storyVisibleDescription(row, "ru")).toBe("Сатира Чехова о полицейском.");
    expect(storyArticleDescription(row, "ru", "Хамелеон")).toBe("Сатира Чехова о полицейском.");
  });

  it("на /es без аннотации — ни абзаца, ни поля в разметке, как и было", () => {
    const row = { description: null, descriptionRu: null, level: "A2" };
    expect(storyVisibleDescription(row, "es")).toBeNull();
    expect(storyArticleDescription(row, "es", "x")).toBeNull();
  });
});

describe("страница рассказа печатает абзац и Article.description только через правила story-meta", () => {
  const PAGE = join(process.cwd(), "src", "app", "[lang]", "stories", "[id]", "page.tsx");

  /** Тело страницы — от `export default` до конца файла. */
  function pageBody(source: string): string {
    const from = source.indexOf("export default");
    return from < 0 ? "" : source.slice(from);
  }

  /** Объект разметки `Article` — от `"@type": "Article"` до закрытия `JsonLd`. */
  function articleBlock(body: string): string {
    const from = body.indexOf('"@type": "Article"');
    const to = body.indexOf("/>", from);
    return from < 0 || to < 0 ? "" : body.slice(from, to);
  }

  function wiringProblems(source: string): string[] {
    const body = pageBody(source);
    if (!body) return ["export default не найден"];
    const article = articleBlock(body);
    if (!article) return ["разметка Article не найдена"];
    const found: string[] = [];
    const visible = /const (\w+) = storyVisibleDescription\(/.exec(body);
    if (!visible) found.push("видимое описание собрано не через storyVisibleDescription");
    const articleVar = /const (\w+) = storyArticleDescription\(/.exec(body);
    if (!articleVar) found.push("описание Article собрано не через storyArticleDescription");
    const described = /\bdescription: (\w+)/.exec(article);
    if (!described) found.push("в Article нет поля description");
    else if (!articleVar || !new RegExp(`const ${described[1]} = \\w+ && fixBrandSpelling\\(${articleVar[1]}\\)`).test(body))
      found.push(`Article.description берёт «${described[1]}», а не результат storyArticleDescription`);
    const paragraph = /\{(\w+) && <p className="mt-3 text-foreground\/70">\{\1\}<\/p>\}/.exec(body);
    if (!paragraph) found.push("абзац описания под заголовком не найден");
    else if (!visible || !new RegExp(`const ${paragraph[1]} = \\w+ && fixBrandSpelling\\(${visible[1]}\\)`).test(body))
      found.push(`абзац печатает «${paragraph[1]}», а не результат storyVisibleDescription`);
    if (/descriptionRu\s*\?\?\s*story\.description/.test(source)) found.push("вернулась подстраховка «нет русского — дать испанское»");
    return found;
  }

  const source = readFileSync(PAGE, "utf8");

  it("настоящая страница: нарушений 0", () => {
    expect(wiringProblems(source)).toEqual([]);
  });

  it("подсадка: страница до 7.275 (одна испанская строка на абзац и разметку) ловится", () => {
    // Ровно тот код, что стоял в `main` до 7.275.
    const planted = source
      .replace(
        /const rawVisibleDescription = storyVisibleDescription\(story, lang\);\n\s*const visibleDescription = .*\n\s*const rawArticleDescription = .*\n\s*const articleDescription = .*\n/,
        'const rawLocalizedDescription = lang === "ru" ? (story.descriptionRu ?? story.description) : story.description;\n  const localizedDescription = rawLocalizedDescription && fixBrandSpelling(rawLocalizedDescription);\n',
      )
      .replace("description: articleDescription", "description: localizedDescription")
      .replace("{visibleDescription && <p", "{localizedDescription && <p")
      .replace("{visibleDescription}</p>", "{localizedDescription}</p>");
    expect(planted).not.toBe(source);
    expect(wiringProblems(planted)).toEqual([
      "видимое описание собрано не через storyVisibleDescription",
      "описание Article собрано не через storyArticleDescription",
      "Article.description берёт «localizedDescription», а не результат storyArticleDescription",
      "абзац печатает «localizedDescription», а не результат storyVisibleDescription",
      "вернулась подстраховка «нет русского — дать испанское»",
    ]);
  });

  it("подсадка: Article без description или страница без Article — красный, а не «чисто»", () => {
    expect(wiringProblems(source.replace(/\.\.\.\(articleDescription \? \{ description: articleDescription \} : \{\}\),/, ""))).toContain(
      "в Article нет поля description",
    );
    expect(wiringProblems("export default function Page() {}")).toEqual(["разметка Article не найдена"]);
  });
});
