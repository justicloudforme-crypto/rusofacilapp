/**
 * ВИЗИТЫ ВЛАДЕЛЬЦА НЕ СЧИТАЮТСЯ (заход 7.310) — правило без браузера.
 * Сквозная проверка с настоящими компонентами Vercel и сетевыми запросами —
 * `e2e/owner-stats-opt-out.spec.ts` (оба движка).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STATS_OPT_OUT_KEY,
  isAdminPath,
  markOnAdminVisit,
  readStatsMark,
  setStatsExcluded,
  shouldSkipStats,
  subscribeStatsMark,
} from "./stats-opt-out";
import { personalLocalKeys } from "./signed-out-local";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("isAdminPath", () => {
  it.each([
    "/admin",
    "/admin/lessons",
    "/es/admin",
    "/ru/admin/",
    "/es/admin/search-demand?q=1",
    "https://rusofacilapp.com/ru/admin/users",
    "http://localhost:3100/es/admin/lessons#x",
  ])("админка: %s", (url) => {
    expect(isAdminPath(url)).toBe(true);
  });

  it.each([
    "/",
    "/es",
    "/ru/stories",
    "/es/administracion",
    "/es/lessons/admin",
    "/de/admin",
    "https://rusofacilapp.com/es/pricing?next=/es/admin",
    "/es/gramatica/admin-x",
  ])("не админка: %s", (url) => {
    expect(isAdminPath(url)).toBe(false);
  });
});

describe("пометка браузера", () => {
  it("без пометки обычная страница считается, админка — нет", () => {
    expect(readStatsMark()).toBe("unset");
    expect(shouldSkipStats("https://rusofacilapp.com/es/stories")).toBe(false);
    expect(shouldSkipStats("https://rusofacilapp.com/es/admin/lessons")).toBe(true);
  });

  it("заход в админку ставит «не считать», и с ним молчат все страницы", () => {
    expect(markOnAdminVisit()).toBe("excluded");
    expect(window.localStorage.getItem(STATS_OPT_OUT_KEY)).toBe("1");
    expect(shouldSkipStats("/es")).toBe(true);
    expect(shouldSkipStats("/ru/lessons/a1")).toBe(true);
  });

  it("снятая кнопкой пометка («0») заходом в админку не перебивается", () => {
    setStatsExcluded(false);
    expect(markOnAdminVisit()).toBe("counted");
    expect(shouldSkipStats("/es")).toBe(false);
    // админка не уходит и тогда
    expect(shouldSkipStats("/es/admin")).toBe(true);
  });

  it("кнопка действует сразу и будит подписчиков", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeStatsMark(listener);
    setStatsExcluded(true);
    expect(shouldSkipStats("/es")).toBe(true);
    setStatsExcluded(false);
    expect(shouldSkipStats("/es")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setStatsExcluded(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("чужое значение ключа читается как «нет пометки»", () => {
    window.localStorage.setItem(STATS_OPT_OUT_KEY, "yes");
    expect(readStatsMark()).toBe("unset");
    expect(shouldSkipStats("/es")).toBe(false);
  });

  it("отказ хранилища не бросает и ничего не отсекает", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(markOnAdminVisit()).toBe("unset");
    expect(shouldSkipStats("/es")).toBe(false);
    expect(shouldSkipStats("/es/admin")).toBe(true);
  });

  it("уборка при выходе из учётки пометку не стирает", () => {
    expect(personalLocalKeys([STATS_OPT_OUT_KEY])).toEqual([]);
    // позитивный контроль: личный ключ уборка видит
    expect(personalLocalKeys(["rusofacil:story-progress", STATS_OPT_OUT_KEY])).toEqual([
      "rusofacil:story-progress",
    ]);
  });
});
