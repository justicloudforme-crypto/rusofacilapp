import { describe, expect, it } from "vitest";
import { planDisplayLabel } from "./subscription-plan-label";
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
