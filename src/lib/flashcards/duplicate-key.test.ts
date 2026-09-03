import { describe, expect, it } from "vitest";

import {
  KNOWN_HOMONYM_ID_PAIRS,
  KNOWN_YO_PAIRS,
  exactCollisions,
  normalizeRussianKey,
  yoCollisions,
} from "./duplicate-key";

type Row = { id: string; russian: string };

const rows = (...pairs: [string, string][]): Row[] =>
  pairs.map(([id, russian]) => ({ id, russian }));

const collide = (items: Row[]) =>
  exactCollisions(items, (r) => r.russian, (r) => r.id);

describe("normalizeRussianKey", () => {
  it("сводит регистр, края и «ё» к одному ключу", () => {
    expect(normalizeRussianKey("  Свёкровь ")).toBe("свекровь");
  });
});

describe("exactCollisions — исключение по паре id, а не по слову", () => {
  it("узаконенная пара «карта» пропущена", () => {
    expect(collide(rows(["shop-card", "карта"], ["city-map", "карта"]))).toEqual([]);
  });

  it("третья строка «карта» ломает совпадение множества и ловится", () => {
    const found = collide(
      rows(["shop-card", "карта"], ["city-map", "карта"], ["cmt-new", "карта"]),
    );
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe("карта");
    expect(found[0].count).toBe(3);
    expect(found[0].ids).toContain("cmt-new");
  });

  it("два новых id с узаконенным словом ловятся — слово ничего не разрешает", () => {
    expect(collide(rows(["new-a", "карта"], ["new-b", "карта"]))).toHaveLength(1);
  });

  it("один узаконенный id плюс один чужой ловится", () => {
    expect(collide(rows(["shop-card", "карта"], ["new-b", "карта"]))).toHaveLength(1);
  });

  it("слово вне списка ловится как раньше", () => {
    expect(collide(rows(["x1", "стол"], ["x2", "Стол "])).map((c) => c.key)).toEqual(["стол"]);
  });

  it("одиночные записи не ловятся", () => {
    expect(collide(rows(["x1", "стол"], ["x2", "стул"]))).toEqual([]);
  });

  it("все десять узаконенных пар молчат, если лежат ровно парами", () => {
    const bank = KNOWN_HOMONYM_ID_PAIRS.flatMap((p) =>
      p.ids.map((id) => ({ id, russian: p.word })),
    );
    expect(collide(bank)).toEqual([]);
    expect(bank).toHaveLength(20);
  });

  it("«ё» exactCollisions НЕ нормализует — это работа yoCollisions", () => {
    expect(collide(rows(["a", "свекровь"], ["b", "свёкровь"]))).toEqual([]);
    expect(yoCollisions(rows(["a", "свекровь"], ["b", "свёкровь"]), (r) => r.russian)).toHaveLength(1);
  });
});

describe("списки исключений закрыты и коротки", () => {
  it("пары «ё» перечислены поимённо", () => {
    expect(KNOWN_YO_PAIRS.length).toBeGreaterThan(0);
    expect(KNOWN_YO_PAIRS.length).toBeLessThan(20);
  });

  it("каждая узаконенная пара омонимов — ровно два разных id и есть обоснование", () => {
    expect(KNOWN_HOMONYM_ID_PAIRS).toHaveLength(10);
    for (const pair of KNOWN_HOMONYM_ID_PAIRS) {
      expect(new Set(pair.ids).size).toBe(2);
      expect(pair.why.length).toBeGreaterThan(10);
    }
  });
});
