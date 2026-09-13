import { describe, expect, it } from "vitest";
import { bankKey, isSingleRussianWord, normalizeBankWord } from "./translation-normalize";

/**
 * ДОЛГ 169. Правило нормализации скупое намеренно: ложное совпадение
 * хуже отсутствия перевода. Здесь заперты обе стороны — что складывается
 * и, главное, ЧТО НЕ СКЛАДЫВАЕТСЯ.
 */
describe("нормализация слова для своего банка (долг 169)", () => {
  it("складывается регистр", () => {
    expect(normalizeBankWord("Снегурочка")).toBe("снегурочка");
    expect(normalizeBankWord("ДЕД")).toBe("дед");
  });

  it("снимается знак ударения", () => {
    expect(normalizeBankWord("де́д")).toBe("дед");
    expect(normalizeBankWord("хорошо́")).toBe("хорошо");
  });

  it("снимаются невидимые разделители", () => {
    expect(normalizeBankWord("дед­")).toBe("дед");
    expect(normalizeBankWord("﻿дед​")).toBe("дед");
  });

  it("ё и е НЕ складываются — «всё» и «все» разные слова", () => {
    expect(normalizeBankWord("всё")).not.toBe(normalizeBankWord("все"));
    expect(normalizeBankWord("ещё")).not.toBe(normalizeBankWord("еще"));
  });

  it("й не превращается в и — ни одного морфологического шага здесь нет", () => {
    // Проверка не праздная: разложение NFD свело бы «й» к «и» + бреве, и
    // «мой» стало бы «мои». Поэтому нормализация здесь NFC, а не NFD.
    expect(normalizeBankWord("мой")).toBe("мой");
    expect(normalizeBankWord("мой")).not.toBe("мои");
  });

  it("окончания не отсекаются: «стали» не сводится к «сталь»", () => {
    expect(normalizeBankWord("стали")).toBe("стали");
    expect(normalizeBankWord("стали")).not.toBe(normalizeBankWord("сталь"));
  });

  it("ключом банка становится одно слово, в том числе через дефис", () => {
    expect(isSingleRussianWord("кто-то")).toBe(true);
    expect(isSingleRussianWord("дед")).toBe(true);
  });

  it("МНОГОСЛОВНАЯ строка в ключи банка не годится", () => {
    // 769 идиом из 771 и 1677 карточек из 5771 — многословные. Отдать
    // слову «образ» испанский перевод пары «образ мышления» — соврать.
    expect(bankKey("образ мышления")).toBeNull();
    expect(bankKey("сидеть сложа руки")).toBeNull();
    expect(bankKey("далеко / близко")).toBeNull();
    expect(bankKey("")).toBeNull();
    expect(bankKey(null)).toBeNull();
  });

  it("однословная строка ключом становится, с любым регистром и ударением", () => {
    expect(bankKey("Дед")).toBe("дед");
    expect(bankKey(" ба́бушка ")).toBe("бабушка");
  });
});
