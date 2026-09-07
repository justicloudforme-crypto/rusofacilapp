import { describe, expect, it } from "vitest";
import es from "../../dictionaries/es.json";
import ru from "../../dictionaries/ru.json";
import { buildSearchRecords, type SearchSources } from "./records";
import { SEARCH_SECTIONS, type SearchSection } from "./types";
import { hrefFor } from "./match";
import { cardAnchor, idiomAnchor } from "@/lib/deep-link-anchors";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * Сборка индекса из выдуманных источников: правила, а не полнота.
 *
 * Полноту — «каждый раздел находится по живому объекту» — проверяет
 * `check:search-coverage` на настоящей базе; сюда база не ходит
 * (`check:no-db-in-tests`).
 */

const SOURCES: SearchSources = {
  dictionaries: { es: es as unknown as Dictionary, ru: ru as unknown as Dictionary },
  exams: [{ level: "a1", slug: "a1-exam-1", title: "Examen A1 · Lecciones 1 a 10" }],
  stories: [
    { id: "s1", title: "Три медведя", level: "A1", isPremium: false, premiumOnly: false },
    { id: "s2", title: "Тихий Дон", level: "C1", isPremium: true, premiumOnly: false },
    { id: "s3", title: "Платный рассказ", level: "B2", isPremium: true, premiumOnly: true },
  ],
  media: [
    { id: "song-katyusha", title: "Катюша", level: "A2", free: true },
    { id: "movie-x", title: "Фильм", level: "B1" },
  ],
  flashcards: [
    { id: "f1", russian: "хлеб", translationEs: "pan", transcription: "jlep", category: "food", level: "A1" },
    { id: "f2", russian: "мироздание", translationEs: "cosmos", transcription: "mirozdanie", category: "food", level: "C1" },
  ],
  idioms: [
    { id: "i1", phrase: "На воре и шапка горит", spanishEquivalent: "El que se pica, ajos come", level: "B2", category: "proverbs" },
    { id: "i2", phrase: "Лишний человек", spanishEquivalent: "El hombre superfluo", level: "B2", category: "literary" },
  ],
  glossary: [{ slug: "sustantivo", term: "sustantivo", russianEquivalent: "существительное" }],
  puzzles: [
    { type: "WORD_SEARCH", level: "A1", sequence: 1, topic: "comida", wordCount: 8, premiumOnly: false, curved: false },
    { type: "CROSSWORD", level: "C1", sequence: 40, topic: null, wordCount: 20, premiumOnly: true, curved: true },
  ],
};

const RECORDS = buildSearchRecords(SOURCES);
const bySection = (section: SearchSection) => RECORDS.filter((r) => r.section === section);

describe("индекс покрывает каждый раздел", () => {
  it("ни один раздел не пуст", () => {
    for (const section of SEARCH_SECTIONS) {
      expect(bySection(section).length, `раздел ${section} пуст`).toBeGreaterThan(0);
    }
  });

  it("у каждой записи есть название и путь", () => {
    for (const record of RECORDS) {
      expect(record.title.trim(), `${record.section}/${record.id} без названия`).not.toBe("");
      expect(record.path.startsWith("/") || record.path === "", `${record.section}/${record.id}: путь «${record.path}»`).toBe(true);
      expect(record.path.startsWith("/es/") || record.path.startsWith("/ru/"), `${record.section}/${record.id}: путь уже с локалью`).toBe(false);
    }
  });

  it("идентификаторы внутри раздела не повторяются", () => {
    for (const section of SEARCH_SECTIONS) {
      const ids = bySection(section).map((r) => r.id);
      expect(new Set(ids).size, `раздел ${section}: повторяющиеся id`).toBe(ids.length);
    }
  });
});

describe("правило платности повторяет entitlement.ts, а не пересказывает его", () => {
  it("рассказы: бесплатный, C1 и premiumOnly", () => {
    const map = new Map(bySection("story").map((r) => [r.id, r.requires]));
    expect(map.get("s1")).toBe(null);
    expect(map.get("s2")).toBe("premium");
    expect(map.get("s3")).toBe("premium");
  });

  it("медиа: бесплатный образец открыт, остальное — по подписке", () => {
    const map = new Map(bySection("media").map((r) => [r.id, r.requires]));
    expect(map.get("song-katyusha")).toBe(null);
    expect(map.get("movie-x")).toBe("free");
  });

  it("карточки: C1 — Premium, остальное открыто", () => {
    const map = new Map(bySection("flashcard").map((r) => [r.id, r.requires]));
    expect(map.get("f1")).toBe(null);
    expect(map.get("f2")).toBe("premium");
  });

  it("первый урок уровня открыт, второй — нет", () => {
    const map = new Map(bySection("lesson").map((r) => [r.id, r.requires]));
    expect(map.get("a1-1")).toBe(null);
    expect(map.get("a1-2")).toBe("free");
  });

  it("игры: ★ и premiumOnly — Premium", () => {
    const map = new Map(bySection("game").map((r) => [r.id, r.requires]));
    expect(map.get("WORD_SEARCH/A1/1")).toBe(null);
    expect(map.get("CROSSWORD/C1/40")).toBe("premium");
  });
});

