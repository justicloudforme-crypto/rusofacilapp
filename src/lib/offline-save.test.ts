import { describe, expect, it } from "vitest";
import {
  OFFLINE_INDEX_PATH,
  maxEntriesFor,
  parseIndex,
  savedKindOf,
  tidyTitle,
  trimIndex,
  withRow,
  withoutUrl,
  type SavedRow,
} from "./offline-save";

/**
 * ЗАХОД 7.230 (ОФЛАЙН-2б, строка 309). Учёт сохранённого ведёт страница,
 * а не `ExpirationPlugin` воркера: тот знает только о том, что положил
 * сам, и записи страницы не вычистил бы никогда. Значит потолок и срок
 * обязаны быть здесь — и проверены здесь.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function row(over: Partial<SavedRow> = {}): SavedRow {
  return {
    url: "https://rusofacilapp.com/ru/courses/a1/1",
    path: "/ru/courses/a1/1",
    kind: "lesson",
    title: "Урок 1",
    lang: "ru",
    savedAt: NOW,
    bytes: 240_068,
    ...over,
  };
}

describe("savedKindOf", () => {
  it("называет вид по адресу, и корень раздела — это раздел, а не материал", () => {
    expect(savedKindOf("/ru/courses/a1/1")).toBe("lesson");
    expect(savedKindOf("/es/stories/snegurochka")).toBe("story");
    expect(savedKindOf("/es/vocabulary")).toBe("vocabulary");
    expect(savedKindOf("/es/vocabulary/comida")).toBe("vocabulary");
    expect(savedKindOf("/es/courses")).toBe("section");
    expect(savedKindOf("/es/stories")).toBe("section");
  });

  it("игры, экзамены и кабинет без сети не сохраняются — решение владельца 7.227", () => {
    expect(savedKindOf("/es/word-games")).toBeNull();
    expect(savedKindOf("/ru/profile")).toBeNull();
    expect(savedKindOf("/es")).toBeNull();
  });
});

describe("trimIndex", () => {
  it("держит потолок содержания и выбрасывает САМОЕ СТАРОЕ, а не то, что попалось", () => {
    const rows = Array.from({ length: maxEntriesFor("lesson") + 5 }, (_, i) =>
      row({ url: `https://x/${i}`, path: `/ru/courses/a1/${i}`, savedAt: NOW - i * 1000 }),
    );
    const { keep, drop } = trimIndex(rows, NOW);
    expect(keep).toHaveLength(maxEntriesFor("lesson"));
    expect(drop).toHaveLength(5);
    // Выброшены пять самых старых — те, у кого `savedAt` меньше всех.
    const oldest = Array.from({ length: 5 }, (_, i) => `https://x/${maxEntriesFor("lesson") + i}`);
    expect(drop.map((r) => r.url).sort()).toEqual(oldest.sort());
  });

  it("разделы считаются ОТДЕЛЬНО: шесть каталогов не съедают месяц занятий", () => {
    const lessons = Array.from({ length: maxEntriesFor("lesson") }, (_, i) =>
      row({ url: `https://x/l${i}`, path: `/ru/courses/a1/${i}` }),
    );
    const sections = Array.from({ length: maxEntriesFor("section") }, (_, i) =>
      row({ url: `https://x/s${i}`, path: "/ru/courses", kind: "section", savedAt: NOW - i }),
    );
    const { keep } = trimIndex([...lessons, ...sections], NOW);
    expect(keep.filter((r) => r.kind === "lesson")).toHaveLength(maxEntriesFor("lesson"));
    expect(keep.filter((r) => r.kind === "section")).toHaveLength(maxEntriesFor("section"));
  });

  it("срок тридцать суток: положенное позавчера живо, положенное сорок дней назад — нет", () => {
    const fresh = row({ url: "https://x/fresh", savedAt: NOW - 2 * DAY });
    const stale = row({ url: "https://x/stale", savedAt: NOW - 40 * DAY });
    const { keep, drop } = trimIndex([fresh, stale], NOW);
    expect(keep.map((r) => r.url)).toEqual(["https://x/fresh"]);
    expect(drop.map((r) => r.url)).toEqual(["https://x/stale"]);
  });
});

describe("опись", () => {
  it("та же страница второй раз — одна строка, а не две", () => {
    const first = row({ savedAt: NOW - 1000 });
    const again = row({ savedAt: NOW, title: "Урок 1 — обновлён" });
    const rows = withRow(withRow([], first), again);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Урок 1 — обновлён");
  });

  it("стирание по адресу убирает ровно эту строку", () => {
    const rows = [row(), row({ url: "https://x/2", path: "/ru/courses/a1/2" })];
    expect(withoutUrl(rows, "https://x/2")).toHaveLength(1);
  });

  it("чужое и поломанное в описи не считается сохранённым", () => {
    expect(parseIndex(null)).toEqual([]);
    expect(parseIndex([{ url: 1 }, { url: "https://x", path: "/x", kind: "nope", savedAt: 1 }])).toEqual([]);
    expect(parseIndex([{ url: "https://x", path: "/ru/courses/a1/1", kind: "lesson", savedAt: 5 }])).toHaveLength(1);
  });

  it("адрес описи не совпадает ни с одной страницей сайта", () => {
    expect(savedKindOf(OFFLINE_INDEX_PATH)).toBeNull();
  });
});

describe("tidyTitle", () => {
  it("бренд из заголовка убирается, длинное обрезается", () => {
    expect(tidyTitle("Урок 1 — RusoFácilapp")).toBe("Урок 1");
    expect(tidyTitle("x".repeat(200)).length).toBe(88);
  });
});
