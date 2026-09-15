import { describe, expect, it } from "vitest";
import { personalPageCaches, LEGACY_PAGE_CACHES, SIGNED_OUT_PARAM } from "./signed-out";
import { pageCacheNames, PAGE_CACHE_PREFIX } from "./sw-cache-names";

describe("personalPageCaches", () => {
  it("берёт все четыре семейства текущей сборки", () => {
    const names = Object.values(pageCacheNames("abc123"));
    expect(personalPageCaches(names).sort()).toEqual(names.sort());
  });

  it("берёт кеши ЧУЖИХ сборок тоже — вернувшийся посетитель носит их в себе", () => {
    const mine = Object.values(pageCacheNames("new"));
    const older = Object.values(pageCacheNames("old"));
    expect(personalPageCaches([...mine, ...older])).toHaveLength(mine.length + older.length);
  });

  it("берёт безымянные кеши @serwist/next до долга 14", () => {
    expect(personalPageCaches(LEGACY_PAGE_CACHES).sort()).toEqual([...LEGACY_PAGE_CACHES].sort());
  });

  it("НЕ трогает ничего, кроме документов", () => {
    // Озвучка рассказа — мегабайты, и личных данных в ней нет ни в одной.
    // Выбрасывать её при выходе значило бы платить чужими мегабайтами за
    // чужую же приватность.
    const others = [
      "serwist-precache-v2-https://rusofacilapp.com/",
      "apis",
      "static-font-assets",
      "static-image-assets",
      "static-audio-assets",
      "next-data",
      "cross-origin",
    ];
    expect(personalPageCaches(others)).toEqual([]);
  });

  it("разбирает живой список так же, как он приходит из caches.keys()", () => {
    const live = [
      `${PAGE_CACHE_PREFIX}-1a2b3c`,
      `${PAGE_CACHE_PREFIX}-others-1a2b3c`,
      "others",
      "static-audio-assets",
      "serwist-precache-v2-https://rusofacilapp.com/",
    ];
    expect(personalPageCaches(live)).toEqual([
      `${PAGE_CACHE_PREFIX}-1a2b3c`,
      `${PAGE_CACHE_PREFIX}-others-1a2b3c`,
      "others",
    ]);
  });
});

describe("признак выхода", () => {
  it("один и тот же у маршрута выхода и у уборщика на странице", () => {
    expect(SIGNED_OUT_PARAM).toBe("signedout");
  });
});
