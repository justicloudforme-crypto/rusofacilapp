import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storyArticleDescription, storyMetaDescription, storyVisibleDescription } from "./story-meta";
import { mediaDescription, mediaJsonLdDescription, mediaVisibleDescription } from "./media/metadata";

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

/**
 * МЕДИА НА `/ru` — `description` РАЗМЕТКИ `LearningResource` (заход 7.276,
 * решение владельца 18.10.2026).
 *
 * Тот же класс, что остаток долга 205 у рассказов: мета-описание `/ru/media/…`
 * русское с 30.08.2026, а `description` в ld+json той же страницы стоял
 * испанский (`item.description`; замер 7.275 и 7.276 на проде — 20 из 20).
 * Теперь на `/ru` разметка = мета-описание (`mediaJsonLdDescription`), на
 * `/es` — испанский абзац записи, как и был.
 *
 * Выборка — ВСЕ записи `src/lib/media/mediaData.json`: этот файл и есть
 * каталог прода (заголовок, уровень, описание едут с кодом), 275 записей.
 * Пустой или усохший файл — красный, а не «нарушений 0» (правило 4.1).
 * Язык строки — по большинству букв (кириллица против латиницы, имя
 * продукта вычтено): в русских строках есть испанские скобки названий
 * («Катюша (canción folclórica)»), и проверка «ни одного латинского слова»
 * судила бы название, а не язык описания.
 */
type MediaRow = { id: string; title: string; level: string; category: string; description: string };
type MediaLdFn = typeof mediaJsonLdDescription;

const MEDIA_ROWS = Object.values(
  JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "media", "mediaData.json"), "utf8")) as Record<string, MediaRow>,
);

