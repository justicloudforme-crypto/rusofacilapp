import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_LOG_FIELDS,
  MAX_LOGGED_QUERY_LENGTH,
  hourBucket,
  parseSearchDemandBody,
  summarizeSearchDemand,
} from "./demand";

/**
 * Журнал спроса на поиск — таблица, у которой главное свойство
 * ОТРИЦАТЕЛЬНОЕ: по её строке нельзя узнать человека. Отрицательное
 * свойство нельзя проверить, посмотрев на код один раз, — его надо
 * закрепить, иначе следующая правка «а давайте ещё запишем, куда он
 * ушёл» пройдёт незамеченной.
 */

const NOW = new Date("2026-09-06T14:37:52.431Z");

describe("что журнал соглашается записать", () => {
  it("берёт ровно четыре поля и добавляет час — и ничего больше", () => {
    const parsed = parseSearchDemandBody(
      { query: "  Cuentos  ", resultCount: 3, lang: "es", followed: true },
      NOW,
    );
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(Object.keys(parsed.value).sort()).toEqual(
      ["followed", "hourBucket", "lang", "query", "resultCount"].sort(),
    );
    expect(parsed.value.query).toBe("Cuentos");
  });

  it("выбрасывает всё опознающее, что бы ни прислали", () => {
    // Это и есть проверка обещания «ничего опознающего человека не
    // хранить»: тело может нести что угодно, в запись попадает белый
    // список из пяти полей.
    const hostile: Record<string, unknown> = {
      query: "хлеб",
      resultCount: 1,
      lang: "ru",
      followed: false,
    };
    for (const field of FORBIDDEN_LOG_FIELDS) hostile[field] = "нечто-опознающее";
    const parsed = parseSearchDemandBody(hostile, NOW);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    const serialized = JSON.stringify(parsed.value);
    for (const field of FORBIDDEN_LOG_FIELDS) {
      expect(serialized, `поле ${field} просочилось в запись`).not.toContain(field);
    }
    expect(serialized).not.toContain("нечто-опознающее");
  });

  it("точное время не сохраняется: остаётся только час", () => {
    const parsed = parseSearchDemandBody({ query: "x", resultCount: 0, lang: "es", followed: false }, NOW);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.value.hourBucket.toISOString()).toBe("2026-09-06T14:00:00.000Z");
  });

  it("контроль: две записи в разные миллисекунды одного часа неразличимы по времени", () => {
    // Без этого случая предыдущий доказывал бы только формат строки, а не
    // то, ради чего округление заведено, — что последовательность
    // запросов одного человека не собирается обратно по меткам.
    const a = hourBucket(new Date("2026-09-06T14:00:00.001Z"));
    const b = hourBucket(new Date("2026-09-06T14:59:59.999Z"));
    expect(a.getTime()).toBe(b.getTime());
    // И контроль в другую сторону: разные часы обязаны различаться.
    expect(hourBucket(new Date("2026-09-06T15:00:00.000Z")).getTime()).not.toBe(a.getTime());
  });

  it("длинная строка обрезается, а не отвергается", () => {
    const long = "а".repeat(500);
    const parsed = parseSearchDemandBody({ query: long, resultCount: 0, lang: "ru", followed: false }, NOW);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.value.query.length).toBe(MAX_LOGGED_QUERY_LENGTH);
  });

  it("отказывает пустой строке, чужой локали и подделанному числу", () => {
    const cases: Array<[unknown, string]> = [
      [{ query: "   ", resultCount: 0, lang: "es", followed: false }, "empty_query"],
      [{ query: "x", resultCount: 0, lang: "de", followed: false }, "invalid_lang"],
      [{ query: "x", resultCount: -1, lang: "es", followed: false }, "invalid_result_count"],
      [{ query: "x", resultCount: 1.5, lang: "es", followed: false }, "invalid_result_count"],
      [{ query: "x", resultCount: 10_000_000, lang: "es", followed: false }, "invalid_result_count"],
      [{ query: "x", resultCount: 0, lang: "es" }, "invalid_followed"],
      [{ resultCount: 0, lang: "es", followed: false }, "invalid_query"],
      [null, "invalid_body"],
    ];
    for (const [body, error] of cases) {
      const parsed = parseSearchDemandBody(body, NOW);
      expect(parsed.valid, `${JSON.stringify(body)} должно быть отвергнуто`).toBe(false);
      if (!parsed.valid) expect(parsed.error).toBe(error);
    }
  });
});

describe("сводка накопленного", () => {
  const rows = [
    { query: "Cuentos", resultCount: 3, lang: "es", followed: true },
    { query: "cuentos ", resultCount: 3, lang: "es", followed: false },
    { query: "Рассказов", resultCount: 0, lang: "ru", followed: false },
    { query: "zzqq", resultCount: 0, lang: "es", followed: false },
  ];

  it("считает то, что обещает", () => {
    const s = summarizeSearchDemand(rows);
    expect(s.total).toBe(4);
    expect(s.distinctQueries).toBe(3);
    expect(s.zeroResult).toBe(2);
    expect(s.followed).toBe(1);
    expect(s.byLang).toEqual([
      { lang: "es", total: 3 },
      { lang: "ru", total: 1 },
    ]);
    expect(s.topQueries[0]).toEqual({ query: "cuentos", total: 2, zeroResult: 0, followed: 1 });
    expect([...s.topZeroResultQueries.map((q) => q.query)].sort()).toEqual(["zzqq", "рассказов"]);
  });

  it("не склеивает опечатку с правильной строкой", () => {
    // Ради этого группировка идёт по строке как есть (с точностью до
    // регистра), а не по поисковой свёртке: если «Cuenots» сольётся с
    // «Cuentos», из отчёта исчезнет ровно то, ради чего нормализация в
    // поиске и заводилась.
    const s = summarizeSearchDemand([
      { query: "Cuentos", resultCount: 3, lang: "es", followed: false },
      { query: "Cuenots", resultCount: 3, lang: "es", followed: false },
    ]);
    expect(s.distinctQueries).toBe(2);
  });

  it("контроль: пустой вход даёт нули, а не выдуманные строки", () => {
    const s = summarizeSearchDemand([]);
    expect(s.total).toBe(0);
    expect(s.distinctQueries).toBe(0);
    expect(s.topQueries).toEqual([]);
    expect(s.topZeroResultQueries).toEqual([]);
    expect(s.byLang).toEqual([]);
  });
});
