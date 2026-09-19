import { describe, it, expect } from "vitest";
import { isAlreadyMigrated } from "./audio-blob-map";

/**
 * ДОЛГ 38 — ПОЗИТИВНЫЙ КОНТРОЛЬ НА СТАРОМ ПРАВИЛЕ.
 *
 * «0 проблем» без позитивного контроля не результат (раздел 4.1). Здесь
 * контроль — это СТАРОЕ выражение, прогнанное по тем же входам: оно
 * обязано назвать перенесённую строку неперенесённой. Если завтра
 * кто-нибудь вернёт `!map[row.audioUrl]`, первый же случай ниже покраснеет.
 */
const OLD_RULE = (audioUrl: string, map: Record<string, string>) => Boolean(map[audioUrl]);

const MAP = {
  "/audio/story/abc/0-0.mp3": "https://x.public.blob.vercel-storage.com/audio/story/abc/0-0.mp3",
  "/audio/story/abc/0-1.mp3": "https://x.public.blob.vercel-storage.com/audio/story/abc/0-1.mp3",
};

describe("правило продолжения переноса озвучки (долг 38)", () => {
  it("строка, у которой audioUrl — КЛЮЧ карты (колонку ещё не переписывали), перенесена", () => {
    expect(isAlreadyMigrated("/audio/story/abc/0-0.mp3", MAP)).toBe(true);
    // старое правило здесь совпадало — этот случай оно и обслуживало
    expect(OLD_RULE("/audio/story/abc/0-0.mp3", MAP)).toBe(true);
  });

  it("строка, у которой audioUrl — ЗНАЧЕНИЕ карты (apply-audio-blob-urls уже прошёл), тоже перенесена", () => {
    const url = MAP["/audio/story/abc/0-1.mp3"];
    expect(isAlreadyMigrated(url, MAP)).toBe(true);
    // ПОЗИТИВНЫЙ КОНТРОЛЬ: ровно здесь старое правило и врало
    expect(OLD_RULE(url, MAP)).toBe(false);
  });

  it("незнакомая строка не перенесена ни по одному из двух признаков", () => {
    expect(isAlreadyMigrated("/audio/story/zzz/9-9.mp3", MAP)).toBe(false);
  });

  it("на пустой карте не перенесено ничего — иначе первый прогон не начался бы вовсе", () => {
    expect(isAlreadyMigrated("/audio/story/abc/0-0.mp3", {})).toBe(false);
    expect(isAlreadyMigrated(MAP["/audio/story/abc/0-0.mp3"], {})).toBe(false);
  });

  it("предсобранный набор значений даёт тот же ответ, что и разбор карты на месте", () => {
    const values = new Set(Object.values(MAP));
    for (const probe of [...Object.keys(MAP), ...Object.values(MAP), "/audio/nope.mp3"]) {
      expect(isAlreadyMigrated(probe, MAP, values)).toBe(isAlreadyMigrated(probe, MAP));
    }
  });

  it("вся база после apply-audio-blob-urls читается как перенесённая, а не как пустая очередь", () => {
    const rows = Object.values(MAP).map((audioUrl) => ({ audioUrl }));
    const values = new Set(Object.values(MAP));
    const queue = rows.filter((r) => !isAlreadyMigrated(r.audioUrl, MAP, values));
    expect(queue).toHaveLength(0);
    // ПОЗИТИВНЫЙ КОНТРОЛЬ: старое правило звало в очередь ВСЕ строки —
    // ровно то «0 already migrated при 21 866 записях в карте» из долга.
    expect(rows.filter((r) => !OLD_RULE(r.audioUrl, MAP))).toHaveLength(rows.length);
  });
});
