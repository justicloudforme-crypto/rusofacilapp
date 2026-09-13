import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * ДОЛГ 169, ШАГ 3. Главное свойство адреса предзагрузки — он НЕ ХОДИТ
 * НАРУЖУ НИКОГДА, и доказывается это числом вызовов `fetch`, а не
 * чтением кода: если бы пачка слов умела уходить в MyMemory, один
 * пролистанный рассказ расстрелял бы суточную квоту (≈916 тапов на весь
 * сайт) за полминуты.
 */
const flashcardFindMany = vi.fn();
const glossaryFindMany = vi.fn();
const idiomFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    flashcardCard: { findMany: (...args: unknown[]) => flashcardFindMany(...args) },
    glossaryTerm: { findMany: (...args: unknown[]) => glossaryFindMany(...args) },
    idiom: { findMany: (...args: unknown[]) => idiomFindMany(...args) },
  },
}));
vi.mock("server-only", () => ({}));

const { GET } = await import("./route");

function fakeRequest(words: string): NextRequest {
  return { nextUrl: new URL(`https://rusofacilapp.com/api/dictionary/bank?words=${encodeURIComponent(words)}`) } as NextRequest;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  flashcardFindMany.mockResolvedValue([]);
  glossaryFindMany.mockResolvedValue([]);
  idiomFindMany.mockResolvedValue([]);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/dictionary/bank — словарь видимого абзаца", () => {
  it("НИ ОДНОГО ЗАПРОСА НАРУЖУ, даже когда в банке нет ничего", async () => {
    const res = await GET(fakeRequest("абракадабра,бармаглот,шушара"));
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(res.status).toBe(200);
    expect(body.translations).toEqual({});
    expect(body.found).toBe(0);
  });

  it("отдаёт то, что нашлось, и молчит про то, чего нет", async () => {
    flashcardFindMany.mockResolvedValue([
      { russian: "Бабушка", translationEs: "abuela" },
      { russian: "дед", translationEs: "abuelo" },
    ]);

    const body = await (await GET(fakeRequest("бабушка,дед,бежала"))).json();

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(body.translations).toEqual({ бабушка: "abuela", дед: "abuelo" });
    expect(body.asked).toBe(3);
    expect(body.found).toBe(2);
  });

  it("пачка обрезается потолком — абзац, а не рассказ целиком", async () => {
    const words = Array.from({ length: 400 }, (_, i) => `слово${"а".repeat(i % 5)}${i}`).join(",");
    await GET(fakeRequest(words));
    const asked = flashcardFindMany.mock.calls[0]?.[0]?.where?.russian?.in ?? [];
    // По два написания на ключ (как есть и с заглавной), потолок 120 ключей.
    expect(asked.length).toBeLessThanOrEqual(240);
  });

  it("пустой список — 400, а не запрос в базу", async () => {
    const res = await GET(fakeRequest(" , , "));
    expect(res.status).toBe(400);
    expect(flashcardFindMany).toHaveBeenCalledTimes(0);
  });

  it("ответ кэшируется честно", async () => {
    const res = await GET(fakeRequest("дед"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=");
  });
});
