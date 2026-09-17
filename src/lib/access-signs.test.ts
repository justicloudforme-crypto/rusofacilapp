/**
 * ОДИН ЗНАК НА ВСЁ ПРИЛОЖЕНИЕ — правило и обе его половины (7.196, ч. 1).
 *
 * Здесь судится само правило; отрисованные экраны судит
 * `scripts/check-access-signs.mjs`, и он берёт ожидание ОТСЮДА ЖЕ, а не
 * переписывает его своими словами.
 */
import { describe, expect, it } from "vitest";
import {
  accessMarkFor,
  accessSignFor,
  flashcardRequirement,
  idiomRequirement,
  lessonRequirement,
  levelRequirement,
  mediaRequirement,
  sortSign,
  storyRequirement,
  wordGameLevelHasFreePuzzle,
  wordGameRequirement,
  type AccessRequirement,
  type ViewerTier,
} from "./access-marks";

const TIERS: ViewerTier[] = ["free", "standard", "premium"];
const REQUIREMENTS: AccessRequirement[] = ["free", "subscription", "premium-tier"];

describe("правило знака — три исхода и ни одного четвёртого", () => {
  it("корона стоит у премиального материала при ЛЮБОЙ роли, включая premium", () => {
    for (const tier of TIERS) {
      const sign = accessSignFor("premium-tier", tier, { nativeShell: true });
      expect([tier, sign?.mark, sign?.labelKey]).toEqual([tier, "premium-tier", "premiumTierBadge"]);
    }
  });

  /**
   * ЗАМОК РЯДОМ С КОРОНОЙ — долг 251, решение владельца 18.09.2026.
   *
   * Владелец снял: у доступа по коду на премиальном пазле стоит корона и
   * ничего больше, хотя пазл ему не откроется (580 из 2015 по боевой базе
   * 17.09.2026). Корона — СОРТ, замок — СОСТОЯНИЕ, и одно не заменяет
   * другого.
   */
  it("у закрытого премиального материала оба знака: сорт и состояние", () => {
    for (const tier of ["free", "standard"] as ViewerTier[]) {
      const sign = accessSignFor("premium-tier", tier, { nativeShell: true });
      expect([tier, sign?.mark, sign?.locked]).toEqual([tier, "premium-tier", true]);
    }
  });

  it("у Premium премиальный материал открыт — корона без замка", () => {
    const sign = accessSignFor("premium-tier", "premium", { nativeShell: true });
    expect(sign?.mark).toBe("premium-tier");
    expect(sign?.locked ?? false).toBe(false);
  });

  it("закрытость, названную поверхностью, слушает и корона", () => {
    // Словарь знает про бесплатную пробу больше, чем правило; знак сорта
    // от этого не пропадает, но состояние берётся у поверхности.
    expect(accessSignFor("premium-tier", "premium", { nativeShell: true, closed: true })?.locked).toBe(true);
    expect(accessSignFor("premium-tier", "free", { nativeShell: true, closed: false })?.locked ?? false).toBe(false);
  });

  it("в ВЕБЕ второго знака нет ни у кого — правило там прежнее", () => {
    for (const tier of TIERS) {
      for (const requirement of REQUIREMENTS) {
        for (const closed of [true, false]) {
          const sign = accessSignFor(requirement, tier, { nativeShell: false, closed });
          expect([tier, requirement, closed, sign?.locked ?? false]).toEqual([tier, requirement, closed, false]);
        }
      }
    }
  });

  it("замок в одиночку по-прежнему не несёт признака состояния отдельно", () => {
    // У непремиального закрытого материала знак ОДИН и он же состояние:
    // второго глифа рядом быть не должно, иначе на экране два замка.
    const sign = accessSignFor("subscription", "free", { nativeShell: true });
    expect(sign?.mark).toBe("subscription");
    expect(sign?.locked ?? false).toBe(false);
  });

  it("замок — только у закрытого и только у НЕпремиального", () => {
    expect(accessSignFor("subscription", "free", { nativeShell: true })).toEqual({
      mark: "subscription",
      labelKey: "subscriptionBadge",
    });
    // Подписчику то же требование знака не даёт: он открыт.
    expect(accessSignFor("subscription", "standard", { nativeShell: true })).toBeNull();
    expect(accessSignFor("free", "free", { nativeShell: true })).toBeNull();
  });

  it("сорт остаётся сортом: у премиального и закрытого знак сорта — корона", () => {
    const sign = accessSignFor("premium-tier", "free", { nativeShell: true, closed: true });
    expect(sign?.mark).toBe("premium-tier");
    expect(sign?.labelKey).toBe("premiumTierBadge");
    // …и рядом с ней состояние, а не вместо неё (долг 251).
    expect(sign?.locked).toBe(true);
  });

  it("закрытость, названную поверхностью, правило слушает — но только для замка", () => {
    // Словарь знает про бесплатную пробу больше, чем правило: тема, в
    // которой не отдано ни одной карточки, закрыта, хотя тариф «хватает».
    expect(accessSignFor("subscription", "standard", { nativeShell: true, closed: true })?.mark).toBe("subscription");
    // И обратно: открытая тема знака не несёт.
    expect(accessSignFor("subscription", "free", { nativeShell: true, closed: false })).toBeNull();
  });

  it("подписей ровно две пары, и обе — ключи словаря сайта", () => {
    const keys = new Set<string>();
    for (const requirement of REQUIREMENTS) {
      for (const tier of TIERS) {
        for (const closed of [true, false]) {
          for (const nativeShell of [true, false]) {
            const sign = accessSignFor(requirement, tier, { nativeShell, closed });
            if (sign) keys.add(sign.labelKey);
          }
        }
      }
    }
    expect([...keys].sort()).toEqual(["premiumTierBadge", "subscriptionBadge"]);
  });
});

