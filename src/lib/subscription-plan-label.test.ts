import { describe, expect, it } from "vitest";
import { planDisplayLabel, subscriptionRowLabel } from "./subscription-plan-label";
import type { Dictionary } from "@/i18n/dictionaries";
import ru from "@/dictionaries/ru.json";
import es from "@/dictionaries/es.json";

/**
 * ЗАМЕР В, ЗАКРЕПЛЁННЫЙ ПРОГОНОМ (заход 7.200).
 *
 * Правка 7.199 переименовала месячный тариф: `pricing.monthly.name`
 * «Помесячно» → «Ежемесячный» — по соседям в том же блоке («Годовой»,
 * «Premium»), то есть прилагательное, а не наречие. Владелец подтвердить
 * это на телефоне не смог: месячной подписки нет ни у одного из двух
 * аккаунтов на видео, а единственная боевая подписка (Vasya) кончается
 * 19.09.2026 в 09:47 по GMT+10.
 *
 * Поэтому подтверждение здесь, и оно про ТУ ЖЕ функцию, которую зовёт
 * вкладка «Подписка» кабинета, — не про её копию: `planDisplayLabel`
 * вынесена из страницы и импортируется и туда, и сюда. Поддельная роль,
 * поддельная подписка, ноль обращений к базе.
 */

const DICTS = { ru: ru as unknown as Dictionary, es: es as unknown as Dictionary };

describe("вкладка «Подписка»: тариф назван правильно на обоих языках", () => {
  it("месячный подписчик", () => {
    expect(planDisplayLabel("monthly", DICTS.ru)).toBe("Ежемесячный");
    expect(planDisplayLabel("monthly", DICTS.es)).toBe("Mensual");
  });

  it("годовой подписчик", () => {
    expect(planDisplayLabel("annual", DICTS.ru)).toBe("Годовой");
    expect(planDisplayLabel("annual", DICTS.es)).toBe("Anual");
  });

  it("разовый Premium", () => {
    expect(planDisplayLabel("lifetime", DICTS.ru)).toBe("Premium");
    expect(planDisplayLabel("lifetime", DICTS.es)).toBe("Premium");
  });

  it("две выдачи не через кассу подписаны по-разному", () => {
    // 7.151: «доступ выдан вручную» человеку, который сам погасил код, —
    // фраза про чужое событие.
    expect(planDisplayLabel("access_code", DICTS.ru)).not.toBe(planDisplayLabel("manual", DICTS.ru));
    expect(planDisplayLabel("access_code", DICTS.es)).not.toBe(planDisplayLabel("manual", DICTS.es));
  });

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: дореформенное значение обязано отличаться —
  // иначе проверка сошлась бы и на старом словаре, ничего не подтвердив.
  it("подсадка: старое «Помесячно» этой проверкой не проходит", () => {
    const before = { ...DICTS.ru, pricing: { ...DICTS.ru.pricing, monthly: { ...DICTS.ru.pricing.monthly, name: "Помесячно" } } } as Dictionary;
    expect(planDisplayLabel("monthly", before)).toBe("Помесячно");
    expect(planDisplayLabel("monthly", before)).not.toBe(planDisplayLabel("monthly", DICTS.ru));
  });

  it("ОТРИЦАТЕЛЬНЫЙ: неизвестный тариф печатается как есть, а не пустотой", () => {
    expect(planDisplayLabel("whatever", DICTS.ru)).toBe("whatever");
  });
});

/**
 * ДОЛГ 248, ЗАХОД 7.207: «Plan» и история платежей больше не спорят.
 *
 * Строка снята с прода: `www.petrov.ru_1992@mail.ru` погасил код
 * `AMIGOJY9DTAVG` 09.09.2026 в 03:58:05.498Z, а его `Subscription`
 * заведена в 03:58:05.612Z — через 114 мс, тем же запросом. План в
 * колонке у неё `manual`, потому что строка старше правки 7.151.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ прежнего кода — `planDisplayLabel(row.plan, …)`:
 * та самая функция и тот самый аргумент, которыми строка «Plan»
 * подписывалась до этой правки. Она обязана сказать «вручную».
 */
describe("подпись выданного доступа: код это или рука (долг 248)", () => {
  const REDEEMED = new Date("2026-09-09T03:58:05.498Z");
  const byCode = {
    plan: "manual",
    stripeSubscriptionId: null,
    createdAt: new Date("2026-09-09T03:58:05.612Z"),
  };
  const byHand = {
    plan: "manual",
    stripeSubscriptionId: null,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
  };
  const paid = {
    plan: "monthly",
    stripeSubscriptionId: "sub_123",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
  };

  it("доступ по коду: и «Plan», и история говорят «по коду»", () => {
    expect(subscriptionRowLabel(byCode, DICTS.es, [REDEEMED], "plan")).toBe("Acceso por código");
    expect(subscriptionRowLabel(byCode, DICTS.es, [REDEEMED], "history")).toBe("Acceso por código");
    expect(subscriptionRowLabel(byCode, DICTS.ru, [REDEEMED], "plan")).toBe("Доступ по коду");
    expect(subscriptionRowLabel(byCode, DICTS.ru, [REDEEMED], "history")).toBe("Доступ по коду");
  });

  it("положительный контроль: прежний код на той же строке говорил «вручную»", () => {
    expect(planDisplayLabel(byCode.plan, DICTS.es)).toBe("Acceso otorgado a mano");
    expect(planDisplayLabel(byCode.plan, DICTS.es)).not.toBe(
      subscriptionRowLabel(byCode, DICTS.es, [REDEEMED], "plan"),
    );
  });

  it("настоящая ручная выдача осталась «otorgado a mano»", () => {
    expect(subscriptionRowLabel(byHand, DICTS.es, [REDEEMED], "plan")).toBe("Acceso otorgado a mano");
    expect(subscriptionRowLabel(byHand, DICTS.ru, [REDEEMED], "plan")).toBe("Доступ выдан вручную");
  });

  it("настоящая подписка подписана тарифом, а не выдачей", () => {
    expect(subscriptionRowLabel(paid, DICTS.es, [REDEEMED], "plan")).toBe("Mensual");
    expect(subscriptionRowLabel(paid, DICTS.ru, [REDEEMED], "history")).toBe("Ежемесячный");
  });

  it("окно совпадения — минута, и ни секундой больше", () => {
    const late = { ...byHand, createdAt: new Date(REDEEMED.getTime() + 60_001) };
    const inside = { ...byHand, createdAt: new Date(REDEEMED.getTime() + 59_000) };
    expect(subscriptionRowLabel(late, DICTS.es, [REDEEMED], "plan")).toBe("Acceso otorgado a mano");
    expect(subscriptionRowLabel(inside, DICTS.es, [REDEEMED], "plan")).toBe("Acceso por código");
  });
});