describe("текста в индексе нет", () => {
  it("ни одна запись не несёт содержимого платного объекта", () => {
    // Выдача с цитатой из платного рассказа была бы раздачей платного
    // содержания в окне поиска. Проверяем не намерение, а длину: название
    // объекта — это строка, а не абзац.
    for (const record of RECORDS) {
      const all = [record.title, record.titleRu, record.subtitle, record.subtitleRu, ...(record.terms ?? [])].filter(Boolean) as string[];
      for (const value of all) {
        expect(value.length, `${record.section}/${record.id}: строка длиной ${value.length}`).toBeLessThan(200);
      }
    }
  });
});

describe("карточка словаря ведёт туда, где она напечатана", () => {
  it("A1 — на СВОЮ строку страницы своей темы по-испански, в словарь по-русски", () => {
    const card = bySection("flashcard").find((r) => r.id === "f1")!;
    expect(card.path).toBe("/vocabulary/comida#card-f1");
    // На /ru тематических страниц нет вовсе (`if (lang !== "es")
    // notFound()`), поэтому цеплять якорь не к чему — и вписывать его
    // туда значило бы обещать доводку, которой в русской локали не
    // существует.
    expect(card.pathRu).toBe("/vocabulary");
  });

  it("C1 — в словарь БЕЗ якоря: на тематической странице этой карточки физически нет", () => {
    const card = bySection("flashcard").find((r) => r.id === "f2")!;
    expect(card.path).toBe("/vocabulary");
    expect(card.path).not.toContain("#");
  });

  it("якорь собран той же функцией, что печатает `id` на странице", () => {
    const card = bySection("flashcard").find((r) => r.id === "f1")!;
    expect(card.path.endsWith(`#${cardAnchor("f1")}`)).toBe(true);
  });

  it("ссылка выдачи несёт якорь целиком", () => {
    const card = bySection("flashcard").find((r) => r.id === "f1")!;
    expect(hrefFor(card, "es")).toBe("/es/vocabulary/comida#card-f1");
    expect(hrefFor(card, "ru")).toBe("/ru/vocabulary");
  });
});

describe("идиома ведёт на саму фразу, а не на вкладку", () => {
  it("путь — существующая вкладка плюс якорь, без нового маршрута", () => {
    const idiom = bySection("idiom").find((r) => r.id === "i1")!;
    expect(idiom.path).toBe(`/vocabulary?mode=idioms#${idiomAnchor("i1")}`);
    // Ни одного нового маршрута: всё, что стоит до «?», — адрес, который
    // существовал и до правки.
    expect(idiom.path.split("?")[0]).toBe("/vocabulary");
  });

  it("работает в обеих локалях: вкладка идиом есть и на /ru", () => {
    const idiom = bySection("idiom").find((r) => r.id === "i1")!;
    expect(hrefFor(idiom, "es")).toBe("/es/vocabulary?mode=idioms#idiom-i1");
    expect(hrefFor(idiom, "ru")).toBe("/ru/vocabulary?mode=idioms#idiom-i1");
  });

  it("пометка платного повторяет гейт /api/idioms, а не уровень", () => {
    const map = new Map(bySection("idiom").map((r) => [r.id, r.requires]));
    // Неоплатившему страница отдаёт 5 фраз из 771 — значит закрыта
    // практически любая, хотя уровень у них не C1.
    expect(map.get("i1")).toBe("free");
    // `literary` режется отдельно и у подписчика `standard` тоже.
    expect(map.get("i2")).toBe("premium");
  });
});

describe("глубокие ссылки не заводят ни одного нового адреса", () => {
  it("якорь стоит только у карточек и идиом и всегда после существующего пути", () => {
    for (const record of RECORDS) {
      for (const path of [record.path, record.pathRu ?? ""]) {
        if (!path.includes("#")) continue;
        expect(["flashcard", "idiom"]).toContain(record.section);
        const [base] = path.split("#");
        expect(base.split("?")[0], `${record.section}/${record.id}`).toMatch(
          /^\/vocabulary(\/[a-z0-9-]+)?$/,
        );
      }
    }
  });

  it("контроль: у разделов со своим адресом якоря нет ни одного", () => {
    for (const section of ["story", "media", "lesson", "glossary", "game", "page"] as const) {
      for (const record of bySection(section)) {
        expect(record.path.includes("#"), `${section}/${record.id}`).toBe(false);
      }
    }
  });
});

describe("страницы только для /es помечены", () => {
  it("гиды, лендинги, темы словаря и алфавит", () => {
    for (const section of ["grammar", "vocabularyTopic", "alphabet"] as const) {
      for (const record of bySection(section)) {
        expect(record.esOnly, `${section}/${record.id} должен быть esOnly`).toBe(true);
      }
    }
    const landings = bySection("page").filter((r) => r.id.startsWith("landing-"));
    expect(landings.length).toBe(10);
    for (const landing of landings) expect(landing.esOnly).toBe(true);
  });

  it("контроль: общие страницы esOnly НЕ помечены", () => {
    expect(bySection("page").find((r) => r.id === "pricing")?.esOnly).toBeUndefined();
  });
});
