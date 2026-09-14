import { describe, expect, it } from "vitest";
import {
  accessMarkFor,
  examRequirement,
  flashcardRequirement,
  idiomRequirement,
  lessonRequirement,
  meetsRequirement,
  mediaRequirement,
  storyRequirement,
  wordGameRequirement,
  type ViewerTier,
  type AccessRequirement,
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

describe("flashcardRequirement", () => {
  it("C1 — план Premium, остальное — подписка, а НЕ «открыто»", () => {
    expect(flashcardRequirement({ level: "C1" })).toBe("premium-tier");
    for (const level of ["A1", "A2", "B1", "B2"]) {
      // Ключевая строка захода 09.09.2026: не "free". Бесплатный образец
      // у карточек позиционный (первые FREE_TRIAL_LIMITS.flashcards на
      // тему), и «открыта» про отдельную строку — враньё: индекс поиска
      // печатал так 4783 карточки, из которых аноним открывает 230.
      expect(flashcardRequirement({ level })).toBe("subscription");
    }
  });
});

describe("idiomRequirement", () => {
  it("literary и C1 — план Premium, остальное — подписка", () => {
    expect(idiomRequirement({ level: "A2", category: "literary" })).toBe("premium-tier");
    expect(idiomRequirement({ level: "C1", category: "proverbs" })).toBe("premium-tier");
    expect(idiomRequirement({ level: "A2", category: "proverbs" })).toBe("subscription");
  });
});

describe("lessonRequirement", () => {
  it("первый урок каждого уровня открыт, остальные — по подписке", () => {
    for (const level of ["a1", "a2", "b1", "b2"]) {
      expect(lessonRequirement({ level, slug: "1" })).toBe("free");
      expect(lessonRequirement({ level, slug: "2" })).toBe("subscription");
      expect(lessonRequirement({ level, slug: "30" })).toBe("subscription");
    }
  });

  it("слоя Premium у уроков и экзаменов нет ни одного", () => {
    expect(examRequirement()).toBe("subscription");
    const marks = new Set(
      ["1", "2", "30"].map((slug) => lessonRequirement({ level: "b2", slug })),
    );
    expect(marks.has("premium-tier")).toBe(false);
  });
});

describe("mediaRequirement", () => {
  it("бесплатная витрина против всего остального", () => {
    expect(mediaRequirement({ free: true })).toBe("free");
    expect(mediaRequirement({ free: false })).toBe("subscription");
    expect(mediaRequirement({})).toBe("subscription");
  });
});

/**
 * ПОД ПОДПИСЧИКОМ КОРОНОВАННОЕ ОТКРЫВАЕТСЯ, И ЗАМКА НА НЁМ НЕТ — 7.195, часть 4.
 *
 * Решение владельца 14.09.2026: 👑 — метка сорта («это премиум»), 🔒 —
 * состояние доступа («сейчас не открыть»). Отсюда обязательство, которое
 * можно проверить: у того, чей план покрывает премиальный слой, на
 * коронованном материале не должно оставаться ни одного замка.
 *
 * Роль здесь названа точно, и это важно: «подписчик» бывает двух видов.
 * `premium` премиальный слой покрывает, `standard` — НЕТ (C1, `curved`,
 * `premiumOnly`, `literary` сверх пробы). Поэтому под `standard` корона на
 * закрытом материале — не дефект, а правда о его плане, и проверка это
 * различает вместо того, чтобы усреднять.
 */
describe("коронованное и роль подписчика", () => {
  /** По одному представителю каждого коронованного вида содержимого. */
  const CROWNED: Array<[string, AccessRequirement]> = [
    ["карточка C1", flashcardRequirement({ level: "C1" })],
    ["рассказ C1", storyRequirement({ level: "C1", isPremium: true, premiumOnly: false })],
    ["рассказ premiumOnly", storyRequirement({ level: "B2", isPremium: true, premiumOnly: true })],
    ["пазл curved", wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 2, curved: true })],
    ["пазл premiumOnly", wordGameRequirement({ type: "CROSSWORD", level: "B1", sequence: 9, premiumOnly: true })],
    ["идиома literary", idiomRequirement({ level: "A2", category: "literary" })],
  ];

  it("все шесть видов действительно коронованы — иначе проверять нечего", () => {
    for (const [name, requirement] of CROWNED) {
      expect(requirement, name).toBe("premium-tier");
    }
    expect(CROWNED).toHaveLength(6);
  });

  it("под планом Premium замков на коронованном ноль", () => {
    const locks = CROWNED.filter(([, requirement]) => accessMarkFor(requirement, "premium") !== null);
    expect(locks.map(([name]) => name)).toEqual([]);
    for (const [name, requirement] of CROWNED) {
      expect(meetsRequirement(requirement, "premium"), name).toBe(true);
    }
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ к утверждению выше: у роли, чей план премиальный
  // слой НЕ покрывает, знак обязан остаться. Ноль под `premium` без этого
  // мог бы означать «знаков нет вовсе».
  it("под free и standard знак на коронованном остаётся у всех шести", () => {
    for (const tier of ["free", "standard"] as const) {
      const marked = CROWNED.filter(([, requirement]) => accessMarkFor(requirement, tier) === "premium-tier");
      expect(marked, tier).toHaveLength(CROWNED.length);
    }
  });
});
