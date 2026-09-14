import { describe, expect, it } from "vitest";
import { nativeAccessCopy } from "./native-access-copy";
import { locales, type Locale } from "@/i18n/config";
import ru from "@/dictionaries/ru.json";
import es from "@/dictionaries/es.json";

/**
 * ОДИН РЕГИСТР И ОДНА ФОРМУЛИРОВКА НА ВЕСЬ САЙТ — 7.195, часть 4.
 *
 * Владелец нашёл на живом телефоне две подписи одного и того же:
 * в словаре «ПО ПОДПИСКЕ» (разметка плашки несла `uppercase`), а в курсах
 * и рассказах — «По подписке» (`AccessMark` печатает подпись как есть).
 * Преобладающий вариант — «По подписке»: он приходит из словаря сайта
 * (`dict.access.subscriptionBadge`), его печатают четыре поверхности из
 * пяти, и он же попадает в поиск.
 *
 * Здесь эта договорённость держится числом: подписи нативной плашки обязаны
 * совпадать со словарными ЗНАК В ЗНАК, в обеих локалях. Правка одной
 * стороны без другой роняет проверку.
 */
const DICTIONARIES: Record<Locale, { access: { subscriptionBadge: string; premiumTierBadge: string } }> = {
  ru: ru as unknown as { access: { subscriptionBadge: string; premiumTierBadge: string } },
  es: es as unknown as { access: { subscriptionBadge: string; premiumTierBadge: string } },
};

describe("подписи знаков платности", () => {
  for (const locale of locales) {
    it(`${locale}: подпись 🔒 совпадает со словарём знак в знак`, () => {
      expect(nativeAccessCopy(locale).locked.badge).toBe(DICTIONARIES[locale].access.subscriptionBadge);
    });

    it(`${locale}: подпись 👑 совпадает со словарём знак в знак`, () => {
      expect(nativeAccessCopy(locale).locked.badgePremium).toBe(DICTIONARIES[locale].access.premiumTierBadge);
    });

    it(`${locale}: подписи различаются между собой`, () => {
      const copy = nativeAccessCopy(locale).locked;
      expect(copy.badge).not.toBe(copy.badgePremium);
    });
  }

  // ПОЗИТИВНЫЙ КОНТРОЛЬ. Подсадка — ровно тот дефект, что был на экране:
  // тот же текст, но в другом регистре. Сверка обязана его поймать.
  it("подсадка другого регистра ловится", () => {
    const real = nativeAccessCopy("ru").locked.badge;
    const planted = real.toUpperCase();
    expect(planted).not.toBe(real);
    expect(planted).not.toBe(DICTIONARIES.ru.access.subscriptionBadge);
  });
});

/**
 * РАЗРЕЗ ЧИСЛА ЗВУЧИТ СЛОВАМИ — 7.195, часть 2.
 *
 * Четыре шаблона на четыре разреза, и у каждого обязаны быть ровно те
 * подстановки, которые этот разрез называет. Шаблон про тему без `{topic}`
 * и есть тот дефект, из-за которого «8 слов темы Еда» было прочитано как
 * «8 слов уровня C1».
 */
describe("шаблоны плашки закрытого", () => {
  for (const locale of locales) {
    const copy = nativeAccessCopy(locale).locked;

    it(`${locale}: без разреза — только {items}`, () => {
      expect(copy.closed).toContain("{items}");
      expect(copy.closed).not.toContain("{level}");
      expect(copy.closed).not.toContain("{topic}");
    });

    it(`${locale}: разрез по уровню называет уровень`, () => {
      expect(copy.closedAtLevel).toContain("{items}");
      expect(copy.closedAtLevel).toContain("{level}");
      expect(copy.closedAtLevel).not.toContain("{topic}");
    });

    it(`${locale}: разрез по теме называет тему`, () => {
      expect(copy.closedInTopic).toContain("{items}");
      expect(copy.closedInTopic).toContain("{topic}");
      expect(copy.closedInTopic).not.toContain("{level}");
    });

    it(`${locale}: разрез по пересечению называет и уровень, и тему`, () => {
      expect(copy.closedAtLevelInTopic).toContain("{items}");
      expect(copy.closedAtLevelInTopic).toContain("{level}");
      expect(copy.closedAtLevelInTopic).toContain("{topic}");
    });
  }

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: прежний шаблон (уровень без темы) на месте
  // пересечения обязан быть пойман.
  it("подсадка прежнего шаблона на место пересечения ловится", () => {
    const planted = nativeAccessCopy("ru").locked.closedAtLevel;
    expect(planted).not.toContain("{topic}");
  });
});
