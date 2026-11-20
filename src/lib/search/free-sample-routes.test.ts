import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import es from "../../dictionaries/es.json";
import ru from "../../dictionaries/ru.json";
import type { Dictionary } from "@/i18n/dictionaries";
import { buildSearchRecords, type SearchSources } from "./records";

/**
 * ЗНАЧОК ПОИСКА ГОВОРИТ ТО ЖЕ, ЧТО ОТДАЮТ МАРШРУТЫ — 7.294, долг 104.
 *
 * Индекс ставит «открыто» карточкам и идиомам из бесплатного образца. Здесь
 * правда берётся не у той же функции, а у самих маршрутов: аноним
 * (`getEntitlementTier` → "free") спрашивает `GET /api/flashcards` по каждой
 * теме — так, как его спрашивает сетка тем, — и `GET /api/idioms` без
 * фильтра — так, как его спрашивает вкладка `IdiomsList`. Множество
 * отданного обязано совпасть с множеством помеченного «открыто» (у идиом —
 * плюс фраза `literary`, у которой корона-сорт).
 *
 * База не открывается (`check:no-db-in-tests`): банк — выдуманный, в порядке
 * `createdAt`, с C1 в начале темы и с темой длиннее образца.
 */

const getFlashcardIndex = vi.fn();
const idiomFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    idiom: { findMany: (...args: unknown[]) => idiomFindMany(...args) },
    audioAsset: { findMany: async () => [] },
  },
}));
vi.mock("@/lib/flashcards/cache", () => ({ getFlashcardIndex: (...args: unknown[]) => getFlashcardIndex(...args) }));
vi.mock("@/lib/cache", () => ({ cacheGet: () => undefined, cacheSet: () => undefined }));
// Подменяется только тариф посетителя; canAccessLevel и лимиты — настоящие.
vi.mock("@/lib/entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlement")>()),
  getEntitlementTier: async () => "free",
}));

const { GET: getFlashcards } = await import("@/app/api/flashcards/route");
const { GET: getIdioms } = await import("@/app/api/idioms/route");

function req(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

const card = (id: string, category: string, level: string) => ({
  id,
  russian: id,
  translationEs: id,
  transcription: id,
  category,
  level,
  synonyms: [],
  antonyms: [],
});

// food: C1 первой, потом 12 карточек A1–B2 — образец 10, две за пределом.
// family: 3 карточки — открыты все.
const BANK = [
  card("food-c1", "food", "C1"),
  ...Array.from({ length: 12 }, (_, i) => card(`food-${i + 1}`, "food", ["A1", "A2", "B1", "B2"][i % 4])),
  card("family-1", "family", "A1"),
  card("family-c1", "family", "C1"),
  card("family-2", "family", "B2"),
  card("family-3", "family", "A2"),
];

const idiom = (id: string, category: string, level = "A2") => ({
  id,
  phrase: id,
  spanishEquivalent: id,
  category,
  level,
});
const IDIOMS = [
  idiom("lit-1", "literary"),
  idiom("daily-c1", "daily", "C1"),
  idiom("daily-1", "daily"),
  idiom("prov-1", "proverbs"),
  idiom("lit-2", "literary"),
  idiom("daily-2", "daily"),
  idiom("prov-2", "proverbs"),
  idiom("daily-3", "daily"),
  idiom("prov-3", "proverbs"),
];

const SOURCES: SearchSources = {
  dictionaries: { es: es as unknown as Dictionary, ru: ru as unknown as Dictionary },
  exams: [],
  stories: [],
  media: [],
  flashcards: BANK.map(({ id, russian, translationEs, transcription, category, level }) => ({
    id,
    russian,
    translationEs,
    transcription,
    category,
    level,
  })),
  idioms: IDIOMS,
  glossary: [],
  puzzles: [],
};

describe("индекс поиска и маршруты выдачи согласны про бесплатный образец (долг 104)", () => {
  beforeEach(() => {
    getFlashcardIndex.mockResolvedValue(BANK);
    idiomFindMany.mockResolvedValue(IDIOMS);
  });

  const records = buildSearchRecords(SOURCES);
  const marked = (section: "flashcard" | "idiom", value: string) =>
    new Set(records.filter((r) => r.section === section && r.requires === value).map((r) => r.id));

  it("карточки: «открыто» в индексе = то, что /api/flashcards отдаёт анониму по темам", async () => {
    const served = new Set<string>();
    for (const category of ["food", "family"]) {
      const res = await getFlashcards(req(`https://x.test/api/flashcards?category=${category}`));
      const body = (await res.json()) as { cards: Array<{ id: string }>; limited: boolean };
      expect(body.limited).toBe(true);
      for (const c of body.cards) served.add(c.id);
    }
    expect(served.size).toBe(13);
    expect([...marked("flashcard", "free")].sort()).toEqual([...served].sort());
    expect(marked("flashcard", "subscription")).toEqual(new Set(["food-11", "food-12"]));
  });

  it("идиомы: «открыто» в индексе = то, что /api/idioms отдаёт анониму, кроме короны literary", async () => {
    const res = await getIdioms(req("https://x.test/api/idioms"));
    const { idioms: list } = (await res.json()) as { idioms: Array<{ id: string; category: string }> };
    const served = new Set(list.filter((i) => i.category !== "literary").map((i) => i.id));
    expect(served.size).toBe(4);
    expect([...marked("idiom", "free")].sort()).toEqual([...served].sort());
    // Фраза literary из образца — отдана, но с короной-сортом, как на вкладке.
    const servedLiterary = list.filter((i) => i.category === "literary").map((i) => i.id);
    expect(servedLiterary).toEqual(["lit-1"]);
    expect(records.find((r) => r.section === "idiom" && r.id === "lit-1")?.requires).toBe("premium-tier");
  });
});