describe("в вебе не меняется ничего — это отдельное утверждение, а не следствие", () => {
  it("вне оболочки правило отвечает знак в знак прежним `accessMarkFor`", () => {
    let checked = 0;
    for (const requirement of REQUIREMENTS) {
      for (const tier of TIERS) {
        const legacy = accessMarkFor(requirement, tier);
        const sign = accessSignFor(requirement, tier, { nativeShell: false });
        expect(sign?.mark ?? null).toBe(legacy);
        checked += 1;
      }
    }
    // Без этой строки «совпало» могло бы значить «не проверено ничего».
    expect(checked).toBe(REQUIREMENTS.length * TIERS.length);
  });

  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: внутри оболочки ответ в трёх случаях из девяти ДРУГОЙ", () => {
    const differing = [];
    for (const requirement of REQUIREMENTS) {
      for (const tier of TIERS) {
        const web = accessSignFor(requirement, tier, { nativeShell: false })?.mark ?? null;
        const shell = accessSignFor(requirement, tier, { nativeShell: true })?.mark ?? null;
        if (web !== shell) differing.push([requirement, tier, web, shell]);
      }
    }
    // Ровно один случай: премиальный материал у подписчика Premium — в
    // вебе знака нет, в оболочке стоит корона. Если бы правило ничего не
    // меняло, предыдущая проверка была бы украшением.
    expect(differing).toEqual([["premium-tier", "premium", null, "premium-tier"]]);
  });
});

describe("сорт уровня — по семьям, а не «C1 значит корона»", () => {
  it("карточки и рассказы уровня C1 премиальны, пазлы — нет", () => {
    expect(levelRequirement("flashcards", "C1")).toBe("premium-tier");
    expect(levelRequirement("stories", "C1")).toBe("premium-tier");
    // 344 пазла уровня C1 из 482 открывает обычная подписка — замер по
    // боевой базе 14.09.2026. Корона на них была бы враньём.
    expect(levelRequirement("wordGames", "C1")).toBe("subscription");
  });

  it("на остальных уровнях премиального сорта нет ни у одной семьи", () => {
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(sortSign(levelRequirement("flashcards", level))).toBeNull();
      expect(sortSign(levelRequirement("stories", level))).toBeNull();
      expect(sortSign(levelRequirement("wordGames", level))).toBeNull();
    }
  });

  it("уровень C1 у игр закрыт бесплатной пробе целиком, а A1…B2 — нет", () => {
    for (const type of ["WORD_SEARCH", "CROSSWORD"]) {
      expect(wordGameLevelHasFreePuzzle(type, "C1")).toBe(false);
      for (const level of ["A1", "A2", "B1", "B2"]) {
        expect(wordGameLevelHasFreePuzzle(type, level)).toBe(true);
      }
    }
  });
});

describe("сорт материала — по признаку, а не по колонке", () => {
  it("коронованных видов ровно четыре, и каждый назван признаком", () => {
    const crowned: Array<[string, AccessRequirement]> = [
      ["карточка C1", flashcardRequirement({ level: "C1" })],
      ["рассказ C1", storyRequirement({ level: "C1", isPremium: true, premiumOnly: false })],
      ["рассказ premiumOnly", storyRequirement({ level: "A1", isPremium: true, premiumOnly: true })],
      ["пазл curved", wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 1, curved: true })],
      ["пазл premiumOnly", wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 1, premiumOnly: true })],
      ["идиома literary", idiomRequirement({ category: "literary" })],
    ];
    for (const [name, requirement] of crowned) {
      expect([name, sortSign(requirement)?.mark ?? null]).toEqual([name, "premium-tier"]);
    }
  });

  it("у уроков, экзаменов и медиа слоя Premium нет — там только замок", () => {
    const plain: Array<[string, AccessRequirement]> = [
      ["урок не первый", lessonRequirement({ level: "A1", slug: "2" })],
      ["видео не из витрины", mediaRequirement({ free: false })],
      ["пазл обычный за десяткой", wordGameRequirement({ type: "WORD_SEARCH", level: "A1", sequence: 50 })],
      ["карточка не C1", flashcardRequirement({ level: "B2" })],
    ];
    for (const [name, requirement] of plain) {
      expect([name, sortSign(requirement)?.mark ?? null]).toEqual([name, null]);
      expect([name, accessSignFor(requirement, "free", { nativeShell: true })?.mark ?? null]).toEqual([
        name,
        "subscription",
      ]);
    }
  });

  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: подсадка неверного знака отличима от верного", () => {
    // Сторож отрисованных поверхностей сверяет знак с этим правилом. Если
    // бы «замок вместо короны» правило устраивало, сверять было бы нечего.
    const right = accessSignFor("premium-tier", "free", { nativeShell: true })!;
    const planted = { mark: "subscription", labelKey: "subscriptionBadge" };
    expect(right).not.toEqual(planted);
  });
});