function letterLanguage(text: string): "ru" | "es" | "?" {
  const bare = text.replace(/RusoFácil(?:app)?/giu, "");
  const latin = (bare.match(/[a-záéíóúüñ]/giu) ?? []).length;
  const cyrillic = (bare.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  return cyrillic > latin ? "ru" : latin > 0 ? "es" : "?";
}

/** Прежнее правило страницы (до 7.276): испанский абзац на обеих локалях. */
const before7276MediaLd: MediaLdFn = (_lang, item) => item.description;

function mediaLdProblems(fn: MediaLdFn): string[] {
  const found: string[] = [];
  for (const item of MEDIA_ROWS) {
    const ru = fn("ru", item);
    if (ru !== mediaDescription("ru", item)) found.push(`/ru ${item.id}: LearningResource.description ≠ мета-описанию`);
    if (letterLanguage(ru) !== "ru") found.push(`/ru ${item.id}: LearningResource.description не русский («${ru.slice(0, 30)}…»)`);
    if (fn("es", item) !== item.description) found.push(`/es ${item.id}: LearningResource.description — не испанский абзац записи`);
  }
  return found;
}

describe("медиа: description разметки LearningResource — на языке страницы (7.276)", () => {
  it("выборка — каталог медиа целиком, не пустая", () => {
    expect(MEDIA_ROWS.length).toBeGreaterThanOrEqual(275);
    expect(MEDIA_ROWS.every((item) => item.description && item.title)).toBe(true);
  });

  it("новое правило: нарушений 0 на всех записях", () => {
    expect(mediaLdProblems(mediaJsonLdDescription)).toEqual([]);
  });

  it("подсадка: прежнее правило (испанский абзац и на /ru) ловится на каждой записи", () => {
    const found = mediaLdProblems(before7276MediaLd);
    // Каждая запись поймана хотя бы признаком «≠ мета-описанию». По языку
    // букв — 273 из 275: у `history-gagarin` абзац записи и так русский, у
    // `video-saludos-presentaciones` русских цитат больше, чем испанских букв.
    expect(found.filter((f) => f.includes("≠ мета-описанию")).length).toBe(MEDIA_ROWS.length);
    expect(found.filter((f) => f.includes("не русский")).length).toBeGreaterThanOrEqual(MEDIA_ROWS.length - 2);
  });

  it("подсадка с другой стороны: русская строка и на /es ловится на каждой записи", () => {
    const found = mediaLdProblems((_lang, item) => mediaDescription("ru", item));
    expect(found.filter((f) => f.startsWith("/es")).length).toBe(MEDIA_ROWS.length);
  });

  it("«Катюша» на /ru: разметка — ровно мета-описание; на /es — испанский абзац", () => {
    const item = MEDIA_ROWS.find((row) => row.title.startsWith("Катюша"))!;
    expect(item).toBeDefined();
    expect(mediaJsonLdDescription("ru", item)).toBe(mediaDescription("ru", item));
    expect(mediaJsonLdDescription("ru", item)).toMatch(/^«Катюша/);
    expect(mediaJsonLdDescription("es", item)).toBe(item.description);
  });
});

describe("страница медиа берёт description разметки только через mediaJsonLdDescription", () => {
  const PAGE = join(process.cwd(), "src", "app", "[lang]", "media", "[id]", "page.tsx");

  /** Объект разметки `LearningResource` — от `"@type": "LearningResource"` до закрытия `JsonLd`. */
  function learningResourceBlock(source: string): string {
    const from = source.indexOf('"@type": "LearningResource"');
    const to = source.indexOf("/>", from);
    return from < 0 || to < 0 ? "" : source.slice(from, to);
  }

  function mediaWiringProblems(source: string): string[] {
    const block = learningResourceBlock(source);
    if (!block) return ["разметка LearningResource не найдена"];
    const described = /\bdescription: ([^\n]+?),?\n/.exec(block);
    if (!described) return ["в LearningResource нет поля description"];
    return described[1] === "mediaJsonLdDescription(lang, item)"
      ? []
      : [`LearningResource.description берёт «${described[1]}», а не mediaJsonLdDescription(lang, item)`];
  }

  const source = readFileSync(PAGE, "utf8");

  it("настоящая страница: нарушений 0", () => {
    expect(mediaWiringProblems(source)).toEqual([]);
  });

  it("подсадка: страница до 7.276 (description: item.description) ловится", () => {
    // Ровно та строка, что стояла в `main` до 7.276.
    const planted = source.replace("description: mediaJsonLdDescription(lang, item),", "description: item.description,");
    expect(planted).not.toBe(source);
    expect(mediaWiringProblems(planted)).toEqual([
      "LearningResource.description берёт «item.description», а не mediaJsonLdDescription(lang, item)",
    ]);
  });

  it("подсадка: разметка без description или страница без LearningResource — красный, а не «чисто»", () => {
    expect(mediaWiringProblems(source.replace(/\n\s*description: mediaJsonLdDescription\(lang, item\),/, ""))).toEqual([
      "в LearningResource нет поля description",
    ]);
    expect(mediaWiringProblems("export default function Page() {}")).toEqual(["разметка LearningResource не найдена"]);
  });
});

/**
 * МЕДИА НА `/ru` — ВИДИМЫЙ АБЗАЦ ПОД ЗАГОЛОВКОМ (заход 7.277, решение
 * владельца 19.10.2026, вариант «а» раздела 7 после 7.276).
 *
 * Тот же класс, что долг 204 у рассказов (7.275): под русским заголовком
 * `/ru/media/…` печатался испанский абзац записи (`item.description`). Теперь
 * на `/ru` абзаца нет (`mediaVisibleDescription`), на `/es` — абзац записи,
 * как и был. Выборка — весь каталог `mediaData.json` (275 записей); прежнее
 * правило — подсадка, пойманная на каждой записи; правило, стирающее абзац и
 * на `/es`, — вторая подсадка; страница, печатающая `item.description` мимо
 * правила, — третья.
 */
type MediaVisibleFn = typeof mediaVisibleDescription;

/** Прежнее правило страницы (до 7.277): абзац записи на обеих локалях. */
const before7277MediaVisible: MediaVisibleFn = (_lang, item) => item.description;

function mediaVisibleProblems(fn: MediaVisibleFn): string[] {
  const found: string[] = [];
  for (const item of MEDIA_ROWS) {
    const ru = fn("ru", item);
    if (ru !== null) found.push(`/ru ${item.id}: видимый абзац «${ru.slice(0, 30)}…»`);
    if (fn("es", item) !== item.description) found.push(`/es ${item.id}: видимого абзаца нет или он подменён`);
  }
  return found;
}

describe("медиа: видимый абзац под заголовком — только на /es (7.277)", () => {
  it("новое правило: нарушений 0 на всех записях", () => {
    expect(MEDIA_ROWS.length).toBeGreaterThanOrEqual(275);
    expect(mediaVisibleProblems(mediaVisibleDescription)).toEqual([]);
  });

  it("подсадка: прежнее правило (испанский абзац и на /ru) ловится на каждой записи", () => {
    const found = mediaVisibleProblems(before7277MediaVisible);
    expect(found.filter((f) => f.startsWith("/ru")).length).toBe(MEDIA_ROWS.length);
    expect(found.filter((f) => f.startsWith("/es")).length).toBe(0);
  });

  it("подсадка с другой стороны: правило, стирающее абзац и на /es, ловится на каждой записи", () => {
    const found = mediaVisibleProblems(() => null);
    expect(found.filter((f) => f.startsWith("/es")).length).toBe(MEDIA_ROWS.length);
  });
});

describe("страница медиа печатает абзац под заголовком только через mediaVisibleDescription", () => {
  const PAGE = join(process.cwd(), "src", "app", "[lang]", "media", "[id]", "page.tsx");

  function visibleWiringProblems(source: string): string[] {
    const from = source.indexOf("export default");
    if (from < 0) return ["export default не найден"];
    const body = source.slice(from);
    const found: string[] = [];
    const visible = /const (\w+) = mediaVisibleDescription\(lang, item\);/.exec(body);
    if (!visible) found.push("видимый абзац собран не через mediaVisibleDescription");
    const paragraph = /\{(\w+) && <p className="mt-2 text-foreground\/70">\{\1\}<\/p>\}/.exec(body);
    if (!paragraph) found.push("абзац под заголовком не найден");
    else if (!visible || paragraph[1] !== visible[1])
      found.push(`абзац печатает «${paragraph[1]}», а не результат mediaVisibleDescription`);
    // Абзац записи в разметке страницы — мимо правила, на обеих локалях.
    if (/\{item\.description\}/.test(body)) found.push("страница печатает {item.description} мимо правила");
    return found;
  }

  const source = readFileSync(PAGE, "utf8");

  it("настоящая страница: нарушений 0", () => {
    expect(visibleWiringProblems(source)).toEqual([]);
  });

  it("подсадка: страница до 7.277 (<p>{item.description}</p>) ловится", () => {
    // Ровно та строка, что стояла в `main` до 7.277.
    const planted = source
      .replace(/\n\s*const visibleDescription = mediaVisibleDescription\(lang, item\);/, "")
      .replace(
        '{visibleDescription && <p className="mt-2 text-foreground/70">{visibleDescription}</p>}',
        '<p className="mt-2 text-foreground/70">{item.description}</p>',
      );
    expect(planted).not.toBe(source);
    expect(visibleWiringProblems(planted)).toEqual([
      "видимый абзац собран не через mediaVisibleDescription",
      "абзац под заголовком не найден",
      "страница печатает {item.description} мимо правила",
    ]);
  });

  it("подсадка: правило на месте, но абзац печатает другое — красный", () => {
    const planted = source.replace(
      '{visibleDescription && <p className="mt-2 text-foreground/70">{visibleDescription}</p>}',
      '{visibleDescription && <p className="mt-2 text-foreground/70">{item.description}</p>}',
    );
    expect(planted).not.toBe(source);
    expect(visibleWiringProblems(planted)).toEqual(["абзац под заголовком не найден", "страница печатает {item.description} мимо правила"]);
  });
});

/**
 * КАТАЛОГ `/ru/media` — АБЗАЦ В КАРТОЧКАХ (заход 7.278, решение владельца
 * 19.10.2026, вариант «а» раздела 7 после 7.277).
 *
 * Страница записи с 7.277 абзаца на `/ru` не печатает, а карточки каталога
 * (`MediaCatalog.tsx`) печатали `item.description` — испанский абзац под
 * русским названием, тот же класс, что каталог рассказов до 7.196. Правило
 * одно на оба места: страница каталога берёт абзац карточки у
 * `mediaVisibleDescription` (на `/ru` — `null`), карточка печатает его только
 * когда он есть. Подсадки — страница и карточка в том виде, что стояли в
 * `main` до 7.278, и правило на месте, а карточка печатает мимо него.
 */
describe("каталог медиа: абзац карточки только через mediaVisibleDescription (7.278)", () => {
  const CATALOG_PAGE = join(process.cwd(), "src", "app", "[lang]", "media", "page.tsx");
  const CARD = join(process.cwd(), "src", "components", "media", "MediaCatalog.tsx");

  function catalogWiringProblems(page: string, card: string): string[] {
    const found: string[] = [];
    const from = page.indexOf("export default");
    if (from < 0) return ["export default страницы каталога не найден"];
    const body = page.slice(from);
    if (!/\n\s*description: mediaVisibleDescription\(lang, item\),/.test(body))
      found.push("абзац карточки собран не через mediaVisibleDescription");
    if (/\n\s*description: item\.description,/.test(body)) found.push("страница каталога отдаёт карточке item.description мимо правила");
    if (!/\n\s*description: string \| null;/.test(card)) found.push("MediaSummary.description не допускает null");
    const printed = card.match(/\{item\.description\}/g) ?? [];
    const guarded = card.match(/\{item\.description && \(?\s*<p className="mt-2 line-clamp-2 text-sm text-foreground\/70">\{item\.description\}<\/p>/g) ?? [];
    if (guarded.length !== 1) found.push(`абзац карточки под условием найден ${guarded.length} раз, ждали 1`);
    if (printed.length !== guarded.length) found.push("карточка печатает {item.description} без условия");
    return found;
  }

  const page = readFileSync(CATALOG_PAGE, "utf8");
  const card = readFileSync(CARD, "utf8");

  it("настоящие страница и карточка: нарушений 0", () => {
    expect(catalogWiringProblems(page, card)).toEqual([]);
  });

  it("правило каталога: на /ru абзаца нет ни у одной записи, на /es — абзац записи", () => {
    expect(MEDIA_ROWS.length).toBeGreaterThanOrEqual(275);
    expect(MEDIA_ROWS.filter((item) => mediaVisibleDescription("ru", item) !== null)).toEqual([]);
    expect(MEDIA_ROWS.filter((item) => mediaVisibleDescription("es", item) !== item.description)).toEqual([]);
  });

  it("подсадка: страница и карточка до 7.278 ловятся", () => {
    // Ровно те строки, что стояли в `main` до 7.278.
    const oldPage = page.replace("description: mediaVisibleDescription(lang, item),", "description: item.description,");
    const oldCard = card
      .replace(/description: string \| null;/, "description: string;")
      .replace(
        /\{item\.description && \(?\s*<p className="mt-2 line-clamp-2 text-sm text-foreground\/70">\{item\.description\}<\/p>\s*\)?\}/,
        '<p className="mt-2 line-clamp-2 text-sm text-foreground/70">{item.description}</p>',
      );
    expect(oldPage).not.toBe(page);
    expect(oldCard).not.toBe(card);
    expect(catalogWiringProblems(oldPage, oldCard)).toEqual([
      "абзац карточки собран не через mediaVisibleDescription",
      "страница каталога отдаёт карточке item.description мимо правила",
      "MediaSummary.description не допускает null",
      "абзац карточки под условием найден 0 раз, ждали 1",
      "карточка печатает {item.description} без условия",
    ]);
  });

  it("подсадка: правило на месте, но карточка печатает абзац ещё раз мимо условия", () => {
    const planted = card.replace(
      /(<h2 className="mt-3 text-lg font-medium">\{item\.title\}<\/h2>)/,
      '$1\n                <span>{item.description}</span>',
    );
    expect(planted).not.toBe(card);
    expect(catalogWiringProblems(page, planted)).toEqual(["карточка печатает {item.description} без условия"]);
  });
});
