import { describe, expect, it } from "vitest";
import { localeDecision, localeForPrefixlessPath } from "./locale-decision";

/**
 * Порядок источников языка на адресе без префикса локали — 7.214.
 * Поведение целиком снято с живого прода 18.09.2026; здесь оно заперто,
 * чтобы следующая правка `src/proxy.ts` не поменяла его молча.
 */
describe("порядок источников языка", () => {
  it("НАБЛЮДЕНИЕ ВЛАДЕЛЬЦА: испанский телефон + выбранный русский → /ru", () => {
    expect(localeDecision({ remembered: "ru", acceptLanguage: "es-MX,es;q=0.9" })).toEqual({
      locale: "ru",
      source: "remembered",
    });
  });

  it("и в обратную сторону: русский телефон + выбранный испанский → /es", () => {
    expect(localeForPrefixlessPath({ remembered: "es", acceptLanguage: "ru-RU,ru;q=0.9" })).toBe("es");
  });

  it("ничего не запомнено — решает устройство", () => {
    expect(localeDecision({ remembered: null, acceptLanguage: "ru-RU,ru;q=0.9" })).toEqual({
      locale: "ru",
      source: "device",
    });
  });

  it("ничего не запомнено и язык устройства третий — молчаливый ответ испанский", () => {
    expect(localeDecision({ remembered: null, acceptLanguage: "pt-BR,pt;q=0.9" })).toEqual({
      locale: "es",
      source: "default",
    });
  });

  it("ни куки, ни заголовка — тот же молчаливый ответ", () => {
    expect(localeDecision({ remembered: null, acceptLanguage: null })).toEqual({
      locale: "es",
      source: "default",
    });
  });

  it("чужое значение куки — это «не запомнено», а не ошибка", () => {
    expect(localeDecision({ remembered: "xx", acceptLanguage: "ru-RU,ru;q=0.9" })).toEqual({
      locale: "ru",
      source: "device",
    });
  });

  it("кука сильнее верно разобранного веса q (долг 155 не отменяется, а идёт вторым)", () => {
    expect(localeForPrefixlessPath({ remembered: "ru", acceptLanguage: "en-US,ru;q=0.3,es;q=0.9" })).toBe("ru");
    expect(localeForPrefixlessPath({ remembered: null, acceptLanguage: "en-US,ru;q=0.3,es;q=0.9" })).toBe("es");
  });
});
