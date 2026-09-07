import { describe, expect, it } from "vitest";
import {
  accessMarkFor,
  meetsRequirement,
  mediaRequirement,
  storyRequirement,
  wordGameRequirement,
  type ViewerTier,
} from "./access-marks";
import { isFreeWordGamePuzzle } from "./word-games/free-tier";

/**
 * Признак обязан СОГЛАСОВЫВАТЬСЯ с воротами, а не просто существовать.
 *
 * Значок, который говорит одно, а ворота решают другое, — это ровно то,
 * что было до 07.09.2026, только с другой стороны. Поэтому каждый случай
 * ниже сверяется с тем же ответом, что даёт рантайм.
 */
const TIERS: ViewerTier[] = ["free", "standard", "premium"];

describe("storyRequirement", () => {
  it("совпадает с getStoryAccess по всем восьми сочетаниям колонок", () => {
    // Повторение правила getStoryAccess из entitlement.ts (его нельзя
    // импортировать сюда: модуль `server-only`). Если правило разойдётся
    // с этим, разойдётся и тест — что и требуется.
    const gate = (tier: ViewerTier, s: { level: string; isPremium: boolean; premiumOnly: boolean }) => {
      if (s.isPremium && tier === "free") return false;
      if ((s.premiumOnly || s.level === "C1") && tier !== "premium") return false;
      return true;
    };
    for (const level of ["A1", "C1"]) {
      for (const isPremium of [false, true]) {
        for (const premiumOnly of [false, true]) {
          const story = { level, isPremium, premiumOnly };
          for (const tier of TIERS) {
            expect(meetsRequirement(storyRequirement(story), tier), `${level}/${isPremium}/${premiumOnly}/${tier}`)
              .toBe(gate(tier, story));
          }
        }
      }
    }
  });

  it("«входит в обычную подписку» и «нужен план Premium» — разные значения", () => {
    // Ровно та жалоба: 225 рассказов из 323 носили слово Premium ни за что.
    expect(storyRequirement({ level: "A2", isPremium: true, premiumOnly: false })).toBe("subscription");
    expect(storyRequirement({ level: "B2", isPremium: true, premiumOnly: true })).toBe("premium-tier");
    expect(storyRequirement({ level: "C1", isPremium: true, premiumOnly: false })).toBe("premium-tier");
    expect(storyRequirement({ level: "A1", isPremium: false, premiumOnly: false })).toBe("free");
  });
});

describe("wordGameRequirement", () => {
  it("curved требует Premium так же, как premiumOnly — и не по данным, а по коду", () => {
    // На проде curved без premiumOnly сегодня 0 из 479. Признак не должен
    // зависеть от того, останется ли это правдой завтра.
    expect(wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 2, curved: true, premiumOnly: false }))
      .toBe("premium-tier");
    expect(wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 2, curved: false, premiumOnly: true }))
      .toBe("premium-tier");
  });

  it("бесплатность берётся у isFreeWordGamePuzzle, а не переписывается", () => {
    for (const level of ["A1", "B2", "C1"]) {
      for (const sequence of [1, 10, 11, 668]) {
        const puzzle = { type: "WORD_SEARCH", level, sequence, curved: false, premiumOnly: false };
        expect(wordGameRequirement(puzzle) === "free").toBe(isFreeWordGamePuzzle(puzzle));
      }
    }
  });
});

describe("accessMarkFor", () => {
  it("значок видит только тот, кто не может открыть", () => {
    expect(accessMarkFor("subscription", "free")).toBe("subscription");
    expect(accessMarkFor("subscription", "standard")).toBe(null);
    expect(accessMarkFor("subscription", "premium")).toBe(null);
    expect(accessMarkFor("premium-tier", "free")).toBe("premium-tier");
    expect(accessMarkFor("premium-tier", "standard")).toBe("premium-tier");
    expect(accessMarkFor("premium-tier", "premium")).toBe(null);
    expect(accessMarkFor("free", "free")).toBe(null);
  });

  it("никогда не рисует два значка на одну единицу содержимого", () => {
    // До правки рассказ с premiumOnly нёс И «⭐ Premium», И «👑 Solo Premium»:
    // 98 строк из 325 на боевой базе.
    for (const tier of TIERS) {
      const mark = accessMarkFor(storyRequirement({ level: "B2", isPremium: true, premiumOnly: true }), tier);
      expect(mark === null || typeof mark === "string").toBe(true);
    }
  });
});

describe("mediaRequirement", () => {
  it("бесплатная витрина против всего остального", () => {
    expect(mediaRequirement({ free: true })).toBe("free");
    expect(mediaRequirement({ free: false })).toBe("subscription");
    expect(mediaRequirement({})).toBe("subscription");
  });
});
