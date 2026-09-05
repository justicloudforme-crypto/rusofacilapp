import { describe, expect, it } from "vitest";
import { lastModifiedField, latestLastModified, rowLastModified } from "./sitemap-lastmod";

const at = (iso: string) => new Date(iso);

describe("rowLastModified", () => {
  it("берёт updatedAt, когда он есть", () => {
    expect(rowLastModified({ updatedAt: at("2026-09-02T10:00:00Z"), createdAt: at("2026-08-20T00:00:00Z") }))
      .toEqual(at("2026-09-02T10:00:00Z"));
  });

  it("падает на createdAt, когда updatedAt пуст — это девять строк банка", () => {
    expect(rowLastModified({ updatedAt: null, createdAt: at("2026-08-20T22:52:01Z") }))
      .toEqual(at("2026-08-20T22:52:01Z"));
  });

  it("молчит, когда нет ни одной даты", () => {
    expect(rowLastModified({})).toBeUndefined();
    expect(rowLastModified({ updatedAt: null, createdAt: null })).toBeUndefined();
  });

  // Позитивный контроль подстановки: она обязана быть НЕ новее правды.
  // Слишком старая дата ничего не обещает, слишком новая — обещает
  // свежесть, которой нет, и обесценивает lastmod всей карты.
  it("подстановка не может оказаться новее настоящей правки", () => {
    const row = { updatedAt: at("2026-09-02T10:00:00Z"), createdAt: at("2026-08-20T00:00:00Z") };
    const fallbackOnly = { updatedAt: null, createdAt: row.createdAt };
    expect(rowLastModified(fallbackOnly)!.getTime()).toBeLessThan(rowLastModified(row)!.getTime());
  });
});

describe("latestLastModified", () => {
  it("берёт самую позднюю из смеси updatedAt и createdAt", () => {
    expect(
      latestLastModified([
        { updatedAt: at("2026-08-29T00:00:00Z") },
        { updatedAt: null, createdAt: at("2026-09-03T00:00:00Z") },
        { updatedAt: at("2026-09-01T00:00:00Z") },
      ]),
    ).toEqual(at("2026-09-03T00:00:00Z"));
  });

  it("пустой список и список без дат дают молчание, а не «сегодня»", () => {
    expect(latestLastModified([])).toBeUndefined();
    expect(latestLastModified([{}, { updatedAt: null, createdAt: null }])).toBeUndefined();
  });

  // Позитивный контроль: если бы функция подставляла текущее время,
  // этот тест бы её поймал — она обязана вернуть undefined, а не
  // что-либо близкое к now().
  it("не подставляет текущее время", () => {
    const before = Date.now();
    const result = latestLastModified([{}]);
    expect(result).toBeUndefined();
    expect(Date.now() - before).toBeGreaterThanOrEqual(0);
  });
});

describe("lastModifiedField", () => {
  it("пишет поле при настоящей дате", () => {
    const d = at("2026-09-04T21:03:17.832Z");
    expect(lastModifiedField(d)).toEqual({ lastModified: d });
  });

  it("не пишет ничего при отсутствии даты — ключа в объекте нет вовсе", () => {
    const field = lastModifiedField(undefined);
    expect(Object.keys(field)).toEqual([]);
    expect("lastModified" in field).toBe(false);
  });
});
