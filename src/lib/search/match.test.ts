import { describe, expect, it } from "vitest";
import { searchRecords } from "./match";
import { PER_SECTION_LIMIT, SEARCH_SECTIONS, type SearchRecord } from "./types";

/**
 * Правила выдачи — на выдуманном индексе из нескольких строк.
 *
 * Здесь проверяются ПРАВИЛА (свёртка игр, пометка платного, «показано N
 * из M», ранжирование), а полнота — то, что каждый раздел сайта вообще
 * находится по живому объекту, — сторожем `check:search-coverage`,
 * который читает настоящую базу. Разделять пришлось потому, что юнит-тесты
 * этого проекта не имеют права открывать соединение (`check:no-db-in-tests`).
 */

const OPTIONS = { lang: "es" as const, tier: "free" as const, collapsedHrefs: { game: "/es/word-games" } };

function games(count: number): SearchRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    section: "game" as const,
    id: `WORD_SEARCH/A1/${i + 1}`,
    path: `/word-games/WORD_SEARCH/A1/${i + 1}`,
    title: `Sopa de letras en ruso, nivel A1 nº ${i + 1} (10 palabras)`,
  }));
}

const INDEX: SearchRecord[] = [
  { section: "page", id: "stories", path: "/stories", title: "Cuentos", titleRu: "Рассказы", terms: ["/stories"] },
  { section: "page", id: "pricing", path: "/pricing", title: "Precios", titleRu: "Цены", terms: ["Planes y precios"] },
  { section: "story", id: "s1", path: "/stories/s1", title: "Три медведя", subtitle: "A1", requires: "free" },
  { section: "story", id: "s2", path: "/stories/s2", title: "Тихий Дон", subtitle: "C1", requires: "premium" },
  { section: "grammar", id: "/gramatica", path: "/gramatica", esOnly: true, title: "Gramática rusa explicada en español" },
  { section: "flashcard", id: "c1", path: "/vocabulary/comida", pathRu: "/vocabulary", title: "хлеб — pan", subtitle: "A1" },
  ...games(30),
];

describe("свёртка игрового раздела", () => {
  it("3277 шаблонных названий не заливают выдачу: строка раздела одна", () => {
    const res = searchRecords(INDEX, "sopa de letras", OPTIONS);
    const gameSections = res.sections.filter((s) => s.section === "game");
    expect(gameSections).toHaveLength(1);
    expect(gameSections[0].collapsed).toBe(true);
    expect(gameSections[0].hits).toHaveLength(0);
    expect(gameSections[0].total).toBe(30);
    expect(gameSections[0].collapsedHref).toBe("/es/word-games");
  });

  it("контроль: без свёртки тех же строк было бы больше одной", () => {
    // Без этого случая предыдущий доказывал бы только то, что игр в
    // индексе нет вовсе.
    const asStories = INDEX.map((r) => (r.section === "game" ? { ...r, section: "story" as const } : r));
    const res = searchRecords(asStories, "sopa de letras", OPTIONS);
    const stories = res.sections.find((s) => s.section === "story");
    expect(stories?.collapsed).toBe(false);
    expect(stories!.hits.length).toBeGreaterThan(1);
  });
});

describe("платное не раздаётся, но и не прячется", () => {
  it("закрытый объект в выдаче есть, с пометкой и с тем же адресом", () => {
    const res = searchRecords(INDEX, "Тихий Дон", OPTIONS);
    const hit = res.sections.find((s) => s.section === "story")!.hits[0];
    expect(hit.href).toBe("/es/stories/s2");
    expect(hit.locked).toBe(true);
    expect(hit.lockReason).toBe("premium");
  });

  it("состав выдачи от уровня доступа не зависит — меняется только пометка", () => {
    const free = searchRecords(INDEX, "Тихий Дон", OPTIONS);
    const premium = searchRecords(INDEX, "Тихий Дон", { ...OPTIONS, tier: "premium" });
    expect(premium.total).toBe(free.total);
    expect(premium.sections[0].hits[0].locked).toBe(false);
    // …а у подписчика без Premium — по-прежнему закрыт.
    const standard = searchRecords(INDEX, "Тихий Дон", { ...OPTIONS, tier: "standard" });
    expect(standard.sections[0].hits[0].lockReason).toBe("premium");
    // Рассказ, которому хватает любой подписки, у него открыт.
    const bear = searchRecords(INDEX, "Три медведя", { ...OPTIONS, tier: "standard" });
    expect(bear.sections[0].hits[0].locked).toBe(false);
  });

  it("в строке выдачи нет ничего, кроме названия, раздела и адреса", () => {
    const res = searchRecords(INDEX, "Тихий Дон", OPTIONS);
    const hit = res.sections[0].hits[0];
    expect(Object.keys(hit).sort()).toEqual(["href", "id", "lockReason", "locked", "section", "subtitle", "title"]);
  });
});

describe("«показано N из M»", () => {
  it("раздел печатает не больше своего потолка и называет остаток числом", () => {
    const many: SearchRecord[] = Array.from({ length: 12 }, (_, i) => ({
      section: "story" as const,
      id: `x${i}`,
      path: `/stories/x${i}`,
      title: `Сказка номер ${i}`,
    }));
    const res = searchRecords(many, "Сказка", OPTIONS);
    const stories = res.sections.find((s) => s.section === "story")!;
    expect(stories.hits).toHaveLength(PER_SECTION_LIMIT);
    expect(stories.total).toBe(12);
    expect(res.shown).toBe(PER_SECTION_LIMIT);
    expect(res.total).toBe(12);
  });
});

