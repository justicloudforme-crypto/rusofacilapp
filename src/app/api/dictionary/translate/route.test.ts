import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * ДВА РАЗНЫХ СЛУЧАЯ, и каждый доказывается ЧИСЛОМ ЗАПРОСОВ НАРУЖУ, а не
 * формой ответа (долг 169, заход 7.188):
 *
 *   • слово ИЗ банка обязано отвечать без единого запроса наружу
 *     (`fetch` не зван ни разу);
 *   • слова НЕ из банка обязано уходить наружу (`fetch` зван ровно раз).
 *
 * И третий, долг 168: отказ чужого сервиса приходит с HTTP 200 и строкой,
 * похожей на перевод, — ученик не имеет права увидеть эту строку.
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

function fakeRequest(word: string): NextRequest {
  return { nextUrl: new URL(`https://rusofacilapp.com/api/dictionary/translate?word=${encodeURIComponent(word)}`) } as NextRequest;
}

/** Ответ MyMemory, пойманный на настоящем обработчике 13.09.2026. */
const QUOTA_REFUSAL_BODY = {
  responseData: {
    translatedText:
      "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 09 HOURS 12 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",
  },
  quotaFinished: true,
  responseStatus: 403,
  matches: [],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  flashcardFindMany.mockResolvedValue([]);
  glossaryFindMany.mockResolvedValue([]);
  idiomFindMany.mockResolvedValue([]);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/dictionary/translate — свой банк перед чужим сервисом (долг 169)", () => {
  it("СЛОВО ИЗ БАНКА: наружу НЕ УХОДИТ НИ ОДНОГО ЗАПРОСА", async () => {
    flashcardFindMany.mockResolvedValue([{ russian: "Бабушка", translationEs: "abuela" }]);

    const res = await GET(fakeRequest("бабушка"));
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(res.status).toBe(200);
    expect(body.translation).toBe("abuela");
    expect(body.source).toBe("flashcard");
  });

  it("слово из банка отвечается и когда в тексте оно с ударением и с заглавной", async () => {
    flashcardFindMany.mockResolvedValue([{ russian: "бабушка", translationEs: "abuela" }]);
    const res = await GET(fakeRequest("Ба́бушка"));
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect((await res.json()).translation).toBe("abuela");
  });

  it("СЛОВО НЕ ИЗ БАНКА: наружу уходит ровно ОДИН запрос, и это MyMemory", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ responseStatus: 200, matches: [{ translation: "corría", match: 1 }] }),
    });

    const res = await GET(fakeRequest("бежала"));
    const body = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.mymemory.translated.net");
    expect(body.translation).toBe("corría");
    expect(body.source).toBe("mymemory");
  });

  it("успешный ответ несёт честный Cache-Control, а не max-age=0", async () => {
    flashcardFindMany.mockResolvedValue([{ russian: "бабушка", translationEs: "abuela" }]);
    const res = await GET(fakeRequest("бабушка"));
    const header = res.headers.get("Cache-Control") ?? "";
    expect(header).toContain("public");
    expect(header).toContain("max-age=86400");
    expect(header).toContain("s-maxage=");
    expect(header).not.toContain("max-age=0");
    expect(header).not.toContain("must-revalidate");
  });

  it("многословная карточка НЕ отвечает за отдельное слово", async () => {
    // «образ мышления» в банк ключом не попадает вовсе, поэтому слово
    // «образ» обязано уйти наружу, а не получить чужой перевод пары.
    flashcardFindMany.mockResolvedValue([{ russian: "образ мышления", translationEs: "forma de pensar" }]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ responseStatus: 200, matches: [{ translation: "imagen", match: 1 }] }),
    });

    const body = await (await GET(fakeRequest("образ"))).json();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.translation).toBe("imagen");
  });
});

describe("GET /api/dictionary/translate — отказ чужого сервиса не виден ученику (долг 168)", () => {
  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: подсаженный «MYMEMORY WARNING…» опознан отказом", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => QUOTA_REFUSAL_BODY });

    const res = await GET(fakeRequest("дед"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.translation).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/MYMEMORY|TRANSLATIONS FOR TODAY/i);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: настоящий перевод проходит", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ responseStatus: 200, quotaFinished: false, matches: [{ translation: "abuelo", match: 1 }] }),
    });

    const res = await GET(fakeRequest("дед"));
    expect(res.status).toBe(200);
    expect((await res.json()).translation).toBe("abuelo");
  });

  it("отказ не запирается в кэше: no-store", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => QUOTA_REFUSAL_BODY });
    const res = await GET(fakeRequest("дед"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("отказ чтения своего банка не роняет тап — слово уходит наружу", async () => {
    flashcardFindMany.mockRejectedValue(new Error("база не отвечает"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ responseStatus: 200, matches: [{ translation: "abuela", match: 1 }] }),
    });

    const res = await GET(fakeRequest("бабушка"));
    expect(res.status).toBe(200);
    expect((await res.json()).translation).toBe("abuela");
  });
});
