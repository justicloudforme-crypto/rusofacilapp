import { describe, expect, it } from "vitest";
import { canRedeemAccessCode } from "./access-code-offer";
import { hasAnyAccess, tierOfAccount, type EntitlementTier } from "./entitlement";

/**
 * ДОЛГ 228: ПРИГЛАШЕНИЕ ПОГАСИТЬ КОД ВИДИТ ТОЛЬКО ТОТ, КТО МОЖЕТ ИМ
 * ВОСПОЛЬЗОВАТЬСЯ. Решение владельца 16.09.2026 — скрываем.
 *
 * Здесь три вопроса, и ни на один из них нельзя ответить чтением кода:
 *
 *   1. То ли это самое условие, которым маршрут погашения отказывает.
 *      `redeemAccessCode` спрашивает `canRedeemAccessCode(tier)`, а
 *      человеческая формулировка правила — «нет действующего доступа»,
 *      то есть `!hasAnyAccess(tier)`. Что это одна величина, а не два
 *      похожих выражения, проверяется ПЕРЕБОРОМ всех разрядов, а не
 *      сличением текста.
 *   2. Отменённая подписка с неистёкшим оплаченным периодом — это живой
 *      доступ. Ровно этот случай снят владельцем на телефоне: у Vasya
 *      (standard, отменена, доступ до 19.09.2026) блок был виден.
 *   3. Обратная сторона: у бесплатного блок обязан БЫТЬ. Сторож,
 *      умеющий только прятать, прячет и то, что прятать нельзя.
 */

const ALL_TIERS: EntitlementTier[] = ["free", "standard", "premium"];

function rowFor(status: string, endsInDays: number) {
  return {
    plan: "monthly",
    status,
    currentPeriodEnd: new Date(Date.now() + endsInDays * 24 * 60 * 60 * 1000),
  };
}

describe("canRedeemAccessCode — одно условие на видимость блока и на отказ маршрута", () => {
  it("совпадает с «нет действующего доступа» на КАЖДОМ разряде", () => {
    for (const tier of ALL_TIERS) {
      expect(canRedeemAccessCode(tier)).toBe(!hasAnyAccess(tier));
    }
    // И обе стороны названы поимённо, чтобы совпадение выше не могло быть
    // совпадением двух одинаково сломанных функций.
    expect(canRedeemAccessCode("free")).toBe(true);
    expect(canRedeemAccessCode("standard")).toBe(false);
    expect(canRedeemAccessCode("premium")).toBe(false);
  });

  it("бесплатный аккаунт видит блок: своей строки нет вовсе", () => {
    const tier = tierOfAccount({ role: "student" }, []);
    expect(tier).toBe("free");
    expect(canRedeemAccessCode(tier)).toBe(true);
  });

  it("подписчик standard блока не видит — и месячный, и годовой", () => {
    for (const plan of ["monthly", "annual"]) {
      const tier = tierOfAccount({ role: "student" }, [{ ...rowFor("active", 20), plan }]);
      expect(tier).toBe("standard");
      expect(canRedeemAccessCode(tier)).toBe(false);
    }
  });

  it("ОТМЕНЁННАЯ подписка с неистёкшим периодом — это доступ, и блока нет", () => {
    // Случай с видео 17.09.2026: `cancel_at_period_end` у Stripe оставляет
    // строку в статусе active до конца оплаченного периода (7.193), и
    // кабинет печатает «Отменена — доступ до конца оплаченного периода».
    const tier = tierOfAccount({ role: "student" }, [rowFor("active", 3)]);
    expect(tier).toBe("standard");
    expect(canRedeemAccessCode(tier)).toBe(false);
  });

  it("а когда оплаченный период кончился — блок появляется сам", () => {
    const tier = tierOfAccount({ role: "student" }, [rowFor("active", -1)]);
    expect(tier).toBe("free");
    expect(canRedeemAccessCode(tier)).toBe(true);
  });

  it("пожизненный и сотрудник блока не видят", () => {
    const lifetime = tierOfAccount({ role: "student" }, [{ ...rowFor("active", 3650), plan: "lifetime" }]);
    expect(lifetime).toBe("premium");
    expect(canRedeemAccessCode(lifetime)).toBe(false);

    for (const role of ["admin", "owner"]) {
      const staff = tierOfAccount({ role }, []);
      expect(staff).toBe("premium");
      expect(canRedeemAccessCode(staff)).toBe(false);
    }
  });

  /**
   * Положительный контроль. Всё выше прошло бы и на функции, которая
   * просто повторяет `hasAnyAccess`; вопрос в том, УМЕЕТ ли этот набор
   * поймать возврат к старому правилу. Старое правило — «прятать только
   * верхний разряд» (`isPremiumTier`), то есть ровно состояние 7.202,
   * на котором владелец и снял находку. Подсаженное правило обязано
   * разойтись с нынешним, и именно на подписчике standard.
   */
  it("положительный контроль: правило 7.202 (прятать только верхний разряд) ловится на standard", () => {
    const asOf7202 = (tier: EntitlementTier) => tier !== "premium";
    const disagreements = ALL_TIERS.filter((tier) => asOf7202(tier) !== canRedeemAccessCode(tier));
    expect(disagreements).toEqual(["standard"]);
  });
});