describe("локали ищут по своему содержимому", () => {
  it("подпись меню находится только в своей локали", () => {
    expect(searchRecords(INDEX, "Cuentos", { ...OPTIONS, lang: "ru" }).total).toBe(0);
    expect(searchRecords(INDEX, "Рассказы", { ...OPTIONS, lang: "ru" }).total).toBe(1);
    expect(searchRecords(INDEX, "Рассказы", OPTIONS).total).toBe(0);
  });

  it("страница, которой на /ru нет, в русскую выдачу не попадает", () => {
    expect(searchRecords(INDEX, "Gramática", OPTIONS).total).toBe(1);
    expect(searchRecords(INDEX, "Gramática", { ...OPTIONS, lang: "ru" }).total).toBe(0);
  });

  it("карточка на /ru ведёт в словарь, а на /es — на страницу своей темы", () => {
    expect(searchRecords(INDEX, "хлеб", OPTIONS).sections[0].hits[0].href).toBe("/es/vocabulary/comida");
    expect(searchRecords(INDEX, "хлеб", { ...OPTIONS, lang: "ru" }).sections[0].hits[0].href).toBe("/ru/vocabulary");
  });
});

describe("нестрогая ступень", () => {
  it("включается только когда строгая не нашла ничего", () => {
    const typo = searchRecords(INDEX, "Cuenots", OPTIONS);
    expect(typo.fuzzy).toBe(true);
    expect(typo.sections[0].hits[0].title).toBe("Cuentos");

    const exact = searchRecords(INDEX, "Cuentos", OPTIONS);
    expect(exact.fuzzy).toBe(false);
  });

  it("падеж и диакритика — тоже находятся", () => {
    expect(searchRecords(INDEX, "Рассказов", { ...OPTIONS, lang: "ru" }).total).toBe(1);
    expect(searchRecords(INDEX, "Précios", OPTIONS).total).toBeGreaterThan(0);
  });

  it("контроль: несуществующая строка даёт пустую выдачу", () => {
    const res = searchRecords(INDEX, "zzqqxwv-нет-такого", OPTIONS);
    expect(res.total).toBe(0);
    expect(res.shown).toBe(0);
    expect(res.sections).toEqual([]);
    expect(res.fuzzy).toBe(false);
  });

  it("контроль: пустой запрос — не «найдено всё»", () => {
    expect(searchRecords(INDEX, "   ", OPTIONS).total).toBe(0);
  });

  it("строка из одних знаков препинания — не «найдено всё»", () => {
    // Замер на живом проде 06.09.2026 (PROGRESS.md 7.129): `***`
    // возвращала ВЕСЬ индекс — 10 720 записей и `fuzzy: true`. Ни одна
    // из этих строк не содержит ни одного слова, сравнивать не с чем.
    for (const query of ["***", "...", "?", "«»", "—", "!!!", "/"]) {
      const res = searchRecords(INDEX, query, OPTIONS);
      expect(res.total, `«${query}» вернула ${res.total} записей`).toBeLessThan(INDEX.length);
      expect(res.fuzzy, `«${query}» ушла в нестрогую ступень`).toBe(false);
    }
  });

  it("позитивный контроль: подстрочное совпадение по тому же знаку осталось", () => {
    // Половина, которую правка НЕ должна была унести: у карточек словаря
    // название построено как «слово — traducción», и подстрока «—»
    // обязана их находить строго, а не через нестрогую ступень.
    const records: SearchRecord[] = [
      { section: "flashcard", id: "a", path: "/vocabulary", title: "хлеб — pan" },
      { section: "story", id: "b", path: "/stories/b", title: "Репка" },
    ];
    const res = searchRecords(records, "—", OPTIONS);
    expect(res.total).toBe(1);
    expect(res.fuzzy).toBe(false);
    expect(res.sections[0].hits[0].id).toBe("a");
  });
});

describe("ранжирование", () => {
  it("точное совпадение выше подстроки", () => {
    const records: SearchRecord[] = [
      { section: "story", id: "long", path: "/stories/long", title: "Сказка про репку и всё остальное" },
      { section: "story", id: "exact", path: "/stories/exact", title: "Репка" },
    ];
    const res = searchRecords(records, "Репка", OPTIONS);
    expect(res.sections[0].hits[0].id).toBe("exact");
  });
});

describe("список разделов", () => {
  it("двенадцать, и все с подписью в обеих локалях", async () => {
    // Список разделов — то, за что отвечает сторож охвата; если сюда
    // добавят тринадцатый, а подписи не заведут, окно поиска напечатает
    // `undefined`.
    const es = (await import("../../dictionaries/es.json")).default as { search: { sections: Record<string, string> } };
    const ru = (await import("../../dictionaries/ru.json")).default as { search: { sections: Record<string, string> } };
    expect(SEARCH_SECTIONS).toHaveLength(12);
    for (const section of SEARCH_SECTIONS) {
      expect(es.search.sections[section], `нет испанской подписи раздела ${section}`).toBeTruthy();
      expect(ru.search.sections[section], `нет русской подписи раздела ${section}`).toBeTruthy();
    }
  });
});
