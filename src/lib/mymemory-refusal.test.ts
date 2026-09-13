import { describe, expect, it } from "vitest";
import { isRefusalPayload, isRefusalText, pickMyMemoryTranslation } from "./mymemory-refusal";

/**
 * ДОЛГ 168. Отказ чужого сервиса приходит с HTTP 200 и полем
 * `translation`, непустым и похожим на перевод. Здесь заперты ОБЕ
 * стороны правила: подсаженный отказ обязан быть опознан как отказ,
 * настоящий перевод обязан пройти.
 *
 * Ответ ниже — не выдумка: это дословный ответ MyMemory, пойманный на
 * настоящем обработчике 13.09.2026 (заход 7.187, часть 7).
 */
const REAL_QUOTA_REFUSAL = {
  responseData: {
    translatedText:
      "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 09 HOURS 12 MINUTES 00 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",
  },
  quotaFinished: true,
  responseDetails: "",
  responseStatus: 403,
  matches: [],
};

const REAL_TRANSLATION = {
  responseData: { translatedText: "abuelo" },
  quotaFinished: false,
  responseDetails: "",
  responseStatus: 200,
  matches: [
    { translation: "abuelo", match: 1 },
    { translation: "el abuelo", match: 0.86 },
  ],
};

describe("отказ MyMemory под видом перевода (долг 168)", () => {
  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: настоящий ответ «квота кончилась» опознан отказом", () => {
    expect(isRefusalPayload(REAL_QUOTA_REFUSAL)).toBe(true);
    expect(pickMyMemoryTranslation(REAL_QUOTA_REFUSAL)).toBeNull();
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: настоящий перевод проходит и выбран лучший", () => {
    expect(isRefusalPayload(REAL_TRANSLATION)).toBe(false);
    expect(pickMyMemoryTranslation(REAL_TRANSLATION)).toBe("abuelo");
  });

  it("отказ узнаётся по одному флагу quotaFinished, без кода и без текста", () => {
    expect(pickMyMemoryTranslation({ quotaFinished: true, matches: [{ translation: "abuelo", match: 1 }] })).toBeNull();
  });

  it("отказ узнаётся по responseStatus в теле, хотя снаружи HTTP 200", () => {
    for (const status of [403, "403", 429, "429", 500]) {
      expect(
        pickMyMemoryTranslation({ responseStatus: status, matches: [{ translation: "abuelo", match: 1 }] }),
        `responseStatus=${String(status)}`,
      ).toBeNull();
    }
  });

  it("предупреждение ОТДЕЛЬНОЙ строкой внутри matches не становится переводом", () => {
    // Самый коварный случай: ответ честно 200, флага нет, и настоящие
    // переводы в списке есть — но первым по `match` стоит предупреждение.
    const mixed = {
      responseStatus: 200,
      quotaFinished: false,
      matches: [
        { translation: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.", match: 1 },
        { translation: "abuelo", match: 0.74 },
      ],
    };
    expect(pickMyMemoryTranslation(mixed)).toBe("abuelo");
  });

  it("если переводом не является ничто — возвращается null, а не строка сервиса", () => {
    expect(
      pickMyMemoryTranslation({
        responseStatus: 200,
        matches: [{ translation: "MYMEMORY WARNING: …", match: 1 }],
        responseData: { translatedText: "PLEASE CONTACT US AT SUPPORT" },
      }),
    ).toBeNull();
  });

  it("законный испанский перевод заглавными буквами отказом НЕ считается", () => {
    // Правило ищет подпись сервиса, а не форму строки: «SÍ» и «OK» —
    // переводы, и запретить заглавные значило бы выбросить их.
    expect(isRefusalText("SÍ")).toBe(false);
    expect(isRefusalText("OK")).toBe(false);
    expect(pickMyMemoryTranslation({ responseStatus: 200, responseData: { translatedText: "SÍ" } })).toBe("SÍ");
  });

  it("пустой и мусорный ответ не выдаётся за перевод", () => {
    expect(pickMyMemoryTranslation({})).toBeNull();
    expect(pickMyMemoryTranslation({ responseStatus: 200, responseData: { translatedText: "   " } })).toBeNull();
    expect(pickMyMemoryTranslation({ responseStatus: 200, matches: "не массив" })).toBeNull();
  });
});
